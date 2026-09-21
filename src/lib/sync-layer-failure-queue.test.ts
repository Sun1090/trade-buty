// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  setAuthState,
  syncProgressWrite,
  syncWrongbookWrite,
  syncWrongbookDelete,
  syncQuizUpsert,
  syncReplayHistoryWrite,
  syncGoalUpsert,
  syncReplayBestUpsert,
  syncWeeklyGoalUpsert,
} from "./sync-layer";
import { QUEUE_KEY, QUEUE_OWNER_KEY, loadQueueAndNextId } from "./sync-queue-store";

const memStore = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => memStore.get(key) ?? null,
  setItem: (key: string, value: string) => {
    memStore.set(key, value);
  },
  removeItem: (key: string) => {
    memStore.delete(key);
  },
  clear: () => memStore.clear(),
  key: () => null,
  length: 0,
};
Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
});

async function waitForQueue() {
  await vi.waitFor(() => expect(memStore.get(QUEUE_KEY)).not.toBeUndefined());
}

beforeEach(() => {
  memStore.clear();
  vi.unstubAllGlobals();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  setAuthState(false);
});

describe("sync-layer failure-to-queue boundaries", () => {
  it("未登录时写入直接返回，不触发 Supabase，也不入队", () => {
    syncProgressWrite("spot", "first-trade");

    expect(loadQueueAndNextId().queue).toEqual([]);
    expect(memStore.has(QUEUE_KEY)).toBe(false);
  });

  it("Supabase 未配置时仍入队 owner 队列，不向外抛错", async () => {
    setAuthState(true, "user-a");

    expect(() => syncProgressWrite("spot", "first-trade")).not.toThrow();
    await waitForQueue();

    expect(memStore.get(QUEUE_OWNER_KEY)).toBe("user-a");
    expect(loadQueueAndNextId().queue).toEqual([
      expect.objectContaining({
        kind: "progress",
        payloadKey: "spot:first-trade",
        payload: { chapter_num: "spot", doc_slug: "first-trade" },
      }),
    ]);
  });

  it.each([
    ["wrongbook-upsert", () => syncWrongbookWrite("spot", 2, 1, 3, "2026-09-20"), { chapter_num: "spot", question_idx: 2, picked: 1, srs_stage: 3, srs_due: "2026-09-20" }],
    ["wrongbook-delete", () => syncWrongbookDelete("spot", 2), { chapter_num: "spot", question_idx: 2 }],
    ["quiz", () => syncQuizUpsert("spot", 7, 10), { chapter_num: "spot", best: 7, total: 10 }],
    ["replay-history", () => syncReplayHistoryWrite({ symbol: "BTCUSDT", interval: "1h", total: 10, correct: 6, bestStreak: 3 }), { symbol: "BTCUSDT", interval: "1h", total: 10, correct: 6, best_streak: 3 }],
    ["goal", () => syncGoalUpsert(40), { daily_goal_min: 40 }],
    ["replay-best", () => syncReplayBestUpsert(12), { best_streak: 12 }],
    ["goal", () => syncWeeklyGoalUpsert(150), { weekly_goal_min: 150 }],
  ] as const)("Supabase 未配置时 %s 按稳定 payload 入队", async (kind, write, payload) => {
    setAuthState(true, "user-a");

    write();
    await waitForQueue();

    expect(loadQueueAndNextId().queue).toEqual([
      expect.objectContaining({ kind, payload }),
    ]);
  });

  // 「客户端构造得出来、但这一次写失败」的用例不在这里：`vi.doMock` + `vi.importActual`
  // 并不会替换被加载模块的依赖，本文件里那两条曾经以为自己测的是失败路径，实际走的是
  // 「Supabase 未配置」这一支（断言同样成立，但结论是假的）。
  // 真正的失败形态见 src/lib/sync-layer-write-failure.test.ts（静态 vi.mock）。
});
