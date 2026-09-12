import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => store.set(k, v),
  removeItem: (k: string) => store.delete(k),
  clear: () => store.clear(),
});

const { readActivityDates, recordActivity } = await import("./activity-calendar");

beforeEach(() => {
  store.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("activity-calendar", () => {
  it("空存储返回空数组", () => {
    expect(readActivityDates()).toEqual([]);
  });

  it("损坏 JSON 回退为空数组，不抛错", () => {
    store.set("tb-activity", "not-json");
    expect(readActivityDates()).toEqual([]);
  });

  it("当天重复记录只留一条", () => {
    vi.setSystemTime(new Date(2026, 8, 13, 10, 0, 0));
    recordActivity();
    recordActivity();
    recordActivity();
    expect(readActivityDates()).toEqual(["2026-09-13"]);
  });

  it("不同日期累积记录（按本地日期字符串）", () => {
    vi.setSystemTime(new Date(2026, 8, 12, 10, 0, 0));
    recordActivity();
    vi.setSystemTime(new Date(2026, 8, 13, 10, 0, 0));
    recordActivity();
    expect(readActivityDates()).toEqual(["2026-09-12", "2026-09-13"]);
  });

  it("最多保留最近 365 天，最旧被截断", () => {
    const existing = Array.from({ length: 365 }, (_, i) => `2025-${String(Math.floor(i / 31) + 1).padStart(2, "0")}-${String((i % 31) + 1).padStart(2, "0")}`);
    store.set("tb-activity", JSON.stringify(existing));
    vi.setSystemTime(new Date(2026, 8, 13, 10, 0, 0));
    recordActivity();
    const dates = readActivityDates();
    expect(dates).toHaveLength(365);
    expect(dates[dates.length - 1]).toBe("2026-09-13");
    expect(dates).not.toContain(existing[0]);
  });
});
