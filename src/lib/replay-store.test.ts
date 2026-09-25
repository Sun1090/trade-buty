import { describe, it, expect, beforeEach, vi } from "vitest";
import { REPLAY_HISTORY_KEEP } from "./replay-history-limit";

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
const { syncReplayBestUpsert } = await import("./sync-layer");

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

    it("交给云端的 at 与本地这条完全一致（否则合并认不出同一轮，每轮被记两次）", async () => {
      const { syncReplayHistoryWrite } = await import("./sync-layer");
      vi.mocked(syncReplayHistoryWrite).mockClear();

      saveReplayRecord({ symbol: "BTCUSDT", interval: "1h", total: 10, correct: 7, bestStreak: 3 });

      const local = readReplayHistory()[0];
      expect(vi.mocked(syncReplayHistoryWrite)).toHaveBeenCalledWith(
        expect.objectContaining({ symbol: "BTCUSDT", at: local.at }),
      );
    });

    it("超过上限只保留最近 REPLAY_HISTORY_KEEP 条", () => {
      for (let i = 0; i < REPLAY_HISTORY_KEEP + 5; i++) {
        saveReplayRecord({
          symbol: `S${i}`,
          interval: "1h",
          total: 5,
          correct: 3,
          bestStreak: 2,
        });
      }
      const h = readReplayHistory();
      expect(h.length).toBe(REPLAY_HISTORY_KEEP);
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

    /**
     * `replay-trainer` 的 `best` 是**本轮**的最佳连胜，每轮从 0 起，所以每一轮第一次
     * 答错都会带着 0 来调这个函数。以前它是无条件 `setItem`，那一句话就能把这个人
     * 攒了几个月的历史最佳抹掉（云端 `replay_best` 也跟着被 0 upsert 覆盖）；
     * 那句「仅当超过当前记录时调用」原本只是写在注释里，约束落在并不守它的调用方。
     */
    it("更小的值不许覆盖已有记录（本轮归零后第一次答错带着 0 来调）", () => {
      store.clear();
      vi.mocked(syncReplayBestUpsert).mockClear();
      saveReplayBest(12);
      expect(readReplayBest()).toBe(12);

      saveReplayBest(0);
      saveReplayBest(5);
      saveReplayBest(12);
      expect(readReplayBest(), "本轮的 0 把历史最佳抹掉了").toBe(12);
      expect(store.get("tb-replay-best")).toBe("12");
      expect(vi.mocked(syncReplayBestUpsert).mock.calls, "云端也被那些更小的值 upsert 过").toEqual([
        [12],
      ]);

      saveReplayBest(13);
      expect(readReplayBest()).toBe(13);
      expect(vi.mocked(syncReplayBestUpsert)).toHaveBeenLastCalledWith(13);
    });
  });
});
