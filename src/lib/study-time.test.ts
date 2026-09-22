import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => store.set(k, v),
  removeItem: (k: string) => store.delete(k),
  clear: () => store.clear(),
});
vi.stubGlobal("window", { dispatchEvent: () => {} });

const { addStudyTime, getStudySeconds, getTotalStudySeconds, getTodayStudySeconds, STUDY_LEDGER_KEEP_DAYS } = await import(
  "./study-time"
);
const { shiftDate } = await import("./date-utils");

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

  it("台账按日历保留最近 90 天，窗口外的旧记录裁掉", () => {
    const newest = "2026-06-30";
    const edge = shiftDate(newest, -(STUDY_LEDGER_KEEP_DAYS - 1)); // 窗口内最后一天
    const stale = shiftDate(newest, -STUDY_LEDGER_KEEP_DAYS); // 差一天，落在窗口外
    addStudyTime("read", 10, stale);
    addStudyTime("read", 10, edge);
    addStudyTime("read", 10, newest);
    const ledger = JSON.parse(store.get("tb-study-time") ?? "{}") as Record<string, unknown>;
    expect(Object.keys(ledger).sort()).toEqual([edge, newest].sort());
  });

  it("稀疏用户（记录日横跨一年以上）也不会留下超出 90 天的台账", () => {
    for (let i = 0; i < 95; i++) {
      // 2026-01-01 … 2026-04-11：95 个记录日、101 个日历天
      const month = Math.floor(i / 28) + 1;
      const day = (i % 28) + 1;
      addStudyTime("read", 10, `2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
    }
    const ledger = JSON.parse(store.get("tb-study-time") ?? "{}") as Record<string, unknown>;
    const days = Object.keys(ledger).sort();
    expect(days.length).toBeLessThanOrEqual(STUDY_LEDGER_KEEP_DAYS);
    // 锚点是台账里最新的 2026-04-11，往前 90 天 = 2026-01-12，更早的 1 月上旬记录被裁掉
    expect(days[0]).toBe("2026-01-12");
    expect(days[days.length - 1]).toBe("2026-04-11");
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
