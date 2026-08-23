/** Markdown 纯函数工具——从 content.ts 抽出，可独立测试 */

/** 读正文第一段有效段落（跳过标题/frontmatter/引用前缀），去粗体，截 120 字 */
export function readFirstParagraph(md: string): string {
  for (const line of md.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || t.startsWith("---")) continue;
    return t.replace(/^>\s*/, "").replace(/\*\*/g, "").slice(0, 120);
  }
  return "";
}

/** 提取第一个 H1 标题文本 */
export function extractH1(md: string): string {
  const m = md.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : "";
}

/** frontmatter title 的前导数字（章内排序） */
export function titleOrder(title: string): number {
  const m = title.match(/^(\d+)/);
  return m ? Number(m[1]) : 999;
}
