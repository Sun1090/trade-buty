import GithubSlugger from "github-slugger";

export interface TocItem {
  text: string;
  depth: 2 | 3;
  id: string;
}

/** 清理标题里的内联噪音，得到纯文本（与渲染后的可见文本一致） */
function cleanHeadingText(raw: string): string {
  const linkless = raw.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1"); // 链接保留文字
  let text = "";
  let cursor = 0;

  // 单次扫描而不是多层 replace：畸形标签不会被前一轮替换“拼”成新标签。
  while (cursor < linkless.length) {
    const open = linkless.indexOf("<", cursor);
    if (open === -1) {
      text += linkless.slice(cursor);
      break;
    }

    text += linkless.slice(cursor, open);

    // 找到与当前 < 配对的 >。嵌套的畸形 < 会继续向后找，避免残留尾部 >。
    let close = linkless.indexOf(">", open + 1);
    let nestedOpen = linkless.indexOf("<", open + 1);
    while (close !== -1 && nestedOpen !== -1 && nestedOpen < close) {
      close = linkless.indexOf(">", close + 1);
      nestedOpen = linkless.indexOf("<", nestedOpen + 1);
    }
    if (close === -1) break; // 未闭合的尾部尖括号整段丢弃

    // 标签本身整段丢弃；标签之间的文字保留（例如 <mark>高亮</mark>）。
    // 字符从不跨标签边界拼接，因此畸形嵌套标签无法重新组成可注入标签。
    cursor = close + 1;
  }

  return text.replace(/[*`~]/g, "").trim();
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
