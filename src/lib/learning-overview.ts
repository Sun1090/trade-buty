export interface ChapterInput {
  slug: string;
  docCount: number;
}

export interface LearningOverviewInput {
  progress?: Record<string, string[]>;
  chapters: ChapterInput[];
  quizzesDone?: number;
  totalQuizzes?: number;
  avgQuizScore?: number | null;
  replayRounds?: number;
  replayAccuracy?: number | null;
  totalStudySeconds?: number;
  currentStreak?: number;
}

export type OverviewStatus = "learning" | "new";

export interface LearningOverview {
  version: 1;
  status: OverviewStatus;
  courses: {
    readDocs: number;
    totalDocs: number;
    doneChapters: number;
    totalChapters: number;
    completionPct: number;
  };
  quizzes: {
    done: number;
    total: number;
    bestPct: number | null;
  };
  replay: {
    rounds: number;
    accuracyPct: number | null;
  };
  engagement: {
    totalStudySeconds: number;
    currentStreak: number;
  };
}

const safeNonNegative = (value: number | undefined): number => {
  const normalized = value === undefined || !Number.isFinite(value) ? 0 : value;
  return Math.max(0, Math.round(normalized));
};

const safePct = (value: number | undefined): number | null => {
  if (value === undefined || !Number.isFinite(value)) return null;
  return Math.round(Math.min(100, Math.max(0, value)));
};

export function buildLearningOverview(input: LearningOverviewInput): LearningOverview {
  const readDocs = input.chapters.reduce(
    (sum, chapter) => sum + readDocsForChapter(input.progress?.[chapter.slug], chapter.docCount),
    0,
  );
  const totalDocs = input.chapters.reduce((sum, chapter) => sum + Math.max(0, chapter.docCount), 0);
  const doneChapters = input.chapters.filter(
    (chapter) => readDocsForChapter(input.progress?.[chapter.slug], chapter.docCount) >= Math.max(0, chapter.docCount),
  ).length;
  const completionPct = totalDocs > 0 ? Math.round((readDocs / totalDocs) * 100) : 0;

  const quizzesDone = safeNonNegative(input.quizzesDone);
  const totalQuizzes = safeNonNegative(input.totalQuizzes);
  const replayRounds = safeNonNegative(input.replayRounds);
  const totalStudySeconds = safeNonNegative(input.totalStudySeconds);
  const currentStreak = safeNonNegative(input.currentStreak);

  return {
    version: 1,
    status: totalStudySeconds === 0 && currentStreak === 0 && completionPct === 0 ? "new" : "learning",
    courses: {
      readDocs,
      totalDocs,
      doneChapters,
      totalChapters: input.chapters.length,
      completionPct,
    },
    quizzes: {
      done: quizzesDone,
      total: totalQuizzes,
      bestPct: safePct(input.avgQuizScore ?? undefined),
    },
    replay: {
      rounds: replayRounds,
      accuracyPct: safePct(input.replayAccuracy ?? undefined),
    },
    engagement: {
      totalStudySeconds,
      currentStreak,
    },
  };
}

/**
 * 单个篇章「已读几篇」的唯一口径：去重 + 以篇章现有课数封顶。
 *
 * 封顶不是美化，是纠错：知识库改课后 slug 会换，localStorage 与云端合并回来的旧键
 * 仍挂在这个篇章下，按原始长度算就会出现「已读 6/4 篇」「完成度 150%」这种不存在的数。
 */
export function readDocsForChapter(docSlugs: readonly unknown[] | undefined, docCount: number): number {
  if (!docSlugs) return 0;
  const unique = new Set(docSlugs.filter((slug) => typeof slug === "string" && slug.length > 0));
  return Math.min(unique.size, Math.max(0, docCount));
}
