/**
 * R10.11：相对链接跨语言解析审计——纯计算（remark AST 提取 + 目标语义解析）。
 *
 * 内容渲染管线宽容处理知识库 markdown：链接指向不存在的目标不会炸页面，
 * 而是渲染成 404 死链——逐页死链检查（check:links）只看构建产物，看不见
 * 「目标文件在本 locale 不存在」或「en 镜像缺口」这两类问题。本库用站点
 * 实际渲染同款解析器（remark-parse，react-markdown 同链）抽取链接/图片目标，
 * 再按 content.ts rewriteLinks 的语义解析为站内对象，供两类回归使用：
 *   1. 同语言内目标存在性（相对链接指向不存在的章节/课程/资产）。
 *   2. 跨语言镜像：en 文档若链接到「zh 有、en 无」的目标，en 页必然 404。
 * I/O（读 KB、读资产目录）留在 scripts/check-relative-links.mjs。
 */
import { unified } from "unified";
import remarkParse from "remark-parse";

/** 解析 markdown 为节点数组：每个 { type: "link"|"image", url, text }。 */
export function linkNodes(md) {
  const tree = unified().use(remarkParse).parse(md);
  const out = [];
  (function walk(node) {
    if (node.type === "link" || node.type === "image") {
      // link 取子文本；image 取 alt（mdast image 的 children 为空）
      const text =
        node.type === "image"
          ? node.alt ?? ""
          : (node.children ?? []).map((c) => c.value ?? "").join("");
      out.push({ type: node.type, url: node.url, text });
    }
    for (const child of node.children ?? []) walk(child);
  })(tree);
  return out;
}

/** 是否外部/纯锚点链接（渲染层原样保留，无站内解析语义）。 */
export function isExternalOrAnchor(href) {
  return /^(https?:|mailto:|tel:|#)/.test(href);
}

/**
 * 把相对链接/图片目标解析为站内对象（语义与 content.ts rewriteLinks 对齐）：
 *   { kind: "chapter", chapter }           章节页（含 README.md / 目录链接 / 空目标）
 *   { kind: "doc", chapter, doc }          课程页
 *   { kind: "asset", owner, file }         站内资产（_assets/...）
 *   { kind: "external" }                   外部/锚点（不做存在性检查）
 * @param {string} href 链接目标（不含 ]( 与 )）
 * @param {string} currentChapter 当前章节目录 slug
 * @returns {{ kind: string, chapter?: string, doc?: string, owner?: string, file?: string }}
 */
export function resolveLinkTarget(href, currentChapter) {
  const rawPath = String(href).split("#")[0] ?? "";
  if (isExternalOrAnchor(href)) return { kind: "external" };
  let depth = 0;
  let p = rawPath;
  while (p.startsWith("../")) {
    depth++;
    p = p.slice(3);
  }
  p = p.replace(/^\.\//, "");
  const parts = p.split("/").filter(Boolean);

  // 资产引用 .../_assets/file.ext → owner 为当前章节或 ../ 后的首个目录
  const ai = parts.indexOf("_assets");
  if (ai >= 0) {
    const owner = depth > 0 ? parts[0] : currentChapter;
    const file = parts.slice(ai + 1).join("/");
    return { kind: "asset", owner, file };
  }

  if (parts.length === 0) return { kind: "chapter", chapter: currentChapter };

  const last = parts[parts.length - 1];
  const isMd = last.endsWith(".md");
  if (!isMd) {
    // 章节目录链接
    return { kind: "chapter", chapter: parts[0] };
  }

  // .md 文件链接：doc.md 或 other-ch/doc.md
  const [targetChapter, docFile] =
    parts.length >= 2 ? [parts[0], parts[parts.length - 1]] : [currentChapter, last];
  const docSlug = docFile.replace(/\.md$/, "");
  if (/^readme$/i.test(docSlug)) {
    return { kind: "chapter", chapter: targetChapter };
  }
  return { kind: "doc", chapter: targetChapter, doc: docSlug };
}
