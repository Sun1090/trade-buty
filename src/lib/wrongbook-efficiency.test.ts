import { describe, expect, it } from "vitest";
import { buildWrongbookEfficiency, normalizeReviewLedger } from "./wrongbook-efficiency";
import { localDateStr, shiftDate } from "./date-utils";

const today = localDateStr(new Date(2026, 8, 7, 12)); // 2026-09-07
const dayAt = (date: string) => new Date(`${date}T12:00:00`).getTime();

describe("buildWrongbookEfficiency", () => {
  it("buckets review answers by local day with correct/mastered counts", () => {
    const yesterday = shiftDate(today, -1);
    const result = buildWrongbookEfficiency({
      wrongEntries: {},
      attempts: {
        "getting-started:0:1": { chapter: "getting-started", questionIdx: 0, correct: true, mastered: false, stage: 1, at: dayAt(today) },
        "getting-started:1:2": { chapter: "getting-started", questionIdx: 1, correct: false, mastered: false, stage: 0, at: dayAt(today) },
        "spot:0:3": { chapter: "spot", questionIdx: 0, correct: true, mastered: true, stage: 4, at: dayAt(yesterday) },
      },
      days: 7,
      today,
    });

    expect(result.version).toBe(1);
    expect(result.days).toHaveLength(7);
    const todayBucket = result.days[6];
    expect(todayBucket).toMatchObject({ date: today, reviews: 2, correct: 1, mastered: 0, accuracyPct: 50 });
    const yesterdayBucket = result.days[5];
    expect(yesterdayBucket).toMatchObject({ date: yesterday, reviews: 1, correct: 1, mastered: 1, accuracyPct: 100 });
    expect(result.summary).toMatchObject({
      reviewsInRange: 3,
      correctInRange: 2,
      accuracyPct: 67,
      masteredInRange: 1,
      activeDays: 2,
    });
    expect(result.latest.masteredAllTime).toBe(1);
    expect(result.dataSource).toBe("local-review-ledger");
    expect(result.hasLedger).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it("reports legacy wrongbook state without inventing dates when no ledger exists", () => {
    const result = buildWrongbookEfficiency({
      wrongEntries: {
        "getting-started:0": { at: Date.now(), srsStage: 0, srsDue: today },
      },
      attempts: {},
      days: 7,
      today,
    });
    expect(result.hasLedger).toBe(false);
    expect(result.dataSource).toBe("current-wrongbook-only");
    expect(result.warnings).toEqual(["no-review-dates"]);
    expect(result.summary.reviewsInRange).toBe(0);
    expect(result.summary.accuracyPct).toBeNull();
    // 当前待复习口径不受台账缺失影响
    expect(result.latest).toMatchObject({ pending: 1, dueToday: 1, overdue: 0 });
    expect(result.days.every((bucket) => bucket.reviews === 0 && bucket.accuracyPct === null)).toBe(true);
  });

  it("counts due and overdue entries from current SRS fields only", () => {
    const due = shiftDate(today, -2);
    const future = shiftDate(today, 3);
    const result = buildWrongbookEfficiency({
      wrongEntries: {
        "a:0": { at: Date.now(), srsStage: 1, srsDue: due },                    // 过期
        "a:1": { at: Date.now(), srsStage: 2, srsDue: today },                  // 今日到期
        "a:2": { at: Date.now(), srsStage: 3, srsDue: future },                 // 未到期
        "a:3": { at: dayAt(shiftDate(today, -5)) },                             // 旧数据：回填到期日=入库+1 天 → 已到期
        "a:4": { at: dayAt(today) },                                            // 旧数据：今天入库 → 明天才到期
      },
      attempts: { "a:0:1": { chapter: "a", questionIdx: 0, correct: true, mastered: false, stage: 1, at: dayAt(today) } },
      days: 7,
      today,
    });
    expect(result.latest.pending).toBe(5);
    expect(result.latest.dueToday).toBe(3); // 过期 + 今日到期 + 入库 5 天的旧数据
    expect(result.latest.overdue).toBe(1);  // 只有显式 srsDue 过去的条目
    expect(result.latest.avgStagePct).toBe(Math.round(((1 + 2 + 3 + 0 + 0) / 5 / 4) * 100));
  });

  it("ignores corrupt and unknown attempt entries", () => {
    const result = buildWrongbookEfficiency({
      wrongEntries: { "a:0": null, bad: 42 as never },
      attempts: {
        good: { chapter: "a", questionIdx: 0, correct: true, mastered: false, stage: 1, at: dayAt(today) },
        noAt: { chapter: "a", questionIdx: 0, correct: true } as never,
        negAt: { chapter: "a", questionIdx: 0, correct: true, at: -5 } as never,
        "not-object": 42 as never,
      },
      days: 7,
      today,
    });
    expect(result.summary.reviewsInRange).toBe(1);
    expect(result.latest.pending).toBe(0); // null/42 条目被过滤
    expect(result.hasLedger).toBe(true);    // 台账存在即可信，即使部分条目损坏
  });

  it("clamps the day range to 7..365", () => {
    const entries = { "a:0:1": { chapter: "a", questionIdx: 0, correct: true, at: dayAt(today) } };
    expect(buildWrongbookEfficiency({ attempts: entries, days: 1, today }).days).toHaveLength(7);
    expect(buildWrongbookEfficiency({ attempts: entries, days: 9999, today }).days).toHaveLength(365);
    expect(buildWrongbookEfficiency({ attempts: entries, days: 30, today }).days).toHaveLength(30);
  });

  it("ignores attempts dated outside the range for summary but keeps all-time mastered", () => {
    const old = shiftDate(today, -30);
    const result = buildWrongbookEfficiency({
      wrongEntries: {},
      attempts: {
        "a:0:1": { chapter: "a", questionIdx: 0, correct: true, mastered: true, stage: 4, at: dayAt(old) },
      },
      days: 7,
      today,
    });
    expect(result.summary.reviewsInRange).toBe(0);
    expect(result.summary.masteredInRange).toBe(0);
    expect(result.latest.masteredAllTime).toBe(1);
  });
});

describe("normalizeReviewLedger", () => {
  it("keeps only object entries keyed by non-empty strings", () => {
    expect(normalizeReviewLedger(null)).toEqual({});
    expect(normalizeReviewLedger(undefined)).toEqual({});
    expect(normalizeReviewLedger({ "": { at: 1 }, ok: { at: 1 }, arr: [1], str: "x" })).toEqual({ ok: { at: 1 } });
  });
});
