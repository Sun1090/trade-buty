import { describe, expect, it } from "vitest";
import { buildQuizScoreTrend, normalizeQuizLedger, readQuizLedger } from "./quiz-score-trend";

const local = (month: number, day: number, hour = 12) => new Date(2026, month - 1, day, hour).getTime();

describe("buildQuizScoreTrend", () => {
  it("buckets quiz attempts and reports in-range and current best score", () => {
    const trend = buildQuizScoreTrend({
      chapters: [{ slug: "getting-started", questions: 10 }, { slug: "spot", questions: 8 }],
      progress: { "getting-started": { best: 8, done: true }, spot: { best: 6, done: true } },
      attempts: {
        "getting-started:1": { chapter: "getting-started", best: 5, total: 10, at: local(9, 3) },
        "getting-started:2": { chapter: "getting-started", best: 8, total: 10, at: local(9, 5) },
        spot: { chapter: "spot", best: 6, total: 8, at: local(9, 5, 13) },
      },
      days: 7,
      today: "2026-09-07",
    });

    expect(trend.version).toBe(1);
    expect(trend.dataSource).toBe("local-quiz-ledger");
    expect(trend.summary.attemptsInRange).toBe(3);
    expect(trend.summary.activeDays).toBe(2);
    expect(trend.summary.bestInRangeScore).toBe(8);
    expect(trend.summary.bestInRangeTotal).toBe(10);
    expect(trend.summary.bestInRangePct).toBe(80);
    expect(trend.summary.bestInRangeText).toBe("8/10");
    expect(trend.latest).toEqual({ doneQuizzes: 2, totalQuizzes: 2, bestPct: 80, avgPct: 78, perfectQuizzes: 0 });
    expect(trend.days[6]).toEqual({ date: "2026-09-07", attempts: 0, bestPct: 0, bestScoreText: null });
  });

  it("does not invent dates for current quiz progress without an attempt ledger", () => {
    const trend = buildQuizScoreTrend({
      chapters: [{ slug: "getting-started", questions: 10 }],
      progress: { "getting-started": { best: 8, done: true } },
      days: 7,
      today: "2026-09-07",
    });

    expect(trend.dataSource).toBe("current-quiz-progress-only");
    expect(trend.hasLedger).toBe(false);
    expect(trend.warnings).toContain("no-quiz-attempt-dates");
    expect(trend.summary).toMatchObject({ attemptsInRange: 0, activeDays: 0, bestInRangeScore: null, bestInRangeTotal: null, bestInRangePct: null });
    expect(trend.latest.bestPct).toBe(80);
  });

  it("ignores corrupt, unknown, and invalid attempts", () => {
    const trend = buildQuizScoreTrend({
      chapters: [{ slug: "getting-started", questions: 10 }],
      progress: { "getting-started": { best: 8, done: true } },
      attempts: {
        broken: { best: "bad", total: "bad", at: "bad" },
        unknown: { chapter: "missing", best: 5, total: 10, at: local(9, 3) },
        invalid: { chapter: "getting-started", best: 0, total: 10, at: local(9, 3) },
      },
      days: 7,
      today: "2026-09-07",
    });

    expect(trend.summary.attemptsInRange).toBe(0);
    expect(trend.latest.doneQuizzes).toBe(1);
  });
});

describe("quiz attempt ledger storage", () => {
  it("reads valid ledger objects and drops malformed storage entries", () => {
    expect(normalizeQuizLedger({ valid: { chapter: "ch", best: 8, total: 10, at: 123 }, invalid: [] })).toEqual({
      valid: { chapter: "ch", best: 8, total: 10, at: 123 },
    });
  });

  it("returns empty on corrupted localStorage", () => {
    const storage = { getItem: () => "{bad", setItem: () => undefined, removeItem: () => undefined } as unknown as Storage;
    expect(readQuizLedger(storage)).toEqual({});
  });
});
