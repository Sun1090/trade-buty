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

/** 同一份本地事实数据喂给五个聚合器——统计页的真实输入路径 */
function buildAll() {
  const chapters = [
    { slug: "getting-started", docCount: 2 },
    { slug: "spot", docCount: 3 },
  ];
  const progress = { "getting-started": ["a", "b"], spot: ["c"] };
  const completions = {
    "getting-started:a": { chapter: "getting-started", doc: "a", at: dayAt(shiftDate(today, -2)) },
    "spot:c": { chapter: "spot", doc: "c", at: dayAt(today) },
  };
  const quizChapters = [
    { slug: "getting-started", questions: 10 },
    { slug: "spot", questions: 10 },
  ];
  const quizProgress = {
    "getting-started": { best: 8, done: true },
    spot: { best: 0, done: false },
  };
  const quizAttempts = {
    "getting-started:1": { chapter: "getting-started", best: 8, total: 10, at: dayAt(today) },
  };
  const wrongEntries = {
    "spot:0": { chapterNum: "spot", questionIdx: 0, picked: 1, at: dayAt(shiftDate(today, -1)), srsStage: 1, srsDue: today },
  };
  const reviewAttempts = {
    "spot:0:1": { chapter: "spot", questionIdx: 0, correct: true, mastered: false, stage: 1, at: dayAt(today) },
  };
  const replayHistory = [
    { at: dayAt(today), symbol: "BTCUSDT", interval: "1h", total: 10, correct: 7, bestStreak: 4, durationSec: 300 },
    { at: dayAt(shiftDate(today, -1)), symbol: "ETHUSDT", interval: "15m", total: 8, correct: 5, bestStreak: 2 },
  ];

  const overview = buildLearningOverview({
    chapters,
    progress,
    quizzesDone: 1,
    totalQuizzes: 2,
    avgQuizScore: 80,
    replayRounds: replayHistory.length,
    replayAccuracy: 67,
    totalStudySeconds: 3600,
    currentStreak: 2,
  });
  const courseTrend = buildCourseCompletionTrend({ chapters, progress, completions, days: 7 });
  const quizTrend = buildQuizScoreTrend({ chapters: quizChapters, progress: quizProgress, attempts: quizAttempts, days: 7 });
  const reviewTrend = buildWrongbookEfficiency({ wrongEntries, attempts: reviewAttempts, days: 7 });
  const replayTrend = buildReplayTimeTrend({ history: replayHistory, days: 7 });
  const stats = { currentWrong: Object.keys(wrongEntries).length, avgQuizScore: 80, replayAccuracy: 67 };

  return { overview, courseTrend, quizTrend, reviewTrend, replayTrend, stats };
}

describe("auditStatsConsistency", () => {
  it("reports zero issues when all aggregators read the same local facts", () => {
    const issues = auditStatsConsistency(buildAll());
    expect(issues).toEqual([]);
  });

  it("detects course read-docs drift between overview and course trend", () => {
    const input = buildAll();
    input.overview = {
      ...input.overview,
      courses: { ...input.overview.courses, readDocs: input.overview.courses.readDocs + 1 },
    };
    const codes = auditStatsConsistency(input).map((i) => i.code);
    expect(codes).toContain("course-read-docs-mismatch");
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
      latest: { ...inverted.reviewTrend.latest, overdue: 4, dueToday: 2, pending: 3 },
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

    expect(auditStatsConsistency({}).map((i) => i.code)).toEqual(["missing-overview"]);
  });
});
