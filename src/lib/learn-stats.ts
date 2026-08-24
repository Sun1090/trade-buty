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

  const totalDocs = chapters.reduce((s, c) => s + c.docCount, 0);
  const readDocs = chapters.reduce(
    (s, c) => s + (progress[c.slug]?.length ?? 0),
    0,
  );

  const doneChapters = chapters.filter(
    (c) => (progress[c.slug]?.length ?? 0) >= c.docCount,
  ).length;

  const currentWrong = Object.keys(wrong).length;

  const chapterSlugs = Object.keys(QUIZZES);
  let quizzesDone = 0;
  let scores: number[] = [];
  for (const slug of chapterSlugs) {
    const p = readQuizProgress(slug);
    if (p?.done) {
      quizzesDone++;
      scores.push(p.best / QUIZZES[slug].questions.length);
    }
  }
  const avgQuizScore = scores.length > 0
    ? Math.round((scores.reduce((s, r) => s + r, 0) / scores.length) * 100)
    : null;

  const replayRounds = replayHistory.length;
  const totalQ = replayHistory.reduce((s, r) => s + r.total, 0);
  const totalC = replayHistory.reduce((s, r) => s + r.correct, 0);
  const replayAccuracy = totalQ > 0 ? Math.round((totalC / totalQ) * 100) : null;

  const overallPct = totalDocs > 0 ? Math.round((readDocs / totalDocs) * 100) : 0;

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
    overallPct,
  };
}

/** 成就徽章定义 */
export interface Badge {
  id: string;
  icon: string;
  name: string;
  desc: string;
  check: (stats: LearnStats) => boolean;
}

export const BADGES: Badge[] = [
  { id: "first-step", icon: "🚀", name: "第一步", desc: "完成第一篇课程", check: (s) => s.readDocs >= 1 },
  { id: "chapter-done", icon: "📖", name: "章节完成者", desc: "完成第一个篇章", check: (s) => s.doneChapters >= 1 },
  { id: "quiz-master", icon: "✏️", name: "测验达人", desc: "完成 5 章测验", check: (s) => s.quizzesDone >= 5 },
  { id: "replay-rookie", icon: "⏮", name: "回放新手", desc: "完成首次回放训练", check: (s) => s.replayRounds >= 1 },
  { id: "streak-3", icon: "🔥", name: "三日连击", desc: "连续学习 3 天", check: (s) => s.longestStreak >= 3 },
  { id: "streak-7", icon: "💎", name: "七日坚持", desc: "连续学习 7 天", check: (s) => s.longestStreak >= 7 },
  { id: "streak-30", icon: "👑", name: "月度王者", desc: "连续学习 30 天", check: (s) => s.longestStreak >= 30 },
  { id: "halfway", icon: "🎯", name: "过半", desc: "完成 50% 课程", check: (s) => s.overallPct >= 50 },
  { id: "wrongbook-empty", icon: "🧹", name: "清空错题", desc: "错题本清零", check: (s) => s.readDocs > 0 && s.currentWrong === 0 },
  { id: "replay-streak-5", icon: "⚡", name: "回放连击王", desc: "回放最佳连击 5+", check: (s) => s.replayBest >= 5 },
];

/** 获取已解锁徽章 */
export function getUnlockedBadges(stats: LearnStats): Badge[] {
  return BADGES.filter((b) => b.check(stats));
}
