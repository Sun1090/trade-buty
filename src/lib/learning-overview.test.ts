import { describe, expect, it } from "vitest";
import { buildLearningOverview } from "./learning-overview";

const chapters = [
  { slug: "getting-started", docCount: 2 },
  { slug: "technical-analysis", docCount: 4 },
];

describe("buildLearningOverview", () => {
  it("summarizes courses, quizzes, replay, and engagement with a stable version", () => {
    const overview = buildLearningOverview({
      chapters,
      progress: {
        "getting-started": ["market-overview", "candlestick-basics"],
        "technical-analysis": ["indicators"],
      },
      quizzesDone: 3,
      totalQuizzes: 10,
      avgQuizScore: 82.4,
      replayRounds: 7,
      replayAccuracy: 76.6,
      totalStudySeconds: 125,
      currentStreak: 4,
    });

    expect(overview.version).toBe(1);
    expect(overview.status).toBe("learning");
    expect(overview.courses).toEqual({
      readDocs: 3,
      totalDocs: 6,
      doneChapters: 1,
      totalChapters: 2,
      completionPct: 50,
    });
    expect(overview.quizzes).toEqual({ done: 3, total: 10, bestPct: 82 });
    expect(overview.replay).toEqual({ rounds: 7, accuracyPct: 77 });
    expect(overview.engagement).toEqual({ totalStudySeconds: 125, currentStreak: 4 });
  });

  it("ignores duplicate doc ids and caps progress to the chapter size", () => {
    const overview = buildLearningOverview({
      chapters,
      progress: {
        "getting-started": ["market-overview", "market-overview"],
        "technical-analysis": ["indicators", "indicators", "indicators"],
      },
    });

    expect(overview.courses.readDocs).toBe(2);
    expect(overview.courses.completionPct).toBe(33);
  });

  it("marks no-learning records as new with null rates", () => {
    const overview = buildLearningOverview({ chapters, totalStudySeconds: 0 });

    expect(overview.status).toBe("new");
    expect(overview.quizzes.bestPct).toBeNull();
    expect(overview.replay.accuracyPct).toBeNull();
  });

  it("sanitizes invalid and oversized values for display-safe metrics", () => {
    const overview = buildLearningOverview({
      chapters,
      quizzesDone: Number.NaN,
      totalQuizzes: -2,
      avgQuizScore: 140,
      replayRounds: -1,
      replayAccuracy: -10,
      totalStudySeconds: Number.POSITIVE_INFINITY,
      currentStreak: Number.NaN,
    });

    expect(overview.quizzes).toEqual({ done: 0, total: 0, bestPct: 100 });
    expect(overview.replay).toEqual({ rounds: 0, accuracyPct: 0 });
    expect(overview.engagement).toEqual({ totalStudySeconds: 0, currentStreak: 0 });
  });
});
