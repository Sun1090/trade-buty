// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";

// 内存 localStorage（jsdom 30 opaque origin）
const memStore = new Map<string, string>();
const localStorageMock = {
  getItem: (k: string) => memStore.get(k) ?? null,
  setItem: (k: string, v: string) => memStore.set(k, v),
  removeItem: (k: string) => memStore.delete(k),
  clear: () => memStore.clear(),
  key: () => null,
  length: 0,
};
Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
});

// 让 mockInsert/Upsert/Delete 返回真正可控的 Promise；成功或失败由 .mockResolvedValueOnce / .mockRejectedValueOnce 切换
const mockInsert = vi.fn();
const mockUpsert = vi.fn();
const mockDeleteEq = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowser: () => ({
    from: (_table: string) => ({
      insert: (...args: unknown[]) => mockInsert(...args),
      upsert: (...args: unknown[]) => mockUpsert(...args),
      delete: () => {
        // 支持链式 .eq().eq().eq()：每次 eq 返回新对象，第 3 次返回 thenable
        const make = (depth: number) => {
          const obj: Record<string, unknown> = {
            eq: () => make(depth + 1),
          };
          if (depth >= 3) {
            // final call after 3 .eq()s: the result is thenable
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            obj.then = (onF: any, onR?: any) => mockDeleteEq().then(onF, onR);
          }
          return obj;
        };
        return make(0);
      },
    }),
  }),
}));

import {
  syncProgressWrite,
  syncWrongbookWrite,
  syncWrongbookDelete,
  syncQuizUpsert,
  syncReplayHistoryWrite,
  syncReplayBestUpsert,
  syncGoalUpsert,
  setAuthState,
} from "./sync-layer";
import { getQueueLength, QUEUE_KEY } from "./sync-queue-store";

