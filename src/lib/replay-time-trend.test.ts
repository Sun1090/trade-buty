import { describe, expect, it } from "vitest";
import { buildReplayTimeTrend, normalizeReplayHistory } from "./replay-time-trend";
import { localDateStr, shiftDate } from "./date-utils";

const today = localDateStr(new Date(2026, 8, 7, 12)); // 2026-09-07
const dayAt = (date: string) => new Date(`${date}T12:00:00`).getTime();

describe("buildReplayTimeTrend", () => {
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
