/** 搜索评分/高亮/摘要纯函数——从 search-client 抽出，可独立测试 */

export interface SearchEntry {
  url: string;
  title: string;
  chapter: string;
  text: string;
}

export function score(entry: SearchEntry, q: string): number {
  const title = entry.title.toLowerCase();
  const chapter = entry.chapter.toLowerCase();
  const text = entry.text.toLowerCase();
  let s = 0;
  if (title.includes(q)) s += 100;
  if (chapter.includes(q)) s += 30;
  const hits = text.split(q).length - 1;
  s += Math.min(hits, 10) * 2;
  return s;
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function highlight(text: string, q: string): string {
  const safe = escapeHtml(text);
  if (!q) return safe;
  return safe.replace(
    new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"),
    (m) => `<mark>${m}</mark>`,
  );
}

export function snippetHtml(text: string, q: string): string {
  const lower = text.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx < 0) return escapeHtml(text.slice(0, 80));
  const start = Math.max(0, idx - 30);
  const raw =
    (start > 0 ? "…" : "") + text.slice(start, idx + q.length + 60) + "…";
  return highlight(raw, q);
}
