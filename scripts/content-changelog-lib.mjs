/**
 * R10.7：知识库内容变更 changelog 自动片段——纯计算与 Markdown 渲染。
 *
 * kb-diff（R6.1/R6.10）只按文件路径对比，看不出「内容改了但没增删」；
 * 本库把每篇 .md 的内容 hash（sha256）纳入对比，输出 新增 / 内容更新 / 移除
 * 三类变更，并按 locale/chapter 汇总渲染成 changelog 片段（供人工复核后并入
 * changelog，不自动改快照——快照由 kb-diff --update / kb:update 刷新）。
 */
import { createHash } from "node:crypto";

/** 计算一段文本的 sha256（hex，小写）。 */
export function hashText(text) {
  return createHash("sha256").update(String(text)).digest("hex");
}

/**
 * 解析相对路径为 locale/chapter/document。
 * 结构：`{locale}/{chapter}/{document}.md`，另有根级 `README.md`。
 * @returns {{ locale: string|null, chapter: string|null, document: string }}
 */
export function parseEntryPath(rel) {
  const parts = String(rel).split("/").filter(Boolean);
  const document = parts.pop() ?? "";
  if (parts.length === 2) return { locale: parts[0], chapter: parts[1], document };
  if (parts.length === 1) return { locale: parts[0], chapter: null, document };
  return { locale: null, chapter: null, document };
}

/** 章节汇总键：`zh/spot`；根级 README 归 `（根）`。 */
export function chapterKey(rel) {
  const { locale, chapter, document } = parseEntryPath(rel);
  if (chapter) return `${locale}/${chapter}`;
  if (locale) return `${locale}/（根）`;
  return document === "README.md" ? "（根）" : `（杂项）`;
}

/**
 * 对比上一份快照与当前文件 hash 表，输出变更分组（各自按路径排序）。
 * @param {{ prev?: Record<string,string>, current?: Record<string,string> }}
 * @returns {{ added: string[], removed: string[], changed: string[], unchanged: string[] }}
 */
export function compareKnowledge({ prev = {}, current = {} } = {}) {
  const added = [];
  const removed = [];
  const changed = [];
  const unchanged = [];
  for (const rel of new Set([...Object.keys(prev), ...Object.keys(current)])) {
    if (!(rel in prev)) added.push(rel);
    else if (!(rel in current)) removed.push(rel);
    else if (prev[rel] !== current[rel]) changed.push(rel);
    else unchanged.push(rel);
  }
  const sort = (list) => list.sort();
  return { added: sort(added), removed: sort(removed), changed: sort(changed), unchanged: sort(unchanged) };
}

/**
 * 提取文档标题：frontmatter title → 正文 H1 → 文件名去扩展名。
 * 与站点渲染契约一致（缺失字段降级），保证 changelog 片段可读。
 */
export function extractTitle(markdown, rel = "") {
  const text = String(markdown);
  const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (fm) {
    const m = fm[1].match(/^title:\s*(.*)$/m);
    if (m) return String(m[1]).trim().replace(/^["']|["']$/g, "");
  }
  const h1 = text.match(/^#\s+(.+)$/m);
  if (h1) return h1[1].trim();
  const doc = String(rel).split("/").pop() ?? rel;
  return doc.replace(/\.md$/, "");
}

const KIND_TITLE = {
  added: "新增",
  changed: "内容更新",
  removed: "移除",
};

/**
 * 渲染 changelog 片段（按语言/章节分组）。
 * 无变更时返回空串（调用方不写文件）。
 * @param {{ date: string, changes: {added:string[],changed:string[],removed:string[]},
 *           titleOf?: (rel:string)=>string|null }}
 */
export function renderChangelogFragment({ date, changes, titleOf = () => null } = {}) {
  const { added = [], changed = [], removed = [] } = changes ?? {};
  const total = added.length + changed.length + removed.length;
  if (total === 0) return "";

  const group = (rels) => {
    const map = new Map();
    for (const rel of rels) {
      const key = chapterKey(rel);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(rel);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  };
  const bullet = (rel) => {
    const { document } = parseEntryPath(rel);
    const title = titleOf(rel);
    const label = document === "README.md" ? `${document}（章节导语）` : document;
    return title ? `- ${label}：${title}` : `- ${label}`;
  };

  const lines = [
    `## ${date} 知识库更新（自动）`,
    "",
    `共 ${total} 篇变化：新增 ${added.length} / 内容更新 ${changed.length} / 移除 ${removed.length}。`,
    "",
  ];
  for (const kind of ["added", "changed", "removed"]) {
    const rels = changes[kind];
    if (!rels || rels.length === 0) continue;
    lines.push(`**${KIND_TITLE[kind]}（${rels.length}）**`);
    for (const [key, entries] of group(rels)) {
      lines.push(`- ${key}`);
      for (const rel of entries) lines.push(`  ${bullet(rel)}`);
    }
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}
