import { describe, expect, it } from "vitest";
import { auditStatsConsistency } from "./stats-consistency";
import { buildLearningOverview } from "./learning-overview";
import { buildCourseCompletionTrend } from "./course-completion-trend";
import { buildQuizScoreTrend } from "./quiz-score-trend";
import { buildWrongbookEfficiency } from "./wrongbook-efficiency";
import { buildReplayTimeTrend } from "./replay-time-trend";
import { localDateStr, shiftDate } from "./date-utils";

const today = localDateStr();
const dayAt = (date: string) => new Date(`${date}T12:00:00`).getTime();

/**
 * 同一份本地事实数据喂给五个聚合器——统计页的真实输入路径。
 *
 * `quizzesDone` 按 `p?.done` 现算而不是写死一个数：那正是 `learn-stats.ts` 给概览卡用的尺，
 * 夹具自己填一个常量的话，「两侧是否同一判据」就退化成「夹具填了什么」。
 */
function buildAll(
  quizProgressInput: Record<string, { best: number; done: boolean }> = {
    "getting-started": { best: 8, done: true },
    spot: { best: 0, done: false },
  },
) {
  const chapters = [
    { slug: "getting-started", docCount: 2 },
    { slug: "spot", docCount: 3 },
  ];
  const progress = { "getting-started": ["a", "b"], spot: ["c"] };
  const completions = {
    "getting-started:a": {
      chapter: "getting-started",
      doc: "a",
      at: dayAt(shiftDate(today, -2)),
    },
    "spot:c": { chapter: "spot", doc: "c", at: dayAt(today) },
  };
  const quizChapters = [
    { slug: "getting-started", questions: 10 },
    { slug: "spot", questions: 10 },
  ];
  const quizProgress = quizProgressInput;
  const quizAttempts = {
    "getting-started:1": {
      chapter: "getting-started",
      best: 8,
      total: 10,
      at: dayAt(today),
    },
  };
  const wrongEntries = {
    "spot:0": {
      chapterNum: "spot",
      questionIdx: 0,
      picked: 1,
      at: dayAt(shiftDate(today, -1)),
      srsStage: 1,
      srsDue: today,
    },
  };
  const reviewAttempts = {
    "spot:0:1": {
      chapter: "spot",
      questionIdx: 0,
      correct: true,
      mastered: false,
      stage: 1,
      at: dayAt(today),
    },
  };
  const replayHistory = [
    {
      at: dayAt(today),
      symbol: "BTCUSDT",
      interval: "1h",
      total: 10,
      correct: 7,
      bestStreak: 4,
      durationSec: 300,
    },
    {
      at: dayAt(shiftDate(today, -1)),
      symbol: "ETHUSDT",
      interval: "15m",
      total: 8,
      correct: 5,
      bestStreak: 2,
    },
  ];

  const overview = buildLearningOverview({
    chapters,
    progress,
    quizzesDone: Object.values(quizProgress).filter((p) => p.done).length,
    totalQuizzes: quizChapters.length,
    avgQuizScore: 80,
    replayRounds: replayHistory.length,
    replayAccuracy: 67,
    totalStudySeconds: 3600,
    currentStreak: 2,
  });
  const courseTrend = buildCourseCompletionTrend({
    chapters,
    progress,
    completions,
    days: 7,
  });
  const quizTrend = buildQuizScoreTrend({
    chapters: quizChapters,
    progress: quizProgress,
    attempts: quizAttempts,
    days: 7,
  });
  const reviewTrend = buildWrongbookEfficiency({
    wrongEntries,
    attempts: reviewAttempts,
    days: 7,
  });
  const replayTrend = buildReplayTimeTrend({ history: replayHistory, days: 7 });
  const stats = {
    currentWrong: Object.keys(wrongEntries).length,
    overallPct: 75,
    avgQuizScore: 80,
    replayAccuracy: 67,
  };

  return { overview, courseTrend, quizTrend, reviewTrend, replayTrend, stats };
}

