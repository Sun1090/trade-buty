/**
 * R3.11：入口点击埋点——console/debug 通道先行，后续接统一分析端点。
 * 永不抛错、不影响主流程。
 */

export type AiEntry =
  | "lesson-ask-ai" // 课末问 AI 按钮
  | "ai-quiz-start" // 章节 AI 出题
  | "ai-variant-quiz" // review 错题变体题
  | "chapter-summary" // 章节 AI 导读
  | "followup-question"; // 回答追问链

export function trackAiClick(entry: AiEntry, meta?: Record<string, string | number>) {
  try {
    // eslint-disable-next-line no-console
    console.info("[ai-track]", entry, meta ?? {});
  } catch {
    // ignore
  }
}
