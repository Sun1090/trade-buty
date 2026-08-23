import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { chapterRank } from "./kb-order";

const KNOWLEDGE_ROOT = path.join(
  process.cwd(),
  "content/kline-buty/docs/knowledge"
);

const LOCALES = ["zh", "en"] as const;
type ContentLocale = (typeof LOCALES)[number];

export interface Chapter {
  slug: string; // 英文 slug，如 'getting-started'
  order: number; // 来自 README H1 的 NN 序号
  title: string; // H1 原文（含序号），如 '01 · 入门基础篇'
  tagline: string;
  docCount: number;
}

export interface DocMeta {
  slug: string; // 文件名去 .md，如 'candlestick-basics'
  fileName: string;
  chapterSlug: string;
  title: string;
  description: string;
}

export interface Doc extends DocMeta {
  content: string;
}

export function assertKnowledgeRoot() {
  if (!fs.existsSync(KNOWLEDGE_ROOT)) {
    throw new Error(
      "知识库缺失：content/kline-buty/docs/knowledge 不存在。请执行 git submodule update --init"
    );
  }
}

function localeRoot(locale: string): string {
  assertKnowledgeRoot();
  const root = path.join(KNOWLEDGE_ROOT, locale);
  if (!fs.existsSync(root)) {
    throw new Error(`知识库语言根目录缺失：${locale}`);
  }
  return root;
}

export function isValidContentLocale(v: string): v is ContentLocale {
  return (LOCALES as readonly string[]).includes(v);
}

export function getChapterSlugs(locale: string): string[] {
  const root = localeRoot(locale);
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort((a, b) => chapterRank(a) - chapterRank(b) || a.localeCompare(b));
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
    if (typeof fmDesc === "string" && fmDesc.trim()) description = fmDesc.trim();
  } catch {
    console.warn(`[content] frontmatter 解析失败，降级处理: ${fallbackTitle}`);
  }
  if (!description) description = readFirstParagraph(content);
  return { title, description, content };
}

/** frontmatter title 的前导数字（章内排序） */
function titleOrder(title: string): number {
  const m = title.match(/^(\d+)/);
  return m ? Number(m[1]) : 999;
}

export function getChapters(locale: string): Chapter[] {
  const root = localeRoot(locale);
  return getChapterSlugs(locale).map((slug) => {
    let tagline = "";
    let docCount = 0;
    let title = slug;
    try {
      const raw = fs.readFileSync(path.join(root, slug, "README.md"), "utf8");
      title = extractH1(raw) || slug;
      tagline = readFirstParagraph(parseFrontmatter(raw, slug).content);
    } catch {
      console.warn(`[content] 篇章导语缺失: ${locale}/${slug}`);
    }
    try {
      docCount = fs
        .readdirSync(path.join(root, slug))
        .filter((f) => f.endsWith(".md") && f !== "README.md").length;
    } catch {
      console.warn(`[content] 篇章目录读取失败: ${slug}`);
    }
    return {
      slug,
      order: chapterRank(slug),
      title,
      tagline,
      docCount,
    };
  });
}

export function getChapter(
  locale: string,
  slug: string
): { chapter: Chapter; introContent: string } | null {
  if (!getChapterSlugs(locale).includes(slug)) return null;
  let introContent = "";
  try {
    introContent = fs.readFileSync(
      path.join(localeRoot(locale), slug, "README.md"),
      "utf8"
    );
  } catch {
    console.warn(`[content] 篇章导语缺失: ${locale}/${slug}`);
  }
  const chapter = getChapters(locale).find((c) => c.slug === slug)!;
  return { chapter, introContent };
}

/** 篇章的前后邻居（按章节排序），用于"下一篇章"CTA */
export function getAdjacentChapters(
  locale: string,
  chapterSlug: string,
): { prev: Chapter | null; next: Chapter | null } {
  const chapters = getChapters(locale);
  const idx = chapters.findIndex((c) => c.slug === chapterSlug);
  if (idx === -1) return { prev: null, next: null };
  return {
    prev: idx > 0 ? chapters[idx - 1] : null,
    next: idx < chapters.length - 1 ? chapters[idx + 1] : null,
  };
}

