import { describe, it, expect, vi, beforeEach } from "vitest";

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

const { getDailyGoalMin, setDailyGoalMin, GOAL_TIERS } = await import("./daily-goal");

describe("daily-goal（R4.1 分钟三档）", () => {
  beforeEach(() => store.clear());

  it("默认 15 分钟", () => {
    expect(getDailyGoalMin()).toBe(15);
  });

  it("只接受 5/15/30 三个档位，非法值回落 15", () => {
    for (const t of GOAL_TIERS) {
      setDailyGoalMin(t);
      expect(getDailyGoalMin()).toBe(t);
    }
    setDailyGoalMin(7);
    expect(getDailyGoalMin()).toBe(15);
    setDailyGoalMin(999);
    expect(getDailyGoalMin()).toBe(15);
  });
});
