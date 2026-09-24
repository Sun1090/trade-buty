import { dropInlineTags } from "./md-utils";

const CJK_CHARACTER_RE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu;
const LATIN_WORD_RE = /[\p{Letter}\p{Number}]+/gu;
const CJK_CHARS_PER_MINUTE = 300;
const LATIN_WORDS_PER_MINUTE = 200;

/**
 * Remove markdown structures that do not need to be read while preserving
 * visible link/image labels and prose. This keeps the estimate stable even
 * when lessons add large code samples or external URLs.
 *
 * 尖括号只按**标签形状**去掉（`dropInlineTags`），不是「`<` 到最近的 `>` 整段」：
 * 中文课文里的 `<` 多半是比较（`风险 < 2% 且收益 > 1%`、`K1<K2`），旧的
 * `/<[^>]+>/g` 因此把中间的真句子一起吞了——118 个课文文件少算 144,762 个字符，
 * 67 篇的「预计阅读 N 分钟」被低估（最多 8 分钟），与本段注释的承诺相反。
 */
function readableMarkdown(markdown: string): string {
  const withoutLinks = markdown
    .replace(/^---\s*\n[\s\S]*?\n---\s*(?:\n|$)/, "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/~~~[\s\S]*?~~~/g, " ")
    .replace(/`[^`\n]*`/g, " ")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, " $1 ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, " $1 ");
  return dropInlineTags(withoutLinks).replace(
    /^\s{0,3}(?:#{1,6}|[-+*>]|\d+[.)])\s+/gm,
    " "
  );
}

/** Estimate reading time from the visible Chinese + English prose. */
export function estimateReadingMinutes(markdown: string): number {
  if (!markdown.trim()) return 0;

  const readable = readableMarkdown(markdown);
  const cjkCharacters = readable.match(CJK_CHARACTER_RE)?.length ?? 0;
  const withoutCjk = readable.replace(CJK_CHARACTER_RE, " ");
  const latinWords = withoutCjk.match(LATIN_WORD_RE)?.length ?? 0;
  const minutes =
    cjkCharacters / CJK_CHARS_PER_MINUTE + latinWords / LATIN_WORDS_PER_MINUTE;

  return Math.max(1, Math.ceil(minutes));
}
