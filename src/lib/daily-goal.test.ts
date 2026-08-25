import { describe, it, expect, beforeEach, vi } from "vitest";

const store = new Map<string, string>();
const localStorageMock = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => store.set(k, v),
  removeItem: (k: string) => store.delete(k),
  key: (i: number) => Array.from(store.keys())[i] ?? null,
  get length() {
    return store.size;
  },
  clear: () => store.clear(),
};
vi.stubGlobal("localStorage", localStorageMock);
vi.stubGlobal("window", { dispatchEvent: () => {} });

const { getDailyGoal, setDailyGoal, isGoalSetToday } = await import("./daily-goal");

describe("daily-goal", () => {
  beforeEach(() => store.clear());

  it("默认目标为正数", () => {
    expect(getDailyGoal()).toBeGreaterThan(0);
  });

  it("设置目标", () => {
    setDailyGoal(5);
    expect(getDailyGoal()).toBe(5);
  });

  it("无效目标被夹紧", () => {
    setDailyGoal(-1);
    expect(getDailyGoal()).toBeGreaterThan(0);
    setDailyGoal(999);
    expect(getDailyGoal()).toBeLessThanOrEqual(50);
  });

  it("未设目标时 isGoalSetToday=false", () => {
    expect(isGoalSetToday()).toBe(false);
  });
});
