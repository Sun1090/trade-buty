import GithubSlugger from "github-slugger";

export interface TocItem {
  text: string;
  depth: 2 | 3;
  id: string;
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
    const text = m[2].replace(/[*`~]/g, "").trim();
    items.push({ text, depth, id: slugger.slug(text) });
  }
  return items;
}