describe("auditStatsConsistency", () => {
  it("统计页自己的百分比也受范围约束：overallPct / avgQuizScore / replayAccuracy", () => {
    const input = buildAll();
    input.stats = {
      currentWrong: input.stats.currentWrong,
      overallPct: 150,
      avgQuizScore: 120,
      replayAccuracy: -5,
    };
    const flagged = auditStatsConsistency(input).filter(
      (i) => i.code === "pct-out-of-range",
    );
    expect(flagged.map((i) => i.detail.split("=")[0].trim()).sort()).toEqual([
      "stats.avgQuizScore",
      "stats.overallPct",
      "stats.replayAccuracy",
    ]);
  });

  it("reports zero issues when all aggregators read the same local facts", () => {
    const issues = auditStatsConsistency(buildAll());
    expect(issues).toEqual([]);
  });

  // R16.125：全答错的一套题（`best: 0, done: true`）是一次真实完成。趋势卡当年额外要求
  // `best > 0`，概览卡不要求，于是这个状态正好触发 quiz-done-mismatch——而这条用例当时
  // 根本不存在，dev 期那句 console.warn 也没人看。
  it("a zero-score completion is counted the same way on both cards", () => {
    const issues = auditStatsConsistency(
      buildAll({
        "getting-started": { best: 0, done: true },
        spot: { best: 0, done: true },
      }),
    );
    expect(issues.map((i) => i.code)).not.toContain("quiz-done-mismatch");
  });

  it("detects course read-docs drift between overview and course trend", () => {
    const input = buildAll();
    input.overview = {
      ...input.overview,
      courses: {
        ...input.overview.courses,
        readDocs: input.overview.courses.readDocs + 1,
      },
    };
    const codes = auditStatsConsistency(input).map((i) => i.code);
    expect(codes).toContain("course-read-docs-mismatch");
  });

  it("detects remaining course overview/course-trend drift fields", () => {
    const doneInput = buildAll();
    doneInput.overview = {
      ...doneInput.overview,
      courses: {
        ...doneInput.overview.courses,
        doneChapters: doneInput.overview.courses.doneChapters + 1,
      },
    };
    let codes = auditStatsConsistency(doneInput).map((i) => i.code);
    expect(codes).toContain("course-done-chapters-mismatch");

    const totalInput = buildAll();
    totalInput.overview = {
      ...totalInput.overview,
      courses: {
        ...totalInput.overview.courses,
        totalDocs: totalInput.overview.courses.totalDocs + 1,
      },
    };
    codes = auditStatsConsistency(totalInput).map((i) => i.code);
    expect(codes).toContain("course-total-docs-mismatch");

    const pctInput = buildAll();
    pctInput.overview = {
      ...pctInput.overview,
      courses: {
        ...pctInput.overview.courses,
        completionPct: pctInput.overview.courses.completionPct + 1,
      },
    };
    codes = auditStatsConsistency(pctInput).map((i) => i.code);
    expect(codes).toContain("course-completion-pct-mismatch");
  });

  it("detects quiz done-count drift and replay round drift", () => {
    const input = buildAll();
    input.overview = {
      ...input.overview,
      quizzes: { ...input.overview.quizzes, done: 2 },
      replay: { ...input.overview.replay, rounds: 9 },
    };
    const codes = auditStatsConsistency(input).map((i) => i.code);
    expect(codes).toContain("quiz-done-mismatch");
    expect(codes).toContain("replay-rounds-mismatch");
  });

  it("detects wrongbook pending drift and due/overdue range inversions", () => {
    const input = buildAll();
    input.stats = { ...input.stats, currentWrong: 5 };
    let codes = auditStatsConsistency(input).map((i) => i.code);
    expect(codes).toContain("wrong-pending-mismatch");

    const inverted = buildAll();
    inverted.reviewTrend = {
      ...inverted.reviewTrend,
      latest: {
        ...inverted.reviewTrend.latest,
        overdue: 4,
        dueToday: 2,
        pending: 3,
      },
    };
    codes = auditStatsConsistency(inverted).map((i) => i.code);
    expect(codes).toContain("wrong-range-inversion");
  });

  it("flags out-of-range percentages and missing overview", () => {
    const input = buildAll();
    input.quizTrend = {
      ...input.quizTrend,
      latest: { ...input.quizTrend.latest, bestPct: 101 },
    };
    const codes = auditStatsConsistency(input).map((i) => i.code);
    expect(codes).toContain("pct-out-of-range");

    expect(auditStatsConsistency({}).map((i) => i.code)).toEqual([
      "missing-overview",
    ]);
  });
});
