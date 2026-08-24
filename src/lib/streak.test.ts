import { describe, it, expect, beforeEach, vi } from "vitest";

const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => store.set(k, v),
  removeItem: (k: string) => store.delete(k),
});
vi.stubGlobal("window", { dispatchEvent: vi.fn() });

const { readStreak, touchStreak, getCurrentStreak } = await import("./streak");

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
    expect(readStreak()).toEqual({ lastDate: "", current: 0, longest: 0 });
    expect(getCurrentStreak()).toBe(0);
  });
});
