import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock sync-layer（避免拉入 Supabase 客户端链）
vi.mock("./sync-layer", () => ({
  syncReplayHistoryWrite: vi.fn(),
  syncReplayBestUpsert: vi.fn(),
}));
vi.mock("./progress-helpers", () => ({
  tryDispatchProgressEvent: vi.fn(),
}));

const store = new Map<string, string>();
const localStorageMock = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => store.set(k, v),
  removeItem: (k: string) => store.delete(k),
};
vi.stubGlobal("localStorage", localStorageMock);
vi.stubGlobal("window", { dispatchEvent: vi.fn() });

const { readReplayHistory, saveReplayRecord, readReplayBest, saveReplayBest } =
  await import("./replay-store");

describe("replay-store", () => {
  beforeEach(() => store.clear());

  describe("readReplayHistory", () => {
    it("空时返回空数组", () => {
      expect(readReplayHistory()).toEqual([]);
    });

    it("损坏 JSON 返回空数组", () => {
      store.set("tb-replay-history", "not json");
      expect(readReplayHistory()).toEqual([]);
    });

    it("合法 JSON 中的非数组结构返回空数组", () => {
      store.set("tb-replay-history", "null");
      expect(readReplayHistory()).toEqual([]);
      store.set("tb-replay-history", JSON.stringify({ at: 1 }));
      expect(readReplayHistory()).toEqual([]);
    });

    it("过滤并修正损坏的历史记录", () => {
      store.set("tb-replay-history", JSON.stringify([
        { at: 1, symbol: "BTCUSDT", interval: "1h", total: 10, correct: 12, bestStreak: 8, durationSec: 20 },
        { at: "bad", symbol: "ETHUSDT", interval: "1h", total: 10, correct: 2, bestStreak: 1 },
        null,
      ]));
      expect(readReplayHistory()).toEqual([
        { at: 1, symbol: "BTCUSDT", interval: "1h", total: 10, correct: 10, bestStreak: 8, durationSec: 20 },
      ]);
    });
  });

  describe("saveReplayRecord + readReplayHistory", () => {
    it("追加一条记录", () => {
      saveReplayRecord({
        symbol: "BTCUSDT",
        interval: "1h",
        total: 10,
        correct: 7,
        bestStreak: 3,
      });
      const h = readReplayHistory();
      expect(h.length).toBe(1);
      expect(h[0].symbol).toBe("BTCUSDT");
      expect(h[0].correct).toBe(7);
      expect(typeof h[0].at).toBe("number");
    });

    it("超过 100 条只保留最近 100", () => {
      for (let i = 0; i < 105; i++) {
        saveReplayRecord({
          symbol: `S${i}`,
          interval: "1h",
          total: 5,
          correct: 3,
          bestStreak: 2,
        });
      }
      const h = readReplayHistory();
      expect(h.length).toBe(100);
      // 最早 5 条被裁掉
      expect(h[0].symbol).toBe("S5");
    });
  });

  describe("readReplayBest / saveReplayBest", () => {
    it("空时返回 0", () => {
      expect(readReplayBest()).toBe(0);
    });

    it("保存和读取", () => {
      saveReplayBest(42);
      expect(readReplayBest()).toBe(42);
    });

    it("损坏值返回 0（NaN guard）", () => {
      store.set("tb-replay-best", "not a number");
      expect(readReplayBest()).toBe(0);
    });

    it("拒绝负数和非整数最佳连击", () => {
      store.set("tb-replay-best", "-3");
      expect(readReplayBest()).toBe(0);
      store.set("tb-replay-best", "4.6");
      expect(readReplayBest()).toBe(5);
    });
  });
});
