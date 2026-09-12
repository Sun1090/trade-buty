import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => store.set(k, v),
  removeItem: (k: string) => store.delete(k),
  clear: () => store.clear(),
});
vi.stubGlobal("window", { dispatchEvent: () => {} });

const { addStudyTime, getStudySeconds, getTotalStudySeconds, getTodayStudySeconds } = await import(
  "./study-time"
);

beforeEach(() => store.clear());

describe("study-time 台账边界（R4.2）", () => {
  it("损坏的 localStorage JSON 回退为空台账，不抛错", () => {
    store.set("tb-study-time", "{不是 JSON");
    expect(getStudySeconds("2026-09-05").total).toBe(0);
  });

  it("按来源各自封顶 8h，多日累计只求和每日去重值", () => {
    addStudyTime("read", 10 * 3600, "2026-09-01"); // 封顶 8h
    addStudyTime("quiz", 3600, "2026-09-01");
    addStudyTime("read", 60, "2026-09-02");
    // Day1: read 被封顶 8h=28800，quiz 3600 → max(28800, 3600)=28800
    // Day2: max(60, 0)=60
    expect(getStudySeconds("2026-09-01").read).toBe(8 * 3600);
    expect(getTotalStudySeconds()).toBe(8 * 3600 + 60);
  });

  it("只保留最近 90 天，最旧条目被丢弃", () => {
    for (let i = 0; i < 95; i++) {
      const day = `2026-01-${String(i + 1).padStart(2, "0")}`;
      // 用不同月份避免非法日期干扰；这里只是键名递增
      addStudyTime("read", 10, `2026-${String(Math.floor(i / 28) + 1).padStart(2, "0")}-${String((i % 28) + 1).padStart(2, "0")}`);
      void day;
    }
    const ledger = JSON.parse(store.get("tb-study-time") ?? "{}") as Record<string, unknown>;
    expect(Object.keys(ledger).length).toBe(90);
  });

  it("同来源重复累加不覆盖", () => {
    addStudyTime("read", 120, "2026-09-05");
    addStudyTime("read", 180, "2026-09-05");
    expect(getStudySeconds("2026-09-05").read).toBe(300);
  });

  it("getTodayStudySeconds 使用本地日期", () => {
    const today = new Date();
    const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    addStudyTime("quiz", 45);
    expect(getTodayStudySeconds().date).toBe(key);
    expect(getTodayStudySeconds().quiz).toBe(45);
  });
});
