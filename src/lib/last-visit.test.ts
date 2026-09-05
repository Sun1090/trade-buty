// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  touchLastVisit,
  getLastVisitAt,
  markNudgeShown,
  getLastNudgeShownAt,
  shouldShowReturnNudge,
  daysSinceLastVisit,
  RETURN_NUDGE_INTERVAL_MS,
} from "./last-visit";

/**
 * R9.8 单测：7 天未访温和提示逻辑。
 * 顶部声明 jsdom 环境；jsdom 没装好时回落到内存 stub。
 */

const memStore: Record<string, string> = {};
if (typeof globalThis.localStorage === "undefined" || !globalThis.localStorage) {
  const stub: Storage = {
    getItem: (k: string) => (k in memStore ? memStore[k] : null),
    setItem: (k: string, v: string) => { memStore[k] = v; },
    removeItem: (k: string) => { delete memStore[k]; },
    clear: () => { for (const k of Object.keys(memStore)) delete memStore[k]; },
    key: (i: number) => Object.keys(memStore)[i] ?? null,
    get length() { return Object.keys(memStore).length; },
  };
  try {
    Object.defineProperty(globalThis, "localStorage", { value: stub, configurable: true });
  } catch { /* noop */ }
}

beforeEach(() => {
  if (typeof localStorage !== "undefined") localStorage.clear();
  vi.useRealTimers();
});

describe("last-visit basic IO (R9.8)", () => {
  it("初始无记录：getLastVisitAt 返回 null", () => {
    expect(getLastVisitAt()).toBeNull();
  });

  it("touchLastVisit 后能读回", () => {
    touchLastVisit(1_000_000);
    expect(getLastVisitAt()).toBe(1_000_000);
  });

  it("markNudgeShown 后能读回", () => {
    markNudgeShown(5_000_000);
    expect(getLastNudgeShownAt()).toBe(5_000_000);
  });

  it("字段防御：storage 里有非数字值 → 视为无记录", () => {
    localStorage.setItem("tb-last-visit", "not-a-number");
    expect(getLastVisitAt()).toBeNull();
  });

  it("字段防御：storage 里有负数 → 视为无记录", () => {
    localStorage.setItem("tb-last-visit", "-1000");
    expect(getLastVisitAt()).toBeNull();
  });

  it("RETURN_NUDGE_INTERVAL_MS 等于 7d", () => {
    expect(RETURN_NUDGE_INTERVAL_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });
});

describe("shouldShowReturnNudge (R9.8)", () => {
  it("首次访问（无 lastVisit）不弹", () => {
    expect(shouldShowReturnNudge(Date.now())).toBe(false);
  });

  it("6 天前访问过不弹", () => {
    const now = 10 * 24 * 60 * 60 * 1000;
    touchLastVisit(now - 6 * 24 * 60 * 60 * 1000);
    expect(shouldShowReturnNudge(now)).toBe(false);
  });

  it("7 天前访问过且从未弹过提示 → true", () => {
    const now = 10 * 24 * 60 * 60 * 1000;
    touchLastVisit(now - 7 * 24 * 60 * 60 * 1000);
    expect(shouldShowReturnNudge(now)).toBe(true);
  });

  it("10 天前访问过且从未弹过 → true", () => {
    const now = 10 * 24 * 60 * 60 * 1000;
    touchLastVisit(now - 10 * 24 * 60 * 60 * 1000);
    expect(shouldShowReturnNudge(now)).toBe(true);
  });

  it("7d 内已经弹过 → false（防抖）", () => {
    const now = 10 * 24 * 60 * 60 * 1000;
    touchLastVisit(now - 8 * 24 * 60 * 60 * 1000);
    markNudgeShown(now - 2 * 24 * 60 * 60 * 1000);
    expect(shouldShowReturnNudge(now)).toBe(false);
  });

  it("上次弹距今 ≥ 7d → 重新弹", () => {
    const now = 30 * 24 * 60 * 60 * 1000;
    touchLastVisit(now - 8 * 24 * 60 * 60 * 1000);
    markNudgeShown(now - 8 * 24 * 60 * 60 * 1000);
    expect(shouldShowReturnNudge(now)).toBe(true);
  });

  it("超过 90d 未访 → false（视为断签）", () => {
    const now = 200 * 24 * 60 * 60 * 1000;
    touchLastVisit(now - 100 * 24 * 60 * 60 * 1000);
    expect(shouldShowReturnNudge(now)).toBe(false);
  });
});

describe("daysSinceLastVisit (R9.8)", () => {
  it("正常值", () => {
    const now = 200_000_000_000;
    touchLastVisit(now - 3 * 24 * 60 * 60 * 1000);
    expect(daysSinceLastVisit(now)).toBe(3);
  });

  it("无记录 → null", () => {
    expect(daysSinceLastVisit(Date.now())).toBeNull();
  });

  it("时间在未来 → 0", () => {
    const now = 200_000_000_000;
    touchLastVisit(now + 5000);
    expect(daysSinceLastVisit(now)).toBe(0);
  });
});

describe("last-visit SSR safety (R9.8)", () => {
  let originalDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  });

  afterEach(() => {
    if (originalDescriptor) {
      Object.defineProperty(globalThis, "localStorage", originalDescriptor);
    }
  });

  it("无 localStorage 时所有函数静默", () => {
    Object.defineProperty(globalThis, "localStorage", { value: undefined, configurable: true, writable: true });
    expect(() => touchLastVisit(1234)).not.toThrow();
    expect(getLastVisitAt()).toBeNull();
    expect(getLastNudgeShownAt()).toBeNull();
    expect(shouldShowReturnNudge(Date.now())).toBe(false);
    expect(daysSinceLastVisit(Date.now())).toBeNull();
    expect(() => markNudgeShown(1234)).not.toThrow();
  });
});
