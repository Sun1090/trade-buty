/**
 * R2：AI 章节出题的纯逻辑（校验、去重），与路由/组件解耦便于单测。
 */

export interface AiQuizQuestion {
  question: string;
  options: string[];
  answer: number;
  explain: string;
}

/** 校验 AI 返回的题目数组：结构完整、answer 越界剔除 */
export function validateAiQuestions(raw: unknown): AiQuizQuestion[] {
  if (
    typeof raw !== "object" ||
    raw === null ||
    !Array.isArray((raw as { questions?: unknown }).questions)
  ) {
    return [];
  }
  const qs = (raw as { questions: unknown[] }).questions;
  return qs.filter(
    (q): q is AiQuizQuestion =>
      typeof q === "object" &&
      q !== null &&
      typeof (q as AiQuizQuestion).question === "string" &&
      (q as AiQuizQuestion).question.trim().length > 0 &&
      Array.isArray((q as AiQuizQuestion).options) &&
      (q as AiQuizQuestion).options.length === 4 &&
      Number.isInteger((q as AiQuizQuestion).answer) &&
      (q as AiQuizQuestion).answer >= 0 &&
      (q as AiQuizQuestion).answer < 4 &&
      typeof (q as AiQuizQuestion).explain === "string" &&
      (q as AiQuizQuestion).explain.trim().length > 0,
  );
}

/** 字符 bigram Jaccard 相似度（0~1），用于中英题面去重 */
export function bigramSimilarity(a: string, b: string): number {
  const grams = (s: string) => {
    const norm = s.toLowerCase().replace(/\s+/g, "");
    const set = new Set<string>();
    for (let i = 0; i < norm.length - 1; i++) set.add(norm.slice(i, i + 2));
    return set;
  };
  const ga = grams(a);
  const gb = grams(b);
  if (ga.size === 0 || gb.size === 0) return 0;
  let inter = 0;
  for (const g of ga) if (gb.has(g)) inter++;
  return inter / (ga.size + gb.size - inter);
}

/**
 * R2.3：生成题去重——与题库已有题面相似度超过 threshold 的剔除。
 * @param incoming AI 新生成的题
 * @param existing 已有题面（固定题库 / 本轮已生成的题）
 */
export function filterDuplicateQuestions(
  incoming: AiQuizQuestion[],
  existing: string[],
  threshold = 0.6,
): AiQuizQuestion[] {
  const seen = [...existing];
  const kept: AiQuizQuestion[] = [];
  for (const q of incoming) {
    if (seen.some((s) => bigramSimilarity(q.question, s) > threshold)) continue;
    seen.push(q.question);
    kept.push(q);
  }
  return kept;
}
