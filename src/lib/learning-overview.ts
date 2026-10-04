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
  /** 结构版本：字段改名/改语义必须连着它一起动（R16.11） */
  version: 2;
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
    /** 各章最高百分比再取平均；不是任何一次的「best」（R16.11） */
    avgBestPct: number | null;
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
  // 「完成一章」要求这一章真有课：空篇章（内容仓回填中的英文章、或整章读取失败的章）
  // 读 0 篇就该算 0/N 未完成，而不是 0>=0 白得一个「已完成」。趋势卡与侧栏本来就这么判。
  const doneChapters = input.chapters.filter(
    (chapter) => chapter.docCount > 0 && readDocsForChapter(input.progress?.[chapter.slug], chapter.docCount) >= Math.max(0, chapter.docCount),
  ).length;
  const completionPct = totalDocs > 0 ? Math.round((readDocs / totalDocs) * 100) : 0;

  const quizzesDone = safeNonNegative(input.quizzesDone);
  const totalQuizzes = safeNonNegative(input.totalQuizzes);
  const replayRounds = safeNonNegative(input.replayRounds);
  const totalStudySeconds = safeNonNegative(input.totalStudySeconds);
  const currentStreak = safeNonNegative(input.currentStreak);

  return {
    version: 2,
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
      avgBestPct: safePct(input.avgQuizScore ?? undefined),
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
 * 「这一章现在真有的课里，已读几篇」的严格口径：存储键 ∩ 章内课表。
 *
 * 用于**手上拿得到课表**的地方：课文清单的勾选数、侧栏进度、篇章完成的礼花。
 * 它们必须与清单上勾了哪几篇一模一样——封顶（下面的 `readDocsForChapter`）挡不住
 * 「旧键顶上新课数」：改课留下 5 个废键 + 只读了 2 篇真课时，封顶照样给 7/7，
 * 于是同一页清单写着 2/7、礼花却喊「篇章完成！」。
 */
export function readDocsInChapter(
  stored: readonly unknown[] | undefined,
  currentSlugs: readonly string[]
): number {
  if (!stored) return 0;
  const set = new Set(
    stored.filter((slug): slug is string => typeof slug === "string" && slug.length > 0)
  );
  return currentSlugs.reduce((n, slug) => (set.has(slug) ? n + 1 : n), 0);
}

/**
 * 「这一章有几篇」的口径只有一个主人在场：拿到课表 slug 清单的地方，
 * 必须承认那个长度就是总数；连清单一起传、却另带一个对不上的 docCount 时，
 * 这里报错而不是照抄 docCount。
 *
 * 为什么要这条：当下一段那个 `readDocsInChapter` 返回严格更小的值（它与清单取交集），
 * 于是同一屏上会出现「清单说还差一篇读完、进度条却已经满了」——
 * `chapter-rail.tsx` 的 `readCount/docs` 就是这个形状，它拿 docCount 当分母、
 * 拿交集当分子。docCount 是**构建期从同一份 `docMetas` 算出来的**，所以线上今天
 * 两者必然相等；这条是钉住「哪一天它们会不等」，因为那一天到了之后没有第二个人会
 * 想到去查这两把尺的分母。
 *
 * 不选「静默采信 docCount」：那等于把一个对不上的事实藏起来，正是 R16.122 要修的那类
 * 同一屏两个答案。也不选「静默采信清单长度」：调用方手里那个 docCount 就再也没人用，
 * 改了它没人会发现。
 */
export function assertDocCountMatchesList(
  docCount: number,
  currentSlugs: readonly string[],
  where: string
): void {
  if (docCount === currentSlugs.length) return;
  throw new Error(
    `${where}：docCount=${docCount} 与这一章现在真有的课文数=${currentSlugs.length} 对不上。` +
      `两把尺的分母必须是同一个来源（构建期同一份 docMetas）——请一起传，别只改一个。`
  );
}

/**
 * 聚合面的封顶口径：只知道「这一章有几篇」（docCount）、拿不到课表时，
 * 去重后按课数封顶。统计页、路线页总进度、PathProgress 用它——
 * 那些界面上一屏之内没有课文清单可对照，封顶就足以挡住「已读 6/4 篇」「完成度 150%」。
 *
 * 它不是「已读几篇」的唯一口径：知道课表的地方一律用 `readDocsInChapter`，
 * 否则同一屏会给出两个答案（R16.122）。
 */
export function readDocsForChapter(docSlugs: readonly unknown[] | undefined, docCount: number): number {
  if (!docSlugs) return 0;
  const unique = new Set(docSlugs.filter((slug) => typeof slug === "string" && slug.length > 0));
  return Math.min(unique.size, Math.max(0, docCount));
}
