// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  hasOnboarded,
  getCurrentStep,
  advanceStep,
  setStep,
  markDone,
  resetOnboarding,
  ONBOARDING_STORAGE_KEY,
  ONBOARD_STEPS,
} from "./onboarding";

/**
 * R8.6 onboarding 纯逻辑单测。
 * jsdom 30 opaque origin → 内存 stub localStorage（同 invite-ref.test.ts）。
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
  localStorage.clear();
  vi.useRealTimers();
});

describe("onboarding initial state", () => {
  it("未写过 storage 时未完成", () => {
    expect(hasOnboarded()).toBe(false);
    expect(getCurrentStep()).toBeNull();
  });

  it("ONBOARD_STEPS 是 path / replay / review 顺序", () => {
    expect(ONBOARD_STEPS).toEqual(["path", "replay", "review"]);
  });
});

describe("onboarding step 推进", () => {
  it("setStep 后 getCurrentStep 返回该步", () => {
    setStep("path");
    expect(getCurrentStep()).toBe("path");
    expect(hasOnboarded()).toBe(false);
  });

  it("advanceStep 从 path 到 replay", () => {
    setStep("path");
    expect(advanceStep("path")).toBe("replay");
    expect(getCurrentStep()).toBe("replay");
  });

  it("advanceStep 从 replay 到 review", () => {
    setStep("replay");
    expect(advanceStep("replay")).toBe("review");
    expect(getCurrentStep()).toBe("review");
  });

  it("advanceStep 到 review 后再 advanceStep 标记 done", () => {
    setStep("review");
    expect(advanceStep("review")).toBe("done");
    expect(hasOnboarded()).toBe(true);
    expect(getCurrentStep()).toBeNull();
  });

  it("markDone 直接标记完成", () => {
    markDone();
    expect(hasOnboarded()).toBe(true);
    expect(localStorage.getItem(ONBOARDING_STORAGE_KEY)).toBe("1");
  });

  it("resetOnboarding 清掉", () => {
    markDone();
    resetOnboarding();
    expect(hasOnboarded()).toBe(false);
    expect(getCurrentStep()).toBeNull();
  });
});

describe("onboarding 存储防御", () => {
  it("读到 1 时视为完成", () => {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, "1");
    expect(hasOnboarded()).toBe(true);
  });

  it("读到非法字符串时视为未完成", () => {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, "garbage");
    expect(hasOnboarded()).toBe(false);
    expect(getCurrentStep()).toBeNull();
  });

  it("读到 'path' / 'replay' / 'review' 时能解析", () => {
    for (const s of ["path", "replay", "review"] as const) {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, s);
      expect(getCurrentStep()).toBe(s);
    }
  });

  it("advanceStep 越界 current 时直接 done", () => {
    expect(advanceStep("bogus" as never)).toBe("done");
  });
});
