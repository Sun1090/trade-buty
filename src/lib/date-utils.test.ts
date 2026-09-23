import { describe, it, expect, vi, beforeEach } from "vitest";

const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => store.set(k, v),
  removeItem: (k: string) => store.delete(k),
  clear: () => store.clear(),
});
vi.stubGlobal("window", { dispatchEvent: () => {} });

const { localDateStr, isLocalDateStr, localDayEndMs, shiftDate, daysBetween } =
  await import("./date-utils");
const { addStudyTime, getStudySeconds, getStudySeries, getTotalStudySeconds } = await import("./study-time");

describe("date-utils（R4.8）", () => {
  it("localDateStr 输出 YYYY-MM-DD", () => {
    expect(localDateStr(new Date(2026, 8, 5))).toBe("2026-09-05");
    expect(localDateStr(new Date(2026, 11, 31))).toBe("2026-12-31");
  });

  it("isLocalDateStr 拒绝格式正确但不存在的日历日期", () => {
    expect(isLocalDateStr("2024-02-29")).toBe(true);
    expect(isLocalDateStr("2026-02-29")).toBe(false);
    expect(isLocalDateStr("2026-02-31")).toBe(false);
    expect(isLocalDateStr("2026-13-01")).toBe(false);
    expect(isLocalDateStr("2026-00-10")).toBe(false);
    expect(isLocalDateStr("2026-9-01")).toBe(false);
  });

  it("localDayEndMs 给出该本地日的最后一毫秒", () => {
    for (const dateStr of ["2026-09-05", "2024-02-29", "2026-12-31", "2027-01-01"]) {
      const ms = localDayEndMs(dateStr);
      expect(localDateStr(new Date(ms)), `${dateStr} 应落在该日内`).toBe(dateStr);
      expect(localDateStr(new Date(ms + 1))).toBe(shiftDate(dateStr, 1));
    }
  });

  it("跨时区都按本地日历取，不吃 UTC 口径", () => {
    const original = process.env.TZ;
    const restore = () => {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    };
    try {
      // CI 恒为 UTC，那里「本地」与「UTC」不可区分；必须钉住东西两侧各一个时区
      for (const tz of ["Asia/Shanghai", "America/New_York"]) {
        process.env.TZ = tz;
        const ms = localDayEndMs("2026-09-05");
        expect(localDateStr(new Date(ms)), `${tz} 应落回当日`).toBe("2026-09-05");
        expect(localDateStr(new Date(ms + 1)), `${tz} 的 1ms 后应进次日`).toBe("2026-09-06");
      }
    } finally {
      restore();
    }
  });

  it("localDayEndMs 对不存在的日历日期返回 NaN，而不是滚到邻近日期", () => {
    for (const bad of ["2026-02-31", "2026-13-01", "2026-9-1", "", "2026-09-05T00:00:00Z"]) {
      expect(Number.isNaN(localDayEndMs(bad)), `${bad} 不该被接受`).toBe(true);
    }
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

  it("合法 JSON 中的非对象台账不会导致读写崩溃", () => {
    store.set("tb-study-time", "null");
    expect(getStudySeconds("2026-09-05").total).toBe(0);
    addStudyTime("read", 60, "2026-09-05");
    expect(getStudySeconds("2026-09-05").read).toBe(60);
    expect(getTotalStudySeconds()).toBe(60);
  });

  it("过滤损坏日期、非对象日条目和非法时长", () => {
    store.set(
      "tb-study-time",
      JSON.stringify({
        "2026-09-05": { read: 120, quiz: -1, replay: "30" },
        "not-a-date": { read: 500 },
        "2026-09-06": null,
        "2026-09-07": { read: Number.NaN, quiz: Infinity },
      }),
    );
    expect(getStudySeconds("2026-09-05")).toMatchObject({ read: 120, quiz: 0, replay: 0, total: 120 });
    expect(getTotalStudySeconds()).toBe(120);
  });
});
