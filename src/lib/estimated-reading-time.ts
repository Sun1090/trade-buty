const CJK_CHARACTER_RE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu;
const LATIN_WORD_RE = /[\p{Letter}\p{Number}]+/gu;
const CJK_CHARS_PER_MINUTE = 300;
const LATIN_WORDS_PER_MINUTE = 200;

/**
 * Remove markdown structures that do not need to be read while preserving
 * visible link/image labels and prose. This keeps the estimate stable even
 * when lessons add large code samples or external URLs.
 */
function readableMarkdown(markdown: string): string {
  return markdown
    .replace(/^---\s*\n[\s\S]*?\n---\s*(?:\n|$)/, "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/~~~[\s\S]*?~~~/g, " ")
    .replace(/`[^`\n]*`/g, " ")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, " $1 ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, " $1 ")
    .replace(/<[^>]+>/g, " ")
    .replace(/^\s{0,3}(?:#{1,6}|[-+*>]|\d+[.)])\s+/gm, " ");
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
