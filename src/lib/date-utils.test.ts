import { describe, it, expect, vi, beforeEach } from "vitest";

const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => store.set(k, v),
  removeItem: (k: string) => store.delete(k),
  clear: () => store.clear(),
});
vi.stubGlobal("window", { dispatchEvent: () => {} });

const { localDateStr, shiftDate, daysBetween } = await import("./date-utils");
const { addStudyTime, getStudySeconds, getStudySeries } = await import("./study-time");

describe("date-utils（R4.8）", () => {
  it("localDateStr 输出 YYYY-MM-DD", () => {
    expect(localDateStr(new Date(2026, 8, 5))).toBe("2026-09-05");
    expect(localDateStr(new Date(2026, 11, 31))).toBe("2026-12-31");
  });

  it("shiftDate 跨月/跨年加减", () => {
    expect(shiftDate("2026-09-01", -1)).toBe("2026-08-31");
    expect(shiftDate("2026-12-31", 1)).toBe("2027-01-01");
    expect(shiftDate("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("daysBetween 计算 b - a 天数", () => {
    expect(daysBetween("2026-09-04", "2026-09-05")).toBe(1);
    expect(daysBetween("2026-09-05", "2026-09-05")).toBe(0);
    expect(daysBetween("2026-09-05", "2026-09-04")).toBe(-1);
  });
});

describe("study-time 台账（R4.2）", () => {
  beforeEach(() => store.clear());

  it("按日期×来源累加，去重口径 total = max(read, quiz + replay)", () => {
    addStudyTime("read", 600, "2026-09-05");
    addStudyTime("quiz", 120, "2026-09-05");
    addStudyTime("replay", 60, "2026-09-05");
    const d = getStudySeconds("2026-09-05");
    expect(d.read).toBe(600);
    expect(d.quiz).toBe(120);
    expect(d.replay).toBe(60);
    // 600 > 180 → 取 read；重叠的做题时间不重复计
    expect(d.total).toBe(600);
  });

  it("quiz + replay 超过 read 时取交互时长", () => {
    addStudyTime("read", 60, "2026-09-06");
    addStudyTime("quiz", 300, "2026-09-06");
    addStudyTime("replay", 300, "2026-09-06");
    expect(getStudySeconds("2026-09-06").total).toBe(600);
  });

  it("非法输入忽略；单次超大值封顶 8h", () => {
    addStudyTime("read", -5, "2026-09-07");
    addStudyTime("read", NaN, "2026-09-07");
    addStudyTime("read", 100 * 3600, "2026-09-07");
    expect(getStudySeconds("2026-09-07").read).toBe(8 * 3600);
  });

  it("getStudySeries 返回近 n 天序列（旧→新）", () => {
    addStudyTime("read", 60, "2026-09-04");
    const series = getStudySeries(3, "2026-09-06");
    expect(series.map((d) => d.date)).toEqual(["2026-09-04", "2026-09-05", "2026-09-06"]);
    expect(series[0].total).toBe(60);
    expect(series[1].total).toBe(0);
  });
});
