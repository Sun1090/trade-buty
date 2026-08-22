import GithubSlugger from "github-slugger";

export interface TocItem {
  text: string;
  depth: 2 | 3;
  id: string;
}

/** 清理标题里的内联噪音，得到纯文本（与渲染后的可见文本一致） */
function cleanHeadingText(raw: string): string {
  return raw
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // 链接保留文字
    .replace(/<[A-Z][A-Za-z]*\b[\s\S]*?\/>/g, "") // VitePress 组件标签整段移除（属性值可能嵌套 <mark>，需匹配到 />）
    .replace(/<\/?(?!mark)[a-z][^>]*>/g, "") // 其余小写标签移除
    .replace(/<mark>([\s\S]*?)<\/mark>/g, "$1") // mark 只留文字
    .replace(/[*`~]/g, "")
    .trim();
}

/** 与 rehype-slug（github-slugger）一致的 id 算法，按文档顺序提取 H2/H3 */
export function extractHeadings(markdown: string): TocItem[] {
  const slugger = new GithubSlugger();
  const items: TocItem[] = [];
  let inCodeBlock = false;

  for (const line of markdown.split("\n")) {
    if (line.startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;
    const m = line.match(/^(#{2,3})\s+(.+?)\s*#*$/);
    if (!m) continue;
    const depth = m[1].length as 2 | 3;
    const text = cleanHeadingText(m[2]);
    if (!text) continue;
    items.push({ text, depth, id: slugger.slug(text) });
  }
  return items;
}
