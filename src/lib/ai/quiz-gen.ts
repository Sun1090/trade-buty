import titlesData from "../kb-titles.json";

/**
 * R2：AI 章节出题的纯逻辑（校验、去重），与路由/组件解耦便于单测。
 * R11.1/R11.2：严格 schema 校验——结构完整之外，题目必须有可作答性
 * （选项互不重复、题干/选项/解析有最小长度），并产出逐字段诊断码
 * 供质量报告/抽样（R11.20）复用。
 */

export type AiQuizSource =
  | { chapter: string; doc?: string }
  | { none: true };

export interface AiQuizQuestion {
  question: string;
  options: string[];
  answer: number;
  explain: string;
  source?: AiQuizSource;
}

/** R11.2：逐字段诊断码（问题级） */
export type QuizIssueCode =
  | "not-object"
  | "missing-question"
  | "question-too-short"
  | "options-not-array"
  | "option-count"
  | "option-empty"
  | "option-too-long"
  | "duplicate-option"
  | "answer-not-int"
  | "answer-out-of-range"
  | "missing-explain"
  | "explain-too-short"
  | "missing-source"
  | "invalid-source"
  | "unknown-source-chapter"
  | "unknown-source-doc";

export interface QuizIssue {
  questionIndex: number;
  code: QuizIssueCode;
}

/** 题干最少字符（中英通用下限） */
const QUESTION_MIN = 4;
/** 单个选项最长字符（防模型吐整段话当选项） */
const OPTION_MAX = 120;
/** 解析最少字符（防「显然/正确」式空话） */
const EXPLAIN_MIN = 10;

function normKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

type TitlesMap = Record<string, Record<string, { title?: string; docs?: Record<string, string> }>>;
const titles = titlesData as TitlesMap;

function isNoSource(source: AiQuizSource): source is { none: true } {
  return (source as { none?: unknown }).none === true;
}

function auditSource(source: unknown, locale: string, questionIndex: number): QuizIssue[] {
  if (source === undefined) return [{ questionIndex, code: "missing-source" }];
  if (typeof source !== "object" || source === null) {
    return [{ questionIndex, code: "invalid-source" }];
  }
  const candidate = source as Record<string, unknown>;
  if (candidate.none === true) return [];
  if ("none" in candidate || typeof candidate.chapter !== "string" || candidate.chapter.trim().length === 0) {
    return [{ questionIndex, code: "invalid-source" }];
  }
  const chapter = candidate.chapter.trim();
  const chapterMeta = titles[locale]?.[chapter];
  if (!chapterMeta) return [{ questionIndex, code: "unknown-source-chapter" }];
  if (candidate.doc !== undefined) {
    if (typeof candidate.doc !== "string" || candidate.doc.trim().length === 0) {
      return [{ questionIndex, code: "invalid-source" }];
    }
    if (!chapterMeta.docs?.[candidate.doc.trim()]) {
      return [{ questionIndex, code: "unknown-source-doc" }];
    }
  }
  return [];
}

function auditOne(q: unknown, questionIndex: number, locale = "zh"): QuizIssue[] {
  const issues: QuizIssue[] = [];
  if (typeof q !== "object" || q === null) {
    return [{ questionIndex, code: "not-object" }];
  }
  const { question, options, answer, explain, source } = q as Record<string, unknown>;

  if (typeof question !== "string" || question.trim().length === 0) {
    issues.push({ questionIndex, code: "missing-question" });
  } else if (question.trim().length < QUESTION_MIN) {
    issues.push({ questionIndex, code: "question-too-short" });
  }

  if (!Array.isArray(options)) {
    issues.push({ questionIndex, code: "options-not-array" });
  } else {
    if (options.length !== 4) {
      issues.push({ questionIndex, code: "option-count" });
    }
    const texts = options.map((o) => (typeof o === "string" ? o.trim() : ""));
    if (texts.some((t) => t.length === 0)) {
      issues.push({ questionIndex, code: "option-empty" });
    }
    if (texts.some((t) => t.length > OPTION_MAX)) {
      issues.push({ questionIndex, code: "option-too-long" });
    }
    // 选项归一化后互相重复 → 题目不可作答（answer 指向歧义）
    const unique = new Set(texts.filter((t) => t.length > 0).map(normKey));
    if (unique.size !== texts.length) {
      issues.push({ questionIndex, code: "duplicate-option" });
    }
  }

  if (typeof answer !== "number" || !Number.isInteger(answer)) {
    issues.push({ questionIndex, code: "answer-not-int" });
  } else if (answer < 0 || answer >= 4) {
    issues.push({ questionIndex, code: "answer-out-of-range" });
  }

  if (typeof explain !== "string" || explain.trim().length === 0) {
    issues.push({ questionIndex, code: "missing-explain" });
  } else if (explain.trim().length < EXPLAIN_MIN) {
    issues.push({ questionIndex, code: "explain-too-short" });
  }

  // R11.5/R11.6：解释必须绑定可访问知识库引用，或显式声明无引用。
  issues.push(...auditSource(source, locale, questionIndex));

  return issues;
}

