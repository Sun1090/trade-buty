/**
 * 学习统计聚合：从 localStorage 各数据源汇总学习指标
 * 纯函数，可独立测试
 */
import { readProgress } from "./progress";
import { readWrong } from "./wrongbook";
import { readReplayHistory, readReplayBest } from "./replay-store";
import { readStreak, getCurrentStreak } from "./streak";
import { QUIZZES } from "./quizzes";
import { readQuizProgress } from "./quiz-store";
import { quizScorePct } from "./quiz-score";
import { getTotalReadingTime } from "./reading-time";
import { getTotalStudySeconds } from "./study-time";
import { readDocsForChapter } from "./learning-overview";

/**
 * R4.10：已读口径的唯一实现——统计页（aggregateStats）、学习路线页（PathGlobalProgress）
 * 与首页完成计数（GlobalReadStat）共用，保证三处「已读/完成度」永远一致。
 */
export function readSummary(
  progress: Record<string, unknown[]>,
  chapters: { slug: string; docCount: number }[],
): { readDocs: number; totalDocs: number; doneChapters: number; overallPct: number } {
  const totalDocs = chapters.reduce((s, c) => s + c.docCount, 0);
  // 已读数走 learning-overview 的同一口径（去重 + 按篇章课数封顶），
  // 于是 readDocs 恒 ≤ totalDocs，完成度不可能再出现 150%。
  const perChapter = chapters.map((c) => readDocsForChapter(progress[c.slug], c.docCount));
  const readDocs = perChapter.reduce((s, n) => s + n, 0);
  // 空篇章不算完成，与 learning-overview / course-completion-trend / 侧栏同一判据
  const doneChapters = perChapter.filter((n, i) => chapters[i].docCount > 0 && n >= chapters[i].docCount).length;
  const overallPct = totalDocs > 0 ? Math.round((readDocs / totalDocs) * 100) : 0;
  return { readDocs, totalDocs, doneChapters, overallPct };
}

export interface LearnStats {
  /** 已读课程数 */
  readDocs: number;
 /** 总课程数 */
  totalDocs: number;
  /** 已完成篇章数 */
  doneChapters: number;
  /** 总篇章数 */
  totalChapters: number;
  /** 错题数 */
  wrongCount: number;
  /** 已掌握错题数（已从错题本移除的历史，这里只能看当前未掌握） */
  currentWrong: number;
  /** 测验完成数 */
  quizzesDone: number;
  /** 测验总数 */
  totalQuizzes: number;
  /** 测验平均正确率 */
  avgQuizScore: number | null;
  /** 回放训练轮数 */
  replayRounds: number;
  /** 回放最佳连击 */
  replayBest: number;
  /** 回放平均准确率 */
  replayAccuracy: number | null;
  /** 当前连续学习天数 */
  currentStreak: number;
  /** 历史最长连续天数 */
  longestStreak: number;
  /** 总阅读时长（秒）——仅阅读源，保留兼容 */
  totalReadingTime: number;
  /**
   * R4.2/R4.10：台账学习时长（秒），去重口径（阅读+测验+回放）。
   * 求和的是**整本台账**，而台账的 90 天裁剪锚在「最后一次学习的那天」而不是今天
   * （`study-time.ts` 的 `addStudyTime`），所以久不打开的人这里可能是几个月前的账。
   */
  totalStudySeconds: number;
  /** 总体完成度百分比 */
  overallPct: number;
}

/**
 * 聚合所有学习数据。
 * chapters 参数需要从服务端传入（getChapters）。
 */
