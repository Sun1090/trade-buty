import titlesData from "./kb-titles.json";

export type QuizDifficulty = "basic" | "advanced";
export type QuizLocale = "zh" | "en";

export interface QuizGenerationOptions {
  locale: QuizLocale;
  difficulty: QuizDifficulty;
  /** Chapter quiz mode */
  chapter?: string;
  /** Wrong-question variant mode */
  variant?: boolean;
}

export interface QuizGenerationStrategy {
  difficulty: QuizDifficulty;
  locale: QuizLocale;
  expectedCount: number;
  maxInputQuestions: number;
  temperature: number;
  maxTokens: number;
  /** R11.3/R11.8：按难度调整相关性阈值。 */
  minRelevance: number;
  /** R11.8：进阶题使用更少、更长的 token 预算与更高温度。 */
  difficultyRule: string;
  cacheKey: string;
}

const DIFFICULTY_RULES: Record<QuizLocale, Record<QuizDifficulty, string>> = {
  zh: {
    basic: "难度：入门——考察概念理解，不考数字记忆。",
    advanced: "难度：进阶——考察应用场景、易混淆点与常见误区。",
  },
  en: {
    basic: "Difficulty: beginner level — test concept understanding, not memorization of numbers.",
    advanced: "Difficulty: advanced — test application, edge cases and common misconceptions.",
  },
};

const CHAPTER_TITLE_BY_LOCALE = titlesData as Record<QuizLocale, Record<string, unknown>>;

function normalizeLocale(locale: string): QuizLocale {
  return locale === "en" ? "en" : "zh";
}

export function normalizeQuizDifficulty(value: string | undefined): QuizDifficulty {
  return value === "advanced" ? "advanced" : "basic";
}

function hasChapterInLocale(chapter: string, locale: QuizLocale): boolean {
  return Boolean(CHAPTER_TITLE_BY_LOCALE[locale]?.[chapter]);
}

export function resolveQuizStrategy(input: QuizGenerationOptions): QuizGenerationStrategy {
  const locale = normalizeLocale(input.locale);
  const difficulty = normalizeQuizDifficulty(input.difficulty);
  const isChapter = Boolean(input.chapter);
  const cacheKey = [
    input.variant ? "variant" : "chapter",
    locale,
    difficulty,
    input.chapter ?? "",
  ].join("::");

  return {
    difficulty,
    locale,
    expectedCount: isChapter ? 5 : 3,
    maxInputQuestions: 5,
    temperature: difficulty === "advanced" ? 0.75 : 0.65,
    maxTokens: difficulty === "advanced" ? 3200 : 2600,
    minRelevance: difficulty === "advanced" ? 0.32 : 0.25,
    difficultyRule: DIFFICULTY_RULES[locale][difficulty],
    cacheKey,
  };
}

/**
 * R11.8：难度偏好仅存储在浏览器 localStorage；隐私模式/SSR 失败时回退 basic。
 * 该偏好按 locale 隔离，避免 zh/en 切换时串档。
 */
export function readQuizDifficulty(locale: string = "zh"): QuizDifficulty {
  if (typeof window === "undefined") return "basic";
  try {
    return normalizeQuizDifficulty(window.localStorage.getItem(`tb-quiz-difficulty:${normalizeLocale(locale)}`) ?? "basic");
  } catch {
    return "basic";
  }
}

export function writeQuizDifficulty(difficulty: QuizDifficulty, locale: string = "zh"): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`tb-quiz-difficulty:${normalizeLocale(locale)}`, difficulty);
  } catch {
    // localStorage can be unavailable in private mode; quiz generation still works with default difficulty.
  }
}

export function clearQuizDifficulty(locale: string = "zh"): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(`tb-quiz-difficulty:${normalizeLocale(locale)}`);
  } catch {
    // noop
  }
}

export function buildQuizStrategyConfig(options: QuizGenerationOptions): {
  strategy: QuizGenerationStrategy;
  warnings: string[];
} {
  const strategy = resolveQuizStrategy(options);
  const warnings: string[] = [];

  if (options.chapter && !hasChapterInLocale(options.chapter, strategy.locale)) {
    warnings.push("unknown-chapter");
  }

  if (options.variant && !options.chapter) {
    warnings.push("variant-fallback-basic");
  }

  return { strategy, warnings };
}
