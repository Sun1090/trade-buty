import { describe, it, expect, beforeEach, vi } from "vitest";

const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => store.set(k, v),
  removeItem: (k: string) => store.delete(k),
});
vi.stubGlobal("window", { dispatchEvent: vi.fn() });

const { readStreak, touchStreak, getCurrentStreak, getStreakBreak } = await import("./streak");

describe("streak", () => {
  beforeEach(() => store.clear());

  it("首次 touch 记录 1 天", () => {
    touchStreak();
    const data = readStreak();
    expect(data.current).toBe(1);
    expect(data.longest).toBe(1);
  });

  it("同一天多次 touch 不增天数", () => {
    touchStreak();
    touchStreak();
    touchStreak();
    expect(readStreak().current).toBe(1);
  });

  it("空时 getCurrentStreak 返回 0", () => {
    expect(getCurrentStreak()).toBe(0);
  });

  it("touch 后 getCurrentStreak 返回 1", () => {
    touchStreak();
    expect(getCurrentStreak()).toBe(1);
  });

  it("损坏 JSON 不崩溃", () => {
    store.set("tb-streak", "{bad");
    expect(readStreak()).toEqual({ lastDate: "", current: 0, longest: 0, lastTs: 0 });
    expect(getCurrentStreak()).toBe(0);
  });

  it("R4.8：日历跳天但实际间隔 <36h（跨时区旅行）视为连续", () => {
    // 前天有记录，但 lastTs 只有 20 小时前（跨时区旅行导致日历跳天）
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const dateStr = `${twoDaysAgo.getFullYear()}-${String(twoDaysAgo.getMonth() + 1).padStart(2, "0")}-${String(twoDaysAgo.getDate()).padStart(2, "0")}`;
    store.set("tb-streak", JSON.stringify({
      lastDate: dateStr,
      current: 3,
      longest: 5,
      lastTs: Date.now() - 20 * 3600_000,
    }));
    touchStreak();
    expect(readStreak().current).toBe(4); // 宽限窗内：连续 +1，而不是断签归 1
  });

  it("R4.8：间隔超过 36h 正常断签归 1", () => {
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const dateStr = `${twoDaysAgo.getFullYear()}-${String(twoDaysAgo.getMonth() + 1).padStart(2, "0")}-${String(twoDaysAgo.getDate()).padStart(2, "0")}`;
    store.set("tb-streak", JSON.stringify({
      lastDate: dateStr,
      current: 3,
      longest: 5,
      lastTs: Date.now() - 40 * 3600_000,
    }));
    touchStreak();
    expect(readStreak().current).toBe(1);
  });

  it("R4.8：getCurrentStreak 在宽限窗内不归零", () => {
    store.set("tb-streak", JSON.stringify({
      lastDate: "2020-01-01", // 日历上早已断
      current: 7,
      longest: 9,
      lastTs: Date.now() - 10 * 3600_000, // 但 10h 前刚学过
    }));
    expect(getCurrentStreak()).toBe(7);
  });

  it("R4.3：断签后 broken=true 并给出历史最长；没开始过不算断签", () => {
    expect(getStreakBreak()).toEqual({ broken: false, longest: 0 });
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const dateStr = `${threeDaysAgo.getFullYear()}-${String(threeDaysAgo.getMonth() + 1).padStart(2, "0")}-${String(threeDaysAgo.getDate()).padStart(2, "0")}`;
    store.set("tb-streak", JSON.stringify({ lastDate: dateStr, current: 2, longest: 8 }));
    const info = getStreakBreak();
    expect(info.broken).toBe(true);
    expect(info.longest).toBe(8);
  });
});

import { getRecentDays } from "./streak";

describe("getRecentDays", () => {
  beforeEach(() => {
    store.clear();
    vi.useRealTimers();
    vi.setSystemTime(new Date("2026-09-05T12:00:00Z"));
  });

  it("默认返回 7 项", () => {
    expect(getRecentDays()).toHaveLength(7);
  });

  it("空数据 → 全 false", () => {
    const days = getRecentDays();
    expect(days.every((d) => d.active === false)).toBe(true);
  });

  it("最近一天在活动集合内 → active=true", () => {
    const today = "2026-09-05";
    store.set("tb-activity", JSON.stringify([today]));
    const days = getRecentDays();
    expect(days[6].date).toBe(today);
    expect(days[6].active).toBe(true);
  });

  it("date 格式 yyyy-MM-dd", () => {
    const days = getRecentDays();
    expect(days[0]).toMatchObject({ date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) });
  });

  it("按日期升序（最早在前，今天在最后）", () => {
    const days = getRecentDays();
    expect(days[0].date < days[6].date).toBe(true);
  });
});