export function aggregateStats(chapters: { slug: string; docCount: number }[]): LearnStats {
  const progress = readProgress();
  const wrong = readWrong();
  const replayHistory = readReplayHistory();
  const replayBest = readReplayBest();
  const streak = readStreak();

  const { readDocs, totalDocs, doneChapters, overallPct } = readSummary(progress, chapters);

  const currentWrong = Object.keys(wrong).length;

  const chapterSlugs = Object.keys(QUIZZES);
  let quizzesDone = 0;
  const scores: number[] = [];
  for (const slug of chapterSlugs) {
    const p = readQuizProgress(slug);
    if (p?.done) {
      quizzesDone++;
      scores.push(quizScorePct(p.best, QUIZZES[slug].questions.length));
    }
  }
  // scores 已是百分数（quizScorePct），这里只求均值，不再乘 100
  const avgQuizScore = scores.length > 0
    ? Math.round(scores.reduce((s, r) => s + r, 0) / scores.length)
    : null;

  const replayRounds = replayHistory.length;
  const totalQ = replayHistory.reduce((s, r) => s + r.total, 0);
  const totalC = replayHistory.reduce((s, r) => s + r.correct, 0);
  const replayAccuracy = totalQ > 0 ? Math.round((totalC / totalQ) * 100) : null;

  return {
    readDocs,
    totalDocs,
    doneChapters,
    totalChapters: chapters.length,
    wrongCount: currentWrong,
    currentWrong,
    quizzesDone,
    totalQuizzes: chapterSlugs.length,
    avgQuizScore,
    replayRounds,
    replayBest,
    replayAccuracy,
    currentStreak: getCurrentStreak(),
    longestStreak: streak.longest,
    totalReadingTime: getTotalReadingTime(),
    totalStudySeconds: getTotalStudySeconds(),
    overallPct,
  };
}

/** 成就徽章定义 */
export interface Badge {
  id: string;
  icon: string;
  /**
   * 名称与条件都是界面文字，必须按语言取值：徽章是从 `src/lib` 里的数据数组渲染出来的，
   * 写死中文不会被「写死单一语言的界面文案」那道门禁（它扫 JSX 属性与文本节点）看到。
   * 类型收成 `{ zh, en }` 之后，少写一边就是编译错误，不靠巡检。
   */
  name: { zh: string; en: string };
  desc: { zh: string; en: string };
  check: (stats: LearnStats) => boolean;
}

export const BADGES: Badge[] = [
  { id: "first-step", icon: "🚀", name: { zh: "第一步", en: "First step" }, desc: { zh: "完成第一篇课程", en: "Complete your first lesson" }, check: (s) => s.readDocs >= 1 },
  { id: "chapter-done", icon: "📖", name: { zh: "章节完成者", en: "Chapter finisher" }, desc: { zh: "完成第一个篇章", en: "Complete your first chapter" }, check: (s) => s.doneChapters >= 1 },
  { id: "quiz-master", icon: "✏️", name: { zh: "测验达人", en: "Quiz regular" }, desc: { zh: "完成 5 章测验", en: "Complete 5 chapter quizzes" }, check: (s) => s.quizzesDone >= 5 },
  { id: "replay-rookie", icon: "⏮", name: { zh: "回放新手", en: "Replay rookie" }, desc: { zh: "完成首次回放训练", en: "Finish your first replay round" }, check: (s) => s.replayRounds >= 1 },
  { id: "streak-3", icon: "🔥", name: { zh: "三日连击", en: "3-day streak" }, desc: { zh: "连续学习 3 天", en: "Study 3 days in a row" }, check: (s) => s.longestStreak >= 3 },
  { id: "streak-7", icon: "💎", name: { zh: "七日坚持", en: "7-day streak" }, desc: { zh: "连续学习 7 天", en: "Study 7 days in a row" }, check: (s) => s.longestStreak >= 7 },
  { id: "streak-30", icon: "👑", name: { zh: "月度王者", en: "30-day streak" }, desc: { zh: "连续学习 30 天", en: "Study 30 days in a row" }, check: (s) => s.longestStreak >= 30 },
  { id: "halfway", icon: "🎯", name: { zh: "过半", en: "Halfway there" }, desc: { zh: "完成 50% 课程", en: "Complete 50% of the lessons" }, check: (s) => s.overallPct >= 50 },
  // 条件里没有任何「曾经有过错题」的历史：读得够多、一道没错同样满足，所以名字只能说「此刻是空的」
  { id: "wrongbook-empty", icon: "🧹", name: { zh: "没错题", en: "Clean sheet" }, desc: { zh: "读过课文，且错题本此刻是空的", en: "You have read lessons and your wrongbook is empty right now" }, check: (s) => s.readDocs > 0 && s.currentWrong === 0 },
  { id: "replay-streak-5", icon: "⚡", name: { zh: "回放连击王", en: "Replay streaker" }, desc: { zh: "回放最佳连击 5+", en: "Best replay streak of 5+" }, check: (s) => s.replayBest >= 5 },
];

/** 获取已解锁徽章 */
export function getUnlockedBadges(stats: LearnStats): Badge[] {
  return BADGES.filter((b) => b.check(stats));
}
