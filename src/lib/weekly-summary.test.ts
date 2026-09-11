// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildWeeklySummary,
  getWeeklyGoalMin,
  setWeeklyGoalMin,
  WEEKLY_GOAL_TIERS,
  DEFAULT_WEEKLY_GOAL_MIN,
} from "./weekly-summary";

const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => store.set(k, v),
  removeItem: (k: string) => store.delete(k),
  clear: () => store.clear(),
});
vi.stubGlobal("window", { dispatchEvent: () => true, addEventListener: () => {}, removeEventListener: () => {} });


const NOW = new Date(2026, 8, 11, 15, 0, 0); // 2026-09-11 local
const at = (iso: string) => new Date(iso).getTime();

describe("weekly goal storage", () => {
  beforeEach(() => store.clear());

  it("defaults to 90, accepts only tiers, and round-trips", () => {
    expect(getWeeklyGoalMin(globalThis.localStorage)).toBe(DEFAULT_WEEKLY_GOAL_MIN);
    setWeeklyGoalMin(150);
    expect(getWeeklyGoalMin(globalThis.localStorage)).toBe(150);
    setWeeklyGoalMin(88); // invalid tier → default
    expect(getWeeklyGoalMin(globalThis.localStorage)).toBe(DEFAULT_WEEKLY_GOAL_MIN);
  });
});

describe("buildWeeklySummary", () => {
  it("counts minutes, active days and per-channel actions within the last 7 calendar days", () => {
    const summary = buildWeeklySummary({
      now: NOW,
      dailySeconds: [600, 0, 900, 300, 0, 1200, 1800],
      completions: {
        a: { at: at("2026-09-11T10:00:00") },
        b: { at: at("2026-09-06T10:00:00") },
        c: { at: at("2026-08-30T10:00:00") }, // 超窗，不计
      },
      quizAttempts: { q1: { at: at("2026-09-10T20:00:00") }, q2: { at: at("2026-09-05T23:00:00") } },
      reviewAttempts: { r1: { at: at("2026-09-11T21:00:00") }, r2: { at: at("2026-09-05T08:00:00") } },
      replayHistory: [{ at: at("2026-09-09T12:00:00") }, { at: at("2026-09-01T12:00:00") }],
      weeklyGoalMin: 90,
    });
    expect(summary.weekStart).toBe("2026-09-05");
    expect(summary.weekEnd).toBe("2026-09-11");
    expect(summary.totalMinutes).toBe(80); // 4800s
    expect(summary.activeDays).toBe(5);
    expect(summary.completions).toBe(2);
    expect(summary.quizAttempts).toBe(2); // 09-05 在窗口内（含端点）
    expect(summary.reviews).toBe(2); // 09-05 在窗口内（含端点）
    expect(summary.replayRounds).toBe(1);
    expect(summary.goalAchieved).toBe(false);
    expect(summary.remainingMin).toBe(10);
  });

  it("marks the weekly goal achieved only on real numbers", () => {
    const summary = buildWeeklySummary({
      now: NOW,
      dailySeconds: [0, 0, 0, 0, 0, 0, 5400], // 90 分钟整
      completions: {}, quizAttempts: {}, reviewAttempts: {}, replayHistory: [],
      weeklyGoalMin: 90,
    });
    expect(summary.goalAchieved).toBe(true);
    expect(summary.remainingMin).toBe(0);
  });

  it("tolerates NaN seconds, corrupt at values and invalid goal tiers", () => {
    const summary = buildWeeklySummary({
      now: NOW,
      dailySeconds: [Number.NaN, -50, 120],
      completions: { bad: { at: Number.NaN } },
      quizAttempts: {}, reviewAttempts: {}, replayHistory: [{ at: Number.NEGATIVE_INFINITY }],
      weeklyGoalMin: 999,
    });
    expect(summary.totalMinutes).toBe(2);
    expect(summary.activeDays).toBe(1);
    expect(summary.completions).toBe(0);
    expect(summary.replayRounds).toBe(0);
    expect(summary.goalMin).toBe(DEFAULT_WEEKLY_GOAL_MIN);
  });

  it("includes boundary timestamps of the week window exactly", () => {
    const summary = buildWeeklySummary({
      now: NOW,
      dailySeconds: [],
      completions: {
        edgeStart: { at: new Date(2026, 8, 5, 0, 0, 0).getTime() },
        edgeEnd: { at: new Date(2026, 8, 11, 23, 59, 59).getTime() },
        outside: { at: new Date(2026, 8, 4, 23, 59, 59).getTime() },
      },
      quizAttempts: {}, reviewAttempts: {}, replayHistory: [],
      weeklyGoalMin: WEEKLY_GOAL_TIERS[0],
    });
    expect(summary.completions).toBe(2);
  });
});
