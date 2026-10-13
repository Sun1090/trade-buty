import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => store.set(k, v),
  removeItem: (k: string) => store.delete(k),
  clear: () => store.clear(),
});
vi.stubGlobal("window", { dispatchEvent: () => {} });

const { addStudyTime, getStudySeconds, getTotalStudySeconds, getTodayStudySeconds, getStudyLedgerSpan, studyMinutes, STUDY_LEDGER_KEEP_DAYS } = await import(
  "./study-time"
);
const { DAILY_SOURCE_CAP_SEC } = await import("./study-caps");
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

  /**
   * 导出文件要点名「那 90 天」的头尾（R16.182）：台账锚在最新有记录的那一天，
   * 四个月没学习的人覆盖的并不是「导出日往前 90 天」，所以这两天得能问出来。
   */
  it("getStudyLedgerSpan 给出台账实际覆盖的头尾两天，与写入顺序无关", () => {
    expect(getStudyLedgerSpan()).toEqual({ firstDay: null, lastDay: null });
    addStudyTime("read", 10, "2026-04-11");
    addStudyTime("read", 10, "2026-01-12");
    addStudyTime("read", 10, "2026-03-02");
    expect(getStudyLedgerSpan()).toEqual({ firstDay: "2026-01-12", lastDay: "2026-04-11" });
  });

  it("形状不对的台账键不算进窗口边界", () => {
    store.set("tb-study-time", JSON.stringify({ "2026-9-5": { read: 10 }, later: { read: 10 }, "2026-09-05": { read: 10 } }));
    expect(getStudyLedgerSpan()).toEqual({ firstDay: "2026-09-05", lastDay: "2026-09-05" });
  });

  it("同来源重复累加不覆盖", () => {
    addStudyTime("read", 120, "2026-09-05");
    addStudyTime("read", 180, "2026-09-05");
    expect(getStudySeconds("2026-09-05").read).toBe(300);
  });

  /**
   * R16.320：读旧台账时那第二道闸此前**零覆盖**——所有用例都走 `addStudyTime`，
   * 而写侧已经夹过一次，所以读侧那道闸在测试里从来没被单独试过：实测把它改成 12h，
   * 当时本文件 12 条全绿（R16.320 修复前）。能喂进超限值的现实路径是外部写入（别的标签页、导出文件回填、
   * 用户自己开控制台），那时读侧是唯一的闸。
   */
  it("外部写坏的超限值由读侧夹回上限（不靠写侧那一刀）", () => {
    store.set("tb-study-time", JSON.stringify({ "2026-09-05": { read: 100 * 3600, quiz: 100 * 3600 } }));
    const day = getStudySeconds("2026-09-05");
    expect(day.read).toBe(DAILY_SOURCE_CAP_SEC);
    expect(day.quiz).toBe(DAILY_SOURCE_CAP_SEC);
    // 去重口径 max(read, quiz+replay) 也必须在夹完之后才算，否则超限值还能借加法漏回来
    expect(day.total).toBe(DAILY_SOURCE_CAP_SEC);
  });

  it("上限只有一个主人：写侧与读侧夹的是同一个数", () => {
    // 先证行为：同一笔超限值，走写入路径与走外部写入路径必须给出同一个读数
    addStudyTime("read", 100 * 3600, "2026-09-06");
    const viaWrite = getStudySeconds("2026-09-06").read;
    store.set("tb-study-time", JSON.stringify({ "2026-09-07": { read: 100 * 3600 } }));
    const viaRead = getStudySeconds("2026-09-07").read;
    expect(viaRead, "两道闸分叉了：外部写入的超限值与累加路径给出的数不同").toBe(viaWrite);
    expect(viaWrite).toBe(DAILY_SOURCE_CAP_SEC);
  });
  it("getTodayStudySeconds 使用本地日期", () => {
    const today = new Date();
    const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    addStudyTime("quiz", 45);
    expect(getTodayStudySeconds().date).toBe(key);
    expect(getTodayStudySeconds().quiz).toBe(45);
  });
});

describe("studyMinutes：台账秒数 → 分钟的唯一口径", () => {
  it("先加秒、后取整：7 天各 30 秒是 3 分钟，不是逐日取整的和", () => {
    const days = [30, 30, 30, 30, 30, 30, 30];
    const weekTotal = days.reduce((a, b) => a + b, 0);
    expect(studyMinutes(weekTotal)).toBe(3);
    // 反面（R4.10 之前的写法）：逐日取整再相加，30 秒的一天被抬成「1 分钟」
    const perDayThenSum = days.reduce((a, d) => a + studyMinutes(d), 0);
    expect(perDayThenSum).not.toBe(studyMinutes(weekTotal));
  });

  it("向下取整不放松口径：59 秒算 0 分钟，满 60 秒才算 1 分钟", () => {
    expect(studyMinutes(59)).toBe(0);
    expect(studyMinutes(60)).toBe(1);
    expect(studyMinutes(119)).toBe(1);
    expect(studyMinutes(210)).toBe(3);
  });

  it("非有限输入按 0 处理，不把 NaN 漏进界面文案", () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(studyMinutes(bad), String(bad)).toBe(0);
    }
  });

  it("台账这一侧不会喂进负数：写坏的值读回来是 0 秒", () => {
    store.set("tb-study-time", JSON.stringify({ "2026-09-05": { read: -600 } }));
    expect(getStudySeconds("2026-09-05").total).toBe(0);
    expect(studyMinutes(getStudySeconds("2026-09-05").total)).toBe(0);
  });
});
