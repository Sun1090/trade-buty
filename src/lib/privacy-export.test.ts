// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { buildPrivacyExport, downloadPrivacyExport } from "./privacy-export";

/**
 * jsdom 30 opaque origin → localStorage/sessionStorage getter 返回 undefined；
 * 兜底用内存版 stub。
 */
const memStore: Record<string, string> = {};
const memSession: Record<string, string> = {};
if (typeof globalThis.localStorage === "undefined" || !globalThis.localStorage) {
  const stub: Storage = {
    getItem: (k: string) => (k in memStore ? memStore[k] : null),
    setItem: (k: string, v: string) => { memStore[k] = v; },
    removeItem: (k: string) => { delete memStore[k]; },
    clear: () => { for (const k of Object.keys(memStore)) delete memStore[k]; },
    key: (i: number) => Object.keys(memStore)[i] ?? null,
    get length() { return Object.keys(memStore).length; },
  };
  try { Object.defineProperty(globalThis, "localStorage", { value: stub, configurable: true }); } catch { /* noop */ }
}
if (typeof globalThis.sessionStorage === "undefined" || !globalThis.sessionStorage) {
  const stub: Storage = {
    getItem: (k: string) => (k in memSession ? memSession[k] : null),
    setItem: (k: string, v: string) => { memSession[k] = v; },
    removeItem: (k: string) => { delete memSession[k]; },
    clear: () => { for (const k of Object.keys(memSession)) delete memSession[k]; },
    key: (i: number) => Object.keys(memSession)[i] ?? null,
    get length() { return Object.keys(memSession).length; },
  };
  try { Object.defineProperty(globalThis, "sessionStorage", { value: stub, configurable: true }); } catch { /* noop */ }
}
import { markRead } from "./progress";
import { recordWrong } from "./wrongbook";
import { touchStreak } from "./streak";
import { recordActivity } from "./activity-calendar";
import { touchLastVisit } from "./last-visit";
import { recordInvite } from "./invite-ref";

/**
 * R9.9 单测：隐私导出纯函数 buildPrivacyExport。
 * jsdom 提供 localStorage；sessionStorage 也是 jsdom。
 */

beforeEach(() => {
  try { if (typeof localStorage !== "undefined") localStorage.clear(); } catch { /* noop */ }
  try { if (typeof sessionStorage !== "undefined") sessionStorage.clear(); } catch { /* noop */ }
});

