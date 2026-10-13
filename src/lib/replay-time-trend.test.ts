import { describe, expect, it } from "vitest";
import { buildReplayTimeTrend, normalizeReplayHistory } from "./replay-time-trend";
import { localDateStr, shiftDate } from "./date-utils";

const today = localDateStr(new Date(2026, 8, 7, 12)); // 2026-09-07
const dayAt = (date: string) => new Date(`${date}T12:00:00`).getTime();

describe("buildReplayTimeTrend", () => {
  it("rejects impossible calendar dates used as today", () => {
    const result = buildReplayTimeTrend({ history: [], today: "2026-02-31" });
    expect(result.days.at(-1)?.date).toBe(localDateStr());
    expect(result.days.at(-1)?.date).not.toBe("2026-02-31");
  });

  it("buckets rounds and durations by local day", () => {
    const yesterday = shiftDate(today, -1);
    const result = buildReplayTimeTrend({
      history: [
        { at: dayAt(today), symbol: "BTCUSDT", interval: "1h", total: 10, correct: 7, bestStreak: 4, durationSec: 300 },
        { at: dayAt(today), symbol: "ETHUSDT", interval: "15m", total: 8, correct: 4, bestStreak: 2, durationSec: 180 },
        { at: dayAt(yesterday), symbol: "BTCUSDT", interval: "1h", total: 10, correct: 9, bestStreak: 6 },
      ],
      days: 7,
      today,
    });

    expect(result.version).toBe(1);
    expect(result.days).toHaveLength(7);
    expect(result.days[6]).toMatchObject({ date: today, rounds: 2, durationSec: 480, timedRounds: 2, accuracyPct: 61 });
    expect(result.days[5]).toMatchObject({ date: yesterday, rounds: 1, durationSec: 0, timedRounds: 0, accuracyPct: 90 });
    expect(result.summary).toMatchObject({
      roundsInRange: 3,
      durationInRangeSec: 480,
      timedRoundsInRange: 2,
      avgSecInRange: 240,
      accuracyInRangePct: 71,
      activeDays: 2,
    });
    expect(result.allTime).toMatchObject({
      totalRounds: 3,
      totalDurationSec: 480,
      avgSecPerRound: 240,
      bestStreak: 6,
      bestAccuracyPct: 71,
    });
    expect(result.dataSource).toBe("local-replay-history");
    expect(result.hasHistory).toBe(true);
    // 有一条旧记录缺时长，但至少一条有时长 → 无警告
    expect(result.hasDurations).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it("never fabricates durations for legacy records and warns instead", () => {
    const result = buildReplayTimeTrend({
      history: [
        { at: dayAt(today), symbol: "BTCUSDT", interval: "1h", total: 10, correct: 7, bestStreak: 4 },
      ],
      days: 7,
      today,
    });
    expect(result.hasHistory).toBe(true);
    expect(result.hasDurations).toBe(false);
    expect(result.warnings).toEqual(["no-round-durations"]);
    expect(result.summary.durationInRangeSec).toBe(0);
    expect(result.summary.avgSecInRange).toBeNull();
    // 轮数与正确率仍然可用（来自真实时间戳）
    expect(result.summary.roundsInRange).toBe(1);
    expect(result.summary.accuracyInRangePct).toBe(70);
  });

  it("reports empty history without durations or rounds", () => {
    const result = buildReplayTimeTrend({ history: [], days: 7, today });
    expect(result.hasHistory).toBe(false);
    expect(result.dataSource).toBe("no-replay-history");
    expect(result.warnings).toEqual(["no-replay-history"]);
    expect(result.summary.roundsInRange).toBe(0);
    expect(result.allTime.avgSecPerRound).toBeNull();
    expect(result.days.every((b) => b.rounds === 0 && b.accuracyPct === null)).toBe(true);
  });

  it("sanitizes corrupt entries, negative durations, and caps absurd durations at 8h", () => {
    const result = buildReplayTimeTrend({
      history: [
        { at: dayAt(today), total: 10, correct: 5, durationSec: -30 },
        { at: dayAt(today), total: 10, correct: 5, durationSec: Number.NaN },
        { at: dayAt(today), total: 10, correct: 5, durationSec: 999_999 },
        { at: -1, total: 10, correct: 5 },
        null,
        "bad",
        { total: 10 },
      ],
      days: 7,
      today,
    });
    expect(result.summary.roundsInRange).toBe(3); // at<=0 / 非对象条目被剔除
    expect(result.summary.timedRoundsInRange).toBe(1);
    expect(result.summary.durationInRangeSec).toBe(8 * 3600);
  });

  it("clamps correct counts that exceed totals and clamps the day range", () => {
    const result = buildReplayTimeTrend({
      history: [{ at: dayAt(today), total: 5, correct: 9, bestStreak: 3, durationSec: 60 }],
      days: 999,
      today,
    });
    expect(result.days).toHaveLength(365);
    const bucket = result.days[364];
    expect(bucket.accuracyPct).toBe(100); // 9/5 截断为 5/5
    expect(buildReplayTimeTrend({ history: [], days: 1, today }).days).toHaveLength(7);
  });

  it("keeps all-time best streak across records even outside the range", () => {
    const old = shiftDate(today, -40);
    const result = buildReplayTimeTrend({
      history: [
        { at: dayAt(old), total: 10, correct: 10, bestStreak: 9, durationSec: 120 },
      ],
      days: 7,
      today,
    });
    expect(result.summary.roundsInRange).toBe(0);
    expect(result.allTime.bestStreak).toBe(9);
    expect(result.allTime.totalRounds).toBe(1);
    expect(result.hasDurations).toBe(true);
  });
});

describe("normalizeReplayHistory", () => {
  it("accepts only object entries inside an array", () => {
    expect(normalizeReplayHistory(null)).toEqual([]);
    expect(normalizeReplayHistory("x")).toEqual([]);
    expect(normalizeReplayHistory([{ at: 1 }, null, [1], "s"])).toEqual([{ at: 1 }]);
  });
});

describe("replay-time-trend sanitizer edges", () => {
  it("treats string metric values as sanitized inputs and clamps to safe buckets", () => {
    const result = buildReplayTimeTrend({
      history: [
        { at: String(dayAt(today)), total: "12", correct: "15", bestStreak: "9", durationSec: "45" },
      ],
      days: 7,
      today,
    });

    expect(result.summary).toMatchObject({
      roundsInRange: 1,
      durationInRangeSec: 45,
      timedRoundsInRange: 1,
      accuracyInRangePct: 100,
    });
    expect(result.allTime).toMatchObject({
      totalRounds: 1,
      totalDurationSec: 45,
      avgSecPerRound: 45,
      bestStreak: 9,
      bestAccuracyPct: 100,
    });
  });

  it("falls back to local date generation and default range for missing/invalid window inputs", () => {
    const result = buildReplayTimeTrend({ history: null });

    expect(result.days).toHaveLength(7);
    expect(result.days.at(-1)?.date).toBe(localDateStr());
  });

  it("counts zero-duration rounds as no timed data", () => {
    const result = buildReplayTimeTrend({
      history: [{ at: dayAt(today), total: 4, correct: 2, durationSec: 0 }],
      days: 7,
      today,
    });

    expect(result.hasDurations).toBe(false);
    expect(result.warnings).toEqual(["no-round-durations"]);
    expect(result.summary.timedRoundsInRange).toBe(0);
  });

  /**
   * R16.326：这块的时长只夹**单轮**，而 `/stats` 下面那张「台账学习时长」读的是台账，
   * 另有**当日**封顶。一天做满 3 轮 × 4 小时，这块 12h、台账 8h——同一屏上部分大于整体。
   * 聚合器要能把自己「跨过了当日封顶的那几天」数出来，界面才知道该不该解释。
   */
  it("数出窗口里有几天「每轮相加」超过了当日封顶", () => {
    const rounds = (n: number, each: number) =>
      Array.from({ length: n }, (_, i) => ({
        at: new Date(2026, 8, 7, i + 1, 0, 0).getTime(),
        symbol: "BTCUSDT",
        interval: "1h",
        total: 5,
        correct: 3,
        durationSec: each,
      }));

    // 3 × 4h = 12h > 8h：一天越界
    const over = buildReplayTimeTrend({ history: rounds(3, 4 * 3600), days: 7, today });
    expect(over.summary.durationInRangeSec).toBe(12 * 3600);
    expect(over.summary.daysOverDailyCapInRange).toBe(1);

    // 2 × 3h = 6h ≤ 8h：同样的字段必须是 0，否则界面那句解释会在两个数本来就一致时冒出来
    const within = buildReplayTimeTrend({ history: rounds(2, 3 * 3600), days: 7, today });
    expect(within.summary.durationInRangeSec).toBe(6 * 3600);
    expect(within.summary.daysOverDailyCapInRange, "没跨当日封顶时不许计数").toBe(0);

    // 越界要按**天**数：两天各 12h 是 2，不是 1（界面说的是「哪几天会对不上」）
    const twoDays = buildReplayTimeTrend({
      history: [...rounds(3, 4 * 3600), ...rounds(3, 4 * 3600).map((r) => ({ ...r, at: r.at - 24 * 3600_000 }))],
      days: 7,
      today,
    });
    expect(twoDays.summary.daysOverDailyCapInRange).toBe(2);
  });

  it("单轮封顶与当日封顶同值时，一轮做满恰好不算越界", () => {
    // `REPLAY_ROUND_CAP_SEC === DAILY_SOURCE_CAP_SEC`（8h）是巧合不是同一件事（R16.320）。
    // 这条钉住边界：一天只做满一轮时两个数仍然一致，界面不该解释。
    const result = buildReplayTimeTrend({
      history: [{ at: dayAt(today), symbol: "BTCUSDT", interval: "1h", total: 5, correct: 3, durationSec: 99 * 3600 }],
      days: 7,
      today,
    });
    expect(result.summary.durationInRangeSec).toBe(8 * 3600);
    expect(result.summary.daysOverDailyCapInRange, "夹到正好等于封顶不该算越界").toBe(0);
  });
});
