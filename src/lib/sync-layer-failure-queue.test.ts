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

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function asyncRejectingClient(error: Error) {
  return {
    from: vi.fn(() => ({
      insert: () => Promise.reject(error),
      upsert: () => Promise.reject(error),
      delete: () => ({ eq: () => ({ eq: () => Promise.reject(error) }) }),
    })),
  };
}

async function waitForQueue() {
  await vi.waitFor(() => expect(memStore.get(QUEUE_KEY)).not.toBeUndefined());
}

async function flushMicrotasks() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
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

  it("Supabase 查询失败会入队，并保留 owner 队列", async () => {
    vi.doMock("@/lib/supabase/client", () => ({ getSupabaseBrowser: () => asyncRejectingClient(new Error("offline")) }));
    const { setAuthState: localSetAuthState, syncProgressWrite: localSyncProgressWrite } = await vi.importActual<typeof import("./sync-layer")>("./sync-layer");
    localSetAuthState(true, "user-a");

    localSyncProgressWrite("spot", "first-trade");
    await waitForQueue();

    expect(loadQueueAndNextId().queue).toEqual([
      expect.objectContaining({ kind: "progress", payloadKey: "spot:first-trade", payload: { chapter_num: "spot", doc_slug: "first-trade" } }),
    ]);
  });

  it("Supabase 失败入队前用户已切换账号时，不写入旧账号队列", async () => {
    const rejected = deferred<never>();
    const writePromise = rejected.promise.catch(() => undefined);
    vi.doMock("@/lib/supabase/client", () => ({
      getSupabaseBrowser: () => ({
        from: () => ({ insert: () => rejected.promise }),
      }),
    }));
    const { setAuthState: localSetAuthState, syncProgressWrite: localSyncProgressWrite } = await vi.importActual<typeof import("./sync-layer")>("./sync-layer");
    localSetAuthState(true, "user-a");
    localSyncProgressWrite("spot", "first-trade");
    localSetAuthState(true, "user-b");
    rejected.reject(new Error("offline"));
    await writePromise;
    await flushMicrotasks();

    expect(memStore.has(QUEUE_KEY)).toBe(false);
  });
});