beforeEach(() => {
  memStore.clear();
  mockInsert.mockReset();
  mockUpsert.mockReset();
  mockDeleteEq.mockReset();
  // 缺省：全部成功（返回带 thenable 的对象，让 .then / .catch 链正常工作）
  // Supabase PostgREST 的链是 promise-like 但不是真正的 Promise，所以我们需要
  // 返回的对象既能 .then(fulfilled) 也能 .then(_, rejected)
  const successChain = Promise.resolve({ data: null });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockInsert.mockImplementation(() => ({ then: successChain.then.bind(successChain) }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockUpsert.mockImplementation(() => ({ then: successChain.then.bind(successChain) }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockDeleteEq.mockImplementation(() => ({ then: successChain.then.bind(successChain) }));
  setAuthState(true, "user-queue-1");
});

const flush = () => new Promise<void>((r) => setTimeout(r, 0));

// ============================================================
// sync-layer writes 失败时入队
// ============================================================

describe("R9.5 sync-layer 写入失败入队", () => {
  it("syncProgressWrite 成功时不入队", async () => {
    syncProgressWrite("ch1", "doc-a");
    await flush();
    expect(getQueueLength()).toBe(0);
  });

  it("syncProgressWrite 失败时入队 kind=progress", async () => {
    const failing = Promise.reject(new Error("network"));
    // 阻止 unhandled rejection 警告
    failing.catch(() => {});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockInsert.mockImplementationOnce(() => ({ then: failing.then.bind(failing) }));
    syncProgressWrite("getting-started", "doc-a");
    await flush();
    await flush();
    expect(getQueueLength()).toBe(1);
    const stored = JSON.parse(memStore.get(QUEUE_KEY)!);
    expect(stored[0]).toMatchObject({
      kind: "progress",
      payloadKey: "getting-started:doc-a",
      payload: { chapter_num: "getting-started", doc_slug: "doc-a" },
    });
  });

  it("syncWrongbookWrite 失败 → kind=wrongbook-upsert", async () => {
    const failing = Promise.reject(new Error("boom"));
    failing.catch(() => {});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUpsert.mockImplementationOnce(() => ({ then: failing.then.bind(failing) }));
    syncWrongbookWrite("ch1", 3, 2, 4, "2026-02-01");
    await flush();
    await flush();
    expect(getQueueLength()).toBe(1);
    const stored = JSON.parse(memStore.get(QUEUE_KEY)!);
    expect(stored[0]).toMatchObject({
      kind: "wrongbook-upsert",
      payloadKey: "ch1:3",
      payload: { chapter_num: "ch1", question_idx: 3, picked: 2 },
    });
  });

  it("syncWrongbookDelete 失败 → kind=wrongbook-delete", async () => {
    const failing = Promise.reject(new Error("denied"));
    failing.catch(() => {});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockDeleteEq.mockImplementationOnce(() => ({ then: failing.then.bind(failing) }));
    syncWrongbookDelete("ch1", 5);
    await flush();
    await flush();
    expect(getQueueLength()).toBe(1);
    const stored = JSON.parse(memStore.get(QUEUE_KEY)!);
    expect(stored[0].kind).toBe("wrongbook-delete");
    expect(stored[0].payloadKey).toBe("ch1:5");
  });

  it("syncQuizUpsert 失败 → kind=quiz", async () => {
    const failing = Promise.reject(new Error("503"));
    failing.catch(() => {});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUpsert.mockImplementationOnce(() => ({ then: failing.then.bind(failing) }));
    syncQuizUpsert("ch1", 8, 10);
    await flush();
    await flush();
    expect(getQueueLength()).toBe(1);
    const stored = JSON.parse(memStore.get(QUEUE_KEY)!);
    expect(stored[0]).toMatchObject({
      kind: "quiz",
      payloadKey: "ch1",
      payload: { chapter_num: "ch1", best: 8, total: 10 },
    });
  });

  it("syncReplayHistoryWrite 失败 → kind=replay-history", async () => {
    const failing = Promise.reject(new Error("timeout"));
    failing.catch(() => {});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockInsert.mockImplementationOnce(() => ({ then: failing.then.bind(failing) }));
    syncReplayHistoryWrite({
      symbol: "BTCUSDT",
      interval: "1h",
      total: 10,
      correct: 5,
      bestStreak: 3,
    });
    await flush();
    await flush();
    expect(getQueueLength()).toBe(1);
    const stored = JSON.parse(memStore.get(QUEUE_KEY)!);
    expect(stored[0].kind).toBe("replay-history");
    expect(stored[0].payload.symbol).toBe("BTCUSDT");
  });

  it("syncReplayBestUpsert 失败 → kind=replay-best", async () => {
    const failing = Promise.reject(new Error("RLS"));
    failing.catch(() => {});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUpsert.mockImplementationOnce(() => ({ then: failing.then.bind(failing) }));
    syncReplayBestUpsert(15);
    await flush();
    await flush();
    expect(getQueueLength()).toBe(1);
    const stored = JSON.parse(memStore.get(QUEUE_KEY)!);
    expect(stored[0]).toMatchObject({
      kind: "replay-best",
      payloadKey: "global",
      payload: { best_streak: 15 },
    });
  });

  it("syncGoalUpsert 失败 → kind=goal", async () => {
    const failing = Promise.reject(new Error("offline"));
    failing.catch(() => {});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUpsert.mockImplementationOnce(() => ({ then: failing.then.bind(failing) }));
    syncGoalUpsert(25);
    await flush();
    await flush();
    expect(getQueueLength()).toBe(1);
    const stored = JSON.parse(memStore.get(QUEUE_KEY)!);
    expect(stored[0]).toMatchObject({
      kind: "goal",
      payloadKey: "daily-goal",
      payload: { daily_goal_min: 25 },
    });
  });

  it("未登录时不发起 supabase 也不入队", () => {
    setAuthState(false);
    syncProgressWrite("ch1", "doc-a");
    syncQuizUpsert("ch1", 8, 10);
    syncGoalUpsert(20);
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();
    expect(getQueueLength()).toBe(0);
  });

  it("同 kind+key 多次失败 → 去重只入队一条", async () => {
    const failing = Promise.reject(new Error("net"));
    failing.catch(() => {});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockInsert.mockImplementation(() => ({ then: failing.then.bind(failing) }));
    syncProgressWrite("ch1", "doc-a");
    await flush();
    await flush();
    syncProgressWrite("ch1", "doc-a");
    await flush();
    await flush();
    expect(getQueueLength()).toBe(1);
  });
});