describe("buildPrivacyExport (R9.9)", () => {
  it("空数据时返回完整结构", () => {
    const exp = buildPrivacyExport(1_700_000_000_000);
    expect(exp.schemaVersion).toBe(1);
    expect(exp.exportedAt).toBe(new Date(1_700_000_000_000).toISOString());
    expect(exp.localStorage).toEqual({});
    expect(exp.progress.totalRead).toBe(0);
    expect(exp.progress.wrongCount).toBe(0);
    expect(exp.progress.currentStreak).toBe(0);
    expect(exp.progress.activityDates).toEqual([]);
    expect(exp.progress.readCounts).toEqual({});
    expect(exp.sync.pendingQueueLength).toBe(0);
    expect(exp.sync.onboarded).toBe(false);
    expect(exp.sync.inviteRef).toBeNull();
  });

  it("progress 正确汇总", () => {
    markRead("01", "a");
    markRead("01", "b");
    markRead("02", "x");
    const exp = buildPrivacyExport(1_700_000_000_000);
    expect(exp.progress.readCounts).toEqual({ "01": 2, "02": 1 });
    expect(exp.progress.totalRead).toBe(3);
  });

  it("wrongbook + srsStage 汇总", () => {
    recordWrong("01", 0, 2);
    recordWrong("01", 1, 3);
    const exp = buildPrivacyExport(1_700_000_000_000);
    expect(exp.progress.wrongCount).toBe(2);
    expect(exp.progress.srsStages).toEqual({ none: 2 });
    expect(exp.progress.wrongDetails).toHaveLength(2);
    expect(exp.progress.wrongDetails[0]).toMatchObject({
      key: "01:0",
      chapterNum: "01",
      questionIdx: 0,
      picked: 2,
    });
  });

  it("streak 透传", () => {
    touchStreak();
    const exp = buildPrivacyExport(1_700_000_000_000);
    expect(exp.progress.currentStreak).toBeGreaterThanOrEqual(1);
    expect(exp.progress.longestStreak).toBeGreaterThanOrEqual(1);
  });

  it("activity-calendar 记录活动", () => {
    recordActivity();
    const exp = buildPrivacyExport(1_700_000_000_000);
    expect(exp.progress.activityDates.length).toBeGreaterThanOrEqual(1);
  });

  it("last-visit 写入后被读到", () => {
    touchLastVisit(1_700_000_000_000);
    const exp = buildPrivacyExport(1_700_000_000_000);
    expect(exp.sync.lastVisitAt).toBe(1_700_000_000_000);
  });

  it("invite 写入后被读到", () => {
    recordInvite("abc123", 1_700_000_000_000);
    const exp = buildPrivacyExport(1_700_000_000_000);
    expect(exp.sync.inviteRef).toEqual({
      ref: "abc123",
      recordedAt: 1_700_000_000_000,
      expiresAt: 1_700_000_000_000 + 30 * 24 * 60 * 60 * 1000,
    });
  });

  it("localStorage 收集全部条目", () => {
    localStorage.setItem("tb-foo", "1");
    localStorage.setItem("tb-bar", "2");
    localStorage.setItem("ext-third-party", "3");
    const exp = buildPrivacyExport(1_700_000_000_000);
    expect(exp.localStorage).toEqual({ "tb-foo": "1", "tb-bar": "2", "ext-third-party": "3" });
  });

  it("JSON 序列化不抛错（可被 JSON.stringify）", () => {
    markRead("01", "a");
    recordWrong("01", 0, 2);
    const exp = buildPrivacyExport(1_700_000_000_000);
    const json = JSON.stringify(exp);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it("SSR 安全：无 localStorage 时返回空对象", () => {
    const original = globalThis.localStorage;
    try {
      Object.defineProperty(globalThis, "localStorage", { value: undefined, configurable: true, writable: true });
      const exp = buildPrivacyExport(1_700_000_000_000);
      expect(exp.localStorage).toEqual({});
      expect(exp.progress.totalRead).toBe(0);
    } finally {
      Object.defineProperty(globalThis, "localStorage", { value: original, configurable: true, writable: true });
    }
  });
});

describe("downloadPrivacyExport (R9.9)", () => {
  it("浏览器侧触发下载（不抛错）", () => {
    // mock createObjectURL / Blob / a.click
    const createObjectURL = vi.fn(() => "blob:mock");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { value: createObjectURL, configurable: true, writable: true });
    Object.defineProperty(URL, "revokeObjectURL", { value: revokeObjectURL, configurable: true, writable: true });
    expect(() => downloadPrivacyExport(1_700_000_000_000)).not.toThrow();
    expect(createObjectURL).toHaveBeenCalled();
  });

  it("下载文件名含日期前缀", () => {
    // spy document.createElement('a')
    const origCreate = document.createElement.bind(document);
    const aEl = origCreate("a");
    const setDownload = vi.fn();
    Object.defineProperty(aEl, "download", { set: setDownload, configurable: true });
    const spy = vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      if (tag === "a") return aEl;
      return origCreate(tag);
    });
    Object.defineProperty(URL, "createObjectURL", { value: () => "blob:mock", configurable: true, writable: true });
    downloadPrivacyExport(1_700_000_000_000);
    expect(setDownload).toHaveBeenCalled();
    const filename = setDownload.mock.calls[0][0] as string;
    expect(filename).toMatch(/^trade-buty-export-\d{4}-\d{2}-\d{2}\.json$/);
    spy.mockRestore();
  });
});