/** R11.2：对整份 AI 响应逐题审计，返回全部问题级诊断（不丢信息，供抽样报告用） */
export function auditAiQuestions(raw: unknown, locale = "zh"): QuizIssue[] {
  if (typeof raw !== "object" || raw === null) {
    return [{ questionIndex: 0, code: "not-object" }];
  }
  const questions = (raw as { questions?: unknown }).questions;
  if (!Array.isArray(questions)) {
    return [{ questionIndex: 0, code: "missing-question" }];
  }
  return questions.flatMap((q, i) => auditOne(q, i, locale));
}

/**
 * 校验 AI 返回的题目数组：结构完整 + 可作答性。合法题经字段 trim 归一化返回。
 * R11.1 起比 R2 更严格：选项互斥、题干/解析有最小长度，杜绝不可作答的题。
 */
export function validateAiQuestions(raw: unknown, locale = "zh"): AiQuizQuestion[] {
  if (
    typeof raw !== "object" ||
    raw === null ||
    !Array.isArray((raw as { questions?: unknown }).questions)
  ) {
    return [];
  }
  const qs = (raw as { questions: unknown[] }).questions;
  const out: AiQuizQuestion[] = [];
  qs.forEach((q, i) => {
    if (auditOne(q, i, locale).length > 0) return;
    const src = q as AiQuizQuestion;
    const source = src.source as AiQuizSource | undefined;
    out.push({
      question: src.question.trim(),
      options: src.options.map((o) => o.trim()),
      answer: src.answer,
      explain: src.explain.trim(),
      ...(source && {
        source: isNoSource(source) ? { none: true } : { chapter: source.chapter.trim(), ...(source.doc && { doc: source.doc.trim() }) },
      }),
    });
  });
  return out;
}


/** R11.3：以归一化 token 重叠估算题目与章节上下文相关性（0~1）。
 * 这是轻量门禁，不替代 RAG；中英文均按连续字母/数字或单个 CJK 字符切分。
 */
/** R11.3：低于该阈值即视为与当前章节上下文无关，生成链不直接服务用户 */
export const MIN_QUESTION_RELEVANCE = 0.25;

/** R11.3：仅保留有上下文且相关性达标的题目；无上下文时不猜测，直接返回空。 */
export function filterRelevantQuestions(
  questions: AiQuizQuestion[],
  context: string,
  minScore = MIN_QUESTION_RELEVANCE,
): AiQuizQuestion[] {
  if (context.trim().length === 0) return [];
  return questions.filter((question) => questionRelevanceScore(question.question, context) >= minScore);
}

export function questionRelevanceScore(question: string, context: string): number {
  const tokenize = (value: string): Set<string> => {
    const normalized = value.toLowerCase();
    const tokens = normalized.match(/[a-z0-9]+|[\u3400-\u9fff]/g) ?? [];
    return new Set(tokens.filter((token) => token.length > 0));
  };
  const qTokens = tokenize(question);
  const cTokens = tokenize(context);
  if (qTokens.size === 0 || cTokens.size === 0) return 0;
  let overlap = 0;
  for (const token of qTokens) if (cTokens.has(token)) overlap++;
  return overlap / qTokens.size;
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