/** zh 版文档顺序作为跨语言基准（en 已无序号） */
function docOrderMap(chapterSlug: string): Map<string, number> {
  try {
    const dir = path.join(KNOWLEDGE_ROOT, "zh", chapterSlug);
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".md") && f !== "README.md");
    const withOrder = files.map((f) => {
      const raw = fs.readFileSync(path.join(dir, f), "utf8");
      const t = parseFrontmatter(raw, f).title;
      return { slug: f.replace(/\.md$/, ""), order: titleOrder(t) };
    });
    withOrder.sort(
      (a, b) => a.order - b.order || a.slug.localeCompare(b.slug)
    );
    return new Map(withOrder.map((d, i) => [d.slug, i]));
  } catch {
    return new Map();
  }
}

export function getDocMetas(locale: string, chapterSlug: string): DocMeta[] {
  const dir = path.join(localeRoot(locale), chapterSlug);
  let metas: DocMeta[] = [];
  const metasWithOrder: { meta: DocMeta; order: number }[] = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".md") || f === "README.md") continue;
    try {
      const raw = fs.readFileSync(path.join(dir, f), "utf8");
      const fallback = extractH1(raw) || f.replace(/\.md$/, "");
      const { title, description } = parseFrontmatter(raw, fallback);
      metasWithOrder.push({
        meta: {
          slug: f.replace(/\.md$/, ""),
          fileName: f,
          chapterSlug,
          title,
          description,
        },
        order: titleOrder(title),
      });
    } catch {
      console.warn(`[content] 文档解析失败，告警跳过（宽容模式）: ${f}`);
    }
  }
  const zhOrder = docOrderMap(chapterSlug);
  metasWithOrder.sort(
    (a, b) =>
      (zhOrder.get(a.meta.slug) ?? 9999) - (zhOrder.get(b.meta.slug) ?? 9999) ||
      a.order - b.order ||
      a.meta.slug.localeCompare(b.meta.slug)
  );
  metas = metasWithOrder.map((m) => m.meta);
  return metas;
}

export function getDoc(
  locale: string,
  chapterSlug: string,
  docSlug: string
): Doc | null {
  const metas = getDocMetas(locale, chapterSlug);
  const meta = metas.find((m) => m.slug === docSlug);
  if (!meta) return null;
  const filePath = path.join(localeRoot(locale), chapterSlug, meta.fileName);
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
export function convertContainers(md: string): string {
  const out: string[] = [];
  let inContainer = false;
  for (const line of md.split("\n")) {
    const open = line.match(/^:{3,}\s*([a-zA-Z]+)\s*(.*)$/);
    if (!inContainer && open && !line.startsWith(":::/")) {
      inContainer = true;
      const type = open[1].toLowerCase();
      const label =
        open[2].trim() ||
        {
          tip: "💡 提示",
          info: "ℹ️ 说明",
          danger: "🚨 危险",
          warning: "⚠️ 注意",
          details: "详情",
        }[type] ||
        "⚠️ 注意";
      // 输出 HTML callout 容器（rehypeRaw 已启用，可渲染原始 HTML）
      // 后续行作为 markdown 内容渲染，包在 div 里
      out.push(
        `<div class="callout callout-${type}">`,
        `<p class="callout-title">${label}</p>`,
        "",
      );
      continue;
    }
    if (inContainer && /^:{3,}\s*$/.test(line)) {
      inContainer = false;
      out.push("", "</div>", "");
      continue;
    }
    if (inContainer) {
      out.push(line);
    } else {
      out.push(line);
    }
  }
  // 未闭合的容器兜底关 div
  if (inContainer) out.push("", "</div>", "");
  return out.join("\n");
}

/**
 * 过滤知识库中面向 VitePress 的生成内容：
 * - 「篇目一览」节（内含 <DocCards> 组件，且与本站课程列表重复）
 * - 其他未支持的 VitePress 组件标签行
 */
/** KbBadge 组件转为可见文字（保留"最基础/需杠杆"等提示），其余大写组件标签整段移除 */
function convertComponents(md: string): string {
  return md
    .replace(/<KbBadge\b([\s\S]*?)\/>/g, (_m, attrs: string) => {
      const t = attrs.match(/t="([^"]*)"/);
      if (!t) return "";
      const label = t[1].replace(/<\/?mark>/g, "");
      return label ? `【${label}】` : "";
    })
    .replace(/<\/?[A-Z][A-Za-z]*\b[^>]*>/g, "");
}

