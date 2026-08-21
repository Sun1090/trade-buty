import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const KNOWLEDGE_ROOT = path.join(
  process.cwd(),
  "content/kline-buty/docs/knowledge"
);

export interface Chapter {
  num: string; // 对外路由：'01'
  dirName: string; // 磁盘目录名：'01-入门基础'
  title: string;
  tagline: string;
  docCount: number;
}

export interface DocMeta {
  slug: string; // 对外路由：'03'
  fileName: string; // 磁盘文件名：'03-K线与图表入门.md'
  chapterNum: string;
  title: string;
  description: string;
}

export interface Doc extends DocMeta {
  content: string;
}

function assertKnowledgeRoot() {
  if (!fs.existsSync(KNOWLEDGE_ROOT)) {
    throw new Error(
      "知识库缺失：content/kline-buty/docs/knowledge 不存在。请执行 git submodule update --init"
    );
  }
}

/** 篇章号 -> 真实目录名 */
export function chapterDir(num: string): string | null {
  assertKnowledgeRoot();
  const hit = fs
    .readdirSync(KNOWLEDGE_ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory() && /^\d{2}-/.test(e.name))
    .map((e) => e.name)
    .sort()
    .find((name) => name.slice(0, 2) === num);
  return hit ?? null;
}

export function getChapterNums(): string[] {
  assertKnowledgeRoot();
  return fs
    .readdirSync(KNOWLEDGE_ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory() && /^\d{2}-/.test(e.name))
    .map((e) => e.name.slice(0, 2))
    .sort();
}

/** 文件名 -> 文档号（取前导数字；无数字则用 URL 编码兜底，宽容模式） */
function fileToSlug(fileName: string): string {
  const m = fileName.match(/^(\d{2})-/);
  return m ? m[1] : encodeURIComponent(fileName.replace(/\.md$/, ""));
}

function readFirstParagraph(md: string): string {
  for (const line of md.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || t.startsWith("---")) continue;
    return t.replace(/^>\s*/, "").replace(/\*\*/g, "").slice(0, 120);
  }
  return "";
}

function extractH1(md: string): string {
  const m = md.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : "";
}

function parseFrontmatter(
  raw: string,
  fallbackTitle: string
): { title: string; description: string; content: string } {
  let title = fallbackTitle;
  let description = "";
  let content = raw;
  try {
    const parsed = matter(raw);
    content = parsed.content;
    const fmTitle = parsed.data.title;
    const fmDesc = parsed.data.description;
    if (typeof fmTitle === "string" && fmTitle.trim()) title = fmTitle.trim();
    if (typeof fmDesc === "string" && fmDesc.trim())
      description = fmDesc.trim();
  } catch {
    console.warn(`[content] frontmatter 解析失败，降级处理: ${fallbackTitle}`);
  }
  if (!description) description = readFirstParagraph(content);
  return { title, description, content };
}

export function getChapters(): Chapter[] {
  assertKnowledgeRoot();
  const nums = getChapterNums();
  return nums.map((num) => {
    const dirName = chapterDir(num)!;
    let tagline = "";
    let docCount = 0;
    try {
      const raw = fs.readFileSync(
        path.join(KNOWLEDGE_ROOT, dirName, "README.md"),
        "utf8"
      );
      tagline = readFirstParagraph(parseFrontmatter(raw, dirName).content);
    } catch {
      console.warn(`[content] 篇章导语缺失，跳过 tagline: ${dirName}`);
    }
    try {
      docCount = fs
        .readdirSync(path.join(KNOWLEDGE_ROOT, dirName))
        .filter((f) => f.endsWith(".md") && f !== "README.md").length;
    } catch {
      console.warn(`[content] 篇章目录读取失败: ${dirName}`);
    }
    return {
      num,
      dirName,
      title: dirName.replace(/^\d{2}-/, ""),
      tagline,
      docCount,
    };
  });
}

export function getChapter(num: string): { chapter: Chapter; introContent: string } | null {
  const dirName = chapterDir(num);
  if (!dirName) return null;
  let introContent = "";
  try {
    const raw = fs.readFileSync(
      path.join(KNOWLEDGE_ROOT, dirName, "README.md"),
      "utf8"
    );
    introContent = parseFrontmatter(raw, dirName).content;
  } catch {
    console.warn(`[content] 篇章导语缺失: ${dirName}`);
  }
  const chapter = getChapters().find((c) => c.num === num)!;
  return { chapter, introContent };
}

export function getDocMetas(chapterNum: string): DocMeta[] {
  const dirName = chapterDir(chapterNum);
  if (!dirName) return [];
  const files = fs
    .readdirSync(path.join(KNOWLEDGE_ROOT, dirName))
    .filter((f) => f.endsWith(".md") && f !== "README.md")
    .sort();
  const metas: DocMeta[] = [];
  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(KNOWLEDGE_ROOT, dirName, file), "utf8");
      const fallback = extractH1(raw) || file.replace(/\.md$/, "");
      const { title, description } = parseFrontmatter(raw, fallback);
      metas.push({
        slug: fileToSlug(file),
        fileName: file,
        chapterNum,
        title,
        description,
      });
    } catch {
      console.warn(`[content] 文档解析失败，告警跳过（宽容模式）: ${file}`);
    }
  }
  return metas;
}

