import { describe, it, expect, vi, beforeEach } from "vitest";

const store = new Map<string, string>();
let localStorageMode: "normal" | "throw" = "normal";
let windowDispatches: string[] = [];
const localStorageMock = {
  getItem: (k: string) => {
    if (localStorageMode === "throw") throw new Error("storage unavailable");
    return store.get(k) ?? null;
  },
  setItem: (k: string, v: string) => {
    if (localStorageMode === "throw") throw new Error("storage unavailable");
    store.set(k, v);
  },
  removeItem: (k: string) => store.delete(k),
  key: (i: number) => Array.from(store.keys())[i] ?? null,
  get length() {
    return store.size;
  },
  clear: () => store.clear(),
};
vi.stubGlobal("localStorage", localStorageMock);
vi.stubGlobal("window", { dispatchEvent: (event: Event) => windowDispatches.push(event.type) });

const dateUtils = await import("./date-utils");

const { getDailyGoalMin, setDailyGoalMin, GOAL_TIERS } = await import("./daily-goal");

describe("daily-goal（R4.1 分钟三档）", () => {
  beforeEach(() => {
    store.clear();
    localStorageMode = "normal";
    windowDispatches = [];
  });

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

describe("daily-goal storage and study-minute fallbacks", () => {
  it("falls back to 15 when localStorage rejects reads", () => {
    localStorageMode = "throw";

    expect(getDailyGoalMin()).toBe(15);
  });

  it("converts today's ledger seconds to whole study minutes", async () => {
    localStorageMode = "normal";
    const dateNowSpy = vi.spyOn(Date, "now").mockReturnValue(Date.UTC(2026, 8, 21, 16));
    const localDateStrSpy = vi.spyOn(dateUtils, "localDateStr").mockReturnValue("2026-09-21");
    const { getTodayStudyMinutes } = await import("./daily-goal");
    const { addStudyTime } = await import("./study-time");
    const today = "2026-09-21";
    try {
      addStudyTime("read", 119, today);
      expect(getTodayStudyMinutes()).toBe(1);
    } finally {
      dateNowSpy.mockRestore();
      localDateStrSpy.mockRestore();
    }
  });
});