export function stripVitePressArtifacts(md: string): string {
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

/** 页面已渲染 frontmatter title 作为 H1，正文首个 H1 与之重复，剥离 */
export function stripLeadingH1(md: string): string {
  const m = md.match(/^\s*#\s+.*\n/);
  if (m && m.index !== undefined && m.index < 200) {
    return md.slice(0, m.index) + md.slice(m.index + m[0].length);
  }
  return md;
}

/**
 * 重写知识库内部相对链接与资产路径为站内路由。
 * 新契约：篇章间用英文 slug 相对链接（../futures/、../futures/margin.md）。
 */
export function rewriteLinks(
  md: string,
  locale: string,
  currentChapter: string
): string {
  return md.replace(
    /(\]\()([^)\s]+)([^)]*\))/g,
    (full, open: string, href: string, rest: string) => {
      if (/^(https?:|mailto:|#)/.test(href)) return full;
      const [rawPath, hash = ""] = href.split(/(#.*)$/);
      let depth = 0;
      let p = rawPath;
      while (p.startsWith("../")) {
        depth++;
        p = p.slice(3);
      }
      p = p.replace(/^\.\//, "");
      const parts = p.split("/").filter(Boolean);

      // 资产引用 .../_assets/file.ext → /knowledge-assets/{locale}/{章节}/{file}
      const ai = parts.indexOf("_assets");
      if (ai >= 0) {
        const owner = depth > 0 ? parts[0] : currentChapter;
        const fileName = parts.slice(ai + 1).join("/");
        return `${open}/knowledge-assets/${locale}/${owner}/${fileName}${hash}${rest}`;
      }

      if (!p) {
        return `${open}/${locale}/knowledge/${currentChapter}${hash}${rest}`;
      }

      const isMd = path.extname(p) === ".md";

      if (!isMd) {
        // 篇章目录链接
        return `${open}/${locale}/knowledge/${parts[0]}${hash}${rest}`;
      }

      // .md 文件链接：doc.md 或 other-ch/doc.md
      const [targetChapter, docFile] =
        parts.length >= 2 ? [parts[0], parts[parts.length - 1]] : [currentChapter, parts[0]];
      const docSlug = docFile.replace(/\.md$/, "");
      if (/^readme$/i.test(docSlug)) {
        return `${open}/${locale}/knowledge/${targetChapter}${hash}${rest}`;
      }
      return `${open}/${locale}/knowledge/${targetChapter}/${docSlug}${hash}${rest}`;
    }
  );
}

export function prepareForRender(
  md: string,
  locale: string,
  chapterSlug: string
): string {
  const converted = convertContainers(md);
  const convertedComponents = convertComponents(converted);
  const stripped = stripVitePressArtifacts(convertedComponents);
  return rewriteLinks(stripLeadingH1(stripped), locale, chapterSlug);
}

export function getAdjacentDocs(
  locale: string,
  chapterSlug: string,
  docSlug: string
): {
  prev: DocMeta | null;
  next: DocMeta | null;
} {
  const metas = getDocMetas(locale, chapterSlug);
  const idx = metas.findIndex((m) => m.slug === docSlug);
  return {
    prev: idx > 0 ? metas[idx - 1] : null,
    next: idx >= 0 && idx < metas.length - 1 ? metas[idx + 1] : null,
  };
}
