/** 流式截断标记：finish_reason=length 时追加，Markdown 渲染不可见 */
export const TRUNCATED_MARKER = "\n<!--TRUNCATED-->";

export function stripTruncatedMarker(text: string): string {
  return text.replace(/\n?<!--TRUNCATED-->\s*$/, "");
}

export function hasTruncatedMarker(text: string): boolean {
  return /<!--TRUNCATED-->\s*$/.test(text);
}
