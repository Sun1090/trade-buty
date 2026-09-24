import { describe, expect, it } from "vitest";
import { localDateStr } from "./date-utils";
import { buildQuizScoreTrend, normalizeQuizLedger, readQuizLedger } from "./quiz-score-trend";

const local = (month: number, day: number, hour = 12) => new Date(2026, month - 1, day, hour).getTime();

describe("buildQuizScoreTrend", () => {
  it("rejects impossible calendar dates used as today", () => {
    const result = buildQuizScoreTrend({ chapters: [], today: "2026-02-31" });
    expect(result.days.at(-1)?.date).toBe(localDateStr());
    expect(result.days.at(-1)?.date).not.toBe("2026-02-31");
  });

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
        noTimestamp: { chapter: "getting-started", best: 5, total: 10, at: "bad" },
        negativeBest: { chapter: "getting-started", best: -1, total: 10, at: local(9, 3) },
      },
      days: 7,
      today: "2026-09-07",
    });

    expect(trend.summary.attemptsInRange).toBe(0);
    expect(trend.latest.doneQuizzes).toBe(1);
  });

  // 一套做完但全答错的题是真实发生过的作答：它的分数是 0，不是「没有分数」。
  // 早先这里两件事捆在一起——`best <= 0` 的记录当垃圾丢掉，日期桶又要求当天至少有一个
  // 非 0 百分比——于是「测验次数」少算这套题，同一页概览卡的「测验完成」却算它。
  it("counts a zero-score completion as an attempt and as done", () => {
    const trend = buildQuizScoreTrend({
      chapters: [
        { slug: "getting-started", questions: 10 },
        { slug: "spot", questions: 8 },
      ],
      progress: {
        "getting-started": { best: 0, done: true },
        spot: { best: 0, done: false },
      },
      attempts: {
        "getting-started:1": { chapter: "getting-started", best: 0, total: 10, at: local(9, 3) },
      },
      days: 7,
      today: "2026-09-07",
    });

    expect(trend.summary.attemptsInRange).toBe(1);
    expect(trend.summary.activeDays).toBe(1);
    expect(trend.summary.bestInRangeText).toBe("0/10");
    // 0 分不是「没测过」：分数是 0，不是 null（null 会让卡片印成 "-"，读起来像缺数据）
    expect(trend.days[2]).toEqual({ date: "2026-09-03", attempts: 1, bestPct: 0, bestScoreText: null });
    expect(trend.latest).toEqual({ doneQuizzes: 1, totalQuizzes: 2, bestPct: 0, avgPct: 0, perfectQuizzes: 0 });
  });

  // 「有分数」不等于「做完了」：`done` 才是这一判据，概览卡读的就是它。
  // 趋势卡若自己补一条 `|| best > 0`，同一屏两张卡在一份脏存档上会印出两个数。
  it("does not read a score as completion", () => {
    const trend = buildQuizScoreTrend({
      chapters: [{ slug: "getting-started", questions: 10 }],
      progress: { "getting-started": { best: 5, done: false } },
      days: 7,
      today: "2026-09-07",
    });

    expect(trend.latest.doneQuizzes).toBe(0);
    expect(trend.latest.avgPct).toBeNull();
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

  it("clamps the trend window and treats missing storage as empty", () => {
    const trend = buildQuizScoreTrend({
      chapters: [{ slug: "getting-started", questions: 0 }],
      progress: { "getting-started": { best: "bad" } },
      days: 9999,
      today: "2026-09-07",
    });

    expect(trend.days.length).toBe(365);
    expect(trend.latest).toEqual({ doneQuizzes: 0, totalQuizzes: 1, bestPct: null, avgPct: null, perfectQuizzes: 0 });
    expect(readQuizLedger(undefined as unknown as Storage)).toEqual({});
  });

  it("falls back to attempt timestamps and caps best against chapter totals", () => {
    const trend = buildQuizScoreTrend({
      chapters: [{ slug: "getting-started", questions: 10 }],
      progress: { "getting-started": { best: 99, done: true } },
      attempts: {
        "getting-started:1": { best: 8, total: 20 },
        "getting-started:2": { chapter: "getting-started", best: 8, total: 8, at: local(9, 3) },
      },
      days: 7,
      today: "2026-09-07",
    });

    expect(trend.summary.bestInRangeScore).toBe(8);
    expect(trend.summary.bestInRangeTotal).toBe(8);
    expect(trend.summary.bestInRangePct).toBe(100);
    expect(trend.latest.bestPct).toBe(100);
    expect(trend.latest.perfectQuizzes).toBe(1);
  });