export function getDoc(chapterNum: string, docSlug: string): Doc | null {
  const metas = getDocMetas(chapterNum);
  const meta = metas.find((m) => m.slug === docSlug);
  if (!meta) return null;
  const filePath = path.join(KNOWLEDGE_ROOT, chapterDir(chapterNum)!, meta.fileName);
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const fallback = extractH1(raw) || meta.fileName.replace(/\.md$/, "");
    const { title, description, content } = parseFrontmatter(raw, fallback);
    return { ...meta, title, description, content };
  } catch {
    console.warn(`[content] 文档读取失败: ${meta.fileName}`);
    return null;
  }
}

/** 把 VitePress 容器语法 ::: type 标题 ... ::: 转换为 callout 引用块 */
function convertContainers(md: string): string {
  const out: string[] = [];
  let inContainer = false;
  for (const line of md.split("\n")) {
    const open = line.match(/^:{3,}\s*([a-zA-Z]+)\s*(.*)$/);
    if (!inContainer && open && !line.startsWith(":::/")) {
      inContainer = true;
      const label =
        open[2].trim() ||
        {
          tip: "💡 提示",
          info: "ℹ️ 说明",
          danger: "🚨 危险",
          warning: "⚠️ 注意",
          details: "详情",
        }[open[1].toLowerCase()] ||
        "⚠️ 注意";
      out.push(`> **${label}**`, ">");
      continue;
    }
    if (inContainer && /^:{3,}\s*$/.test(line)) {
      inContainer = false;
      continue;
    }
    if (inContainer) {
      out.push(line.trim() ? `> ${line}` : ">");
    } else {
      out.push(line);
    }
  }
  return out.join("\n");
}

/**
 * 重写知识库内部相对链接与资产路径。
 * currentChapterNum: 当前文档所属篇章号；根 README 场景传 ""。
 */
function rewriteLinks(md: string, currentChapterNum: string): string {
  return md.replace(
    /(\]\()([^)\s]+)([^)]*\))/g,
    (full, open: string, href: string, rest: string) => {
      if (/^(https?:|mailto:)/.test(href)) return full;
      const [rawPath, hash = ""] = href.split(/(#.*)$/);
      let depth = 0;
      let p = rawPath;
      while (p.startsWith("../")) {
        depth++;
        p = p.slice(3);
      }
      p = p.replace(/^\.\//, "");
      const parts = p.split("/").filter(Boolean);

      // 资产引用 .../_assets/file.ext → /knowledge-assets/{篇章目录}/{file}
      const ai = parts.indexOf("_assets");
      if (ai >= 0) {
        // 跨篇章引用时 parts[0] 是目标篇章目录名；同篇章时用当前篇章目录名
        const ownerDir =
          depth > 0 ? parts[0] : (chapterDir(currentChapterNum) ?? currentChapterNum);
        const fileName = parts.slice(ai + 1).join("/");
        return `${open}/knowledge-assets/${ownerDir}/${fileName}${hash}${rest}`;
      }

      if (!p) {
        // 如 ../NN-篇/ 指向篇章
        return `${open}/knowledge/${currentChapterNum || ""}${hash}${rest}`;
      }

      const isDir = rawPath.endsWith("/") || !path.extname(p);

      if (isDir || parts.length === 1) {
        // 篇章链接（可能带篇章号前缀）
        const chNum = parts[0].slice(0, 2);
        return /^\d{2}$/.test(chNum)
          ? `${open}/knowledge/${chNum}${hash}${rest}`
          : full; // 无法识别的链接保持原样（宽容模式）
      }

      // .md 文件链接：[ch/]doc.md → 数字路由
      const [maybeCh, maybeDoc] =
        parts.length >= 2 ? [parts[0], parts[parts.length - 1]] : ["", parts[0]];
      const chNum = maybeCh.slice(0, 2);
      const targetChapter = /^\d{2}$/.test(chNum)
        ? chNum
        : currentChapterNum;
      const docSlug = fileToSlug(maybeDoc);
      if (/^readme$/i.test(docSlug)) {
        return `${open}/knowledge/${targetChapter}${hash}${rest}`;
      }
      return `${open}/knowledge/${targetChapter}/${docSlug}${hash}${rest}`;
    }
  );
}

/**
 * 过滤知识库中面向 VitePress 的生成内容：
 * - 「篇目一览」节（内含 <DocCards> 组件，且与本站课程列表重复）
 * - 其他未支持的 VitePress 组件标签行
 */
function stripVitePressArtifacts(md: string): string {
  const out: string[] = [];
  let skipping = false;
  for (const line of md.split("\n")) {
    if (/^#{2,3}\s*篇目一览\s*$/.test(line)) {
      skipping = true;
      continue;
    }
    if (skipping && /^#{2}\s/.test(line)) {
      skipping = false;
    }
    if (!skipping && !/<DocCards[^>]*\/?>\s*$/.test(line)) {
      out.push(line);
    }
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n");
}

export function prepareForRender(md: string, chapterNum: string): string {
  const converted = convertContainers(md);
  const stripped = stripVitePressArtifacts(converted);
  return rewriteLinks(stripped, chapterNum);
}

export function getAdjacentDocs(chapterNum: string, docSlug: string): {
  prev: DocMeta | null;
  next: DocMeta | null;
} {
  const metas = getDocMetas(chapterNum);
  const idx = metas.findIndex((m) => m.slug === docSlug);
  return {
    prev: idx > 0 ? metas[idx - 1] : null,
    next: idx >= 0 && idx < metas.length - 1 ? metas[idx + 1] : null,
  };
}
