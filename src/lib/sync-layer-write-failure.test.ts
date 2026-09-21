// @vitest-environment jsdom
/**
 * 登录态云端写失败时的入队行为。
 *
 * 为什么单开一个文件：失败路径要靠 mock 出来的 Supabase 客户端才能进入，而客户端 mock
 * 必须是**静态** `vi.mock`——`vi.doMock` + `vi.importActual` 的组合里依赖并不会被替换，
 * 结果是「客户端存在但写失败」的用例实际走的是「客户端构造不出来」那一条分支，
 * 看起来绿、其实什么都没测（本仓库的 R9.5 队列就是这么被误判为已覆盖的）。
 *
 * 关键契约：postgrest-js 默认**不 reject**。RLS 拒绝、5xx、断网的 fetch 失败都被它内部
 * catch 成 resolved 的 `{data:null, error}`，只有 `.throwOnError()` 才会抛出。
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QUEUE_KEY, QUEUE_OWNER_KEY, loadQueueAndNextId } from "./sync-queue-store";
import {
  setAuthState,
  syncGoalUpsert,
  syncProgressWrite,
  syncQuizUpsert,
  syncReplayBestUpsert,
  syncReplayHistoryWrite,
  syncWrongbookClearAll,
  syncWrongbookDelete,
  syncWrongbookWrite,
} from "./sync-layer";

type Mode = "ok" | "postgrest-error" | "reject" | "pending";
const state = vi.hoisted(() => ({
  mode: "postgrest-error" as Mode,
  release: null as null | (() => void),
  sent: [] as { table: string; args: unknown[] }[],
}));

vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowser: () => {
    const outcome = () => {
      if (state.mode === "ok") return Promise.resolve({ data: { id: 1 }, error: null });
      if (state.mode === "reject") return Promise.reject(new Error("unexpected throw"));
      if (state.mode === "pending") {
        return new Promise<{ data: null; error: unknown }>((resolve) => {
          state.release = () => resolve({ data: null, error: { message: "late offline" } });
        });
      }
      return Promise.resolve({ data: null, error: { message: "offline", code: "500" } });
    };
    return {
      from: (table: string) => {
        /** 链式构造器：`.eq()` 可任意层数叠加（delete 用三链），`.then()` 才是真正落地的请求 */
        const builder = (...args: unknown[]) => {
          state.sent.push({ table, args });
          const result = outcome();
          const self: Record<string, unknown> = {
            then: (onfulfilled: unknown, onrejected: unknown) =>
              (result as Promise<unknown>).then(
                onfulfilled as (v: unknown) => unknown,
                onrejected as (e: unknown) => unknown,
              ),
          };
          self.eq = () => self;
          return self;
        };
        return {
          insert: (row: unknown) => builder(row),
          upsert: (row: unknown) => builder(row),
          delete: () => builder(),
        };
      },
    };
  },
}));

const memStore = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: (key: string) => memStore.get(key) ?? null,
    setItem: (key: string, value: string) => void memStore.set(key, value),
    removeItem: (key: string) => void memStore.delete(key),
    clear: () => memStore.clear(),
    key: (index: number) => [...memStore.keys()][index] ?? null,
    get length() {
      return memStore.size;
    },
  },
  writable: true,
});

/** 每种写操作：入队时的 kind / 去重键 / 载荷，以及触发它的那次调用 */
const writers = [
  {
    kind: "progress",
    payloadKey: "spot:first-trade",
    payload: { chapter_num: "spot", doc_slug: "first-trade" },
    call: () => syncProgressWrite("spot", "first-trade"),
  },
  {
    kind: "wrongbook-upsert",
    payloadKey: "spot:2",
    payload: { chapter_num: "spot", question_idx: 2, picked: 1, srs_stage: 3, srs_due: "2026-09-20" },
    call: () => syncWrongbookWrite("spot", 2, 1, 3, "2026-09-20"),
  },
  {
    kind: "wrongbook-delete",
    payloadKey: "spot:2",
    payload: { chapter_num: "spot", question_idx: 2 },
    call: () => syncWrongbookDelete("spot", 2),
  },
  {
    kind: "quiz",
    payloadKey: "spot",
    payload: { chapter_num: "spot", best: 7, total: 10 },
    call: () => syncQuizUpsert("spot", 7, 10),
  },
  {
    kind: "replay-best",
    payloadKey: "global",
    payload: { best_streak: 12 },
    call: () => syncReplayBestUpsert(12),
  },
  {
    kind: "goal",
    payloadKey: "daily-goal",
    payload: { daily_goal_min: 40 },
    call: () => syncGoalUpsert(40),
  },
] as const;

async function flushMicrotasks() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  memStore.clear();
  state.mode = "postgrest-error";
  state.release = null;
  state.sent = [];
  setAuthState(false);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("postgrest 以 {data:null,error} 返回失败（线上主要失败形态）", () => {
  it.each(writers.map((w) => [w.kind, w] as const))("%s 失败后写入带 owner 的队列", async (_kind, w) => {
    setAuthState(true, "user-a");
    w.call();
    await flushMicrotasks();

    expect(loadQueueAndNextId().queue).toEqual([
      expect.objectContaining({ kind: w.kind, payloadKey: w.payloadKey, payload: w.payload }),
    ]);
    expect(memStore.get(QUEUE_OWNER_KEY)).toBe("user-a");
  });
});

describe("其它结局", () => {
  it("写入成功（error 为 null）时不入队、不留空队列", async () => {
    state.mode = "ok";
    setAuthState(true, "user-a");

    syncProgressWrite("spot", "first-trade");
    await flushMicrotasks();

    expect(memStore.has(QUEUE_KEY)).toBe(false);
  });

  it("意外抛异常（例如客户端误用）时同样入队，不静默丢写", async () => {
    state.mode = "reject";
    setAuthState(true, "user-a");

    syncProgressWrite("spot", "first-trade");
    await flushMicrotasks();

    expect(loadQueueAndNextId().queue).toEqual([
      expect.objectContaining({ kind: "progress", payloadKey: "spot:first-trade" }),
    ]);
  });

  it("失败响应回来前已经换账号时，不写进旧账号的队列", async () => {
    state.mode = "pending";
    setAuthState(true, "user-a");
    syncProgressWrite("spot", "first-trade");

    setAuthState(true, "user-b");
    state.release?.();
    await flushMicrotasks();

    expect(memStore.has(QUEUE_KEY)).toBe(false);
  });

  it("未登录时压根不发请求，也不产生队列", async () => {
    setAuthState(false);
    syncProgressWrite("spot", "first-trade");
    await flushMicrotasks();
    expect(memStore.has(QUEUE_KEY)).toBe(false);
  });
});

describe("清空错题本的云端侧", () => {
  it("整表删除失败时退回逐条入队，重放后仍然等价于全部删除", async () => {
    setAuthState(true, "user-a");

    syncWrongbookClearAll([
      { chapterNum: "spot", questionIdx: 1 },
      { chapterNum: "futures", questionIdx: 3 },
    ]);
    await flushMicrotasks();

    expect(loadQueueAndNextId().queue.map((item) => `${item.kind}:${item.payloadKey}`)).toEqual([
      "wrongbook-delete:spot:1",
      "wrongbook-delete:futures:3",
    ]);
  });

  it("整表删除成功时什么都不入队", async () => {
    state.mode = "ok";
    setAuthState(true, "user-a");

    syncWrongbookClearAll([{ chapterNum: "spot", questionIdx: 1 }]);
    await flushMicrotasks();

    expect(memStore.has(QUEUE_KEY)).toBe(false);
  });

  it("未登录时不清云端（也不炸）", async () => {
    setAuthState(false);
    expect(() => syncWrongbookClearAll([{ chapterNum: "spot", questionIdx: 1 }])).not.toThrow();
    await flushMicrotasks();
    expect(memStore.has(QUEUE_KEY)).toBe(false);
  });
});

describe("回放记录的时间戳口径", () => {
  it("在线写入把本地完成时刻作为 recorded_at 一起上传，合并时才不会多算一轮", async () => {
    state.mode = "ok";
    setAuthState(true, "user-a");

    syncReplayHistoryWrite({
      symbol: "BTCUSDT",
      interval: "1h",
      total: 10,
      correct: 7,
      bestStreak: 3,
      at: 1_700_000_000_000,
    });
    await flushMicrotasks();

    expect(state.sent[0]?.table).toBe("replay_history");
    expect(state.sent[0]?.args[0]).toMatchObject({
      user_id: "user-a",
      symbol: "BTCUSDT",
      recorded_at: "2023-11-14T22:13:20.000Z",
    });
  });

  it("没有完成时刻时不伪造时间（交给服务端 default now()）", async () => {
    state.mode = "ok";
    setAuthState(true, "user-a");

    syncReplayHistoryWrite({ symbol: "BTCUSDT", interval: "1h", total: 10, correct: 7, bestStreak: 3 });
    await flushMicrotasks();

    const row = state.sent[0]?.args[0] as Record<string, unknown>;
    expect(Object.prototype.hasOwnProperty.call(row, "recorded_at")).toBe(false);
  });

  it("失败入队时 recorded_at 留在载荷里，重放后时间与本地一致", async () => {
    setAuthState(true, "user-a");

    syncReplayHistoryWrite({
      symbol: "ETHUSDT",
      interval: "4h",
      total: 8,
      correct: 4,
      bestStreak: 2,
      at: 1_700_000_000_000,
    });
    await flushMicrotasks();

    expect(loadQueueAndNextId().queue[0]).toMatchObject({
      kind: "replay-history",
      payload: { symbol: "ETHUSDT", recorded_at: "2023-11-14T22:13:20.000Z" },
    });
  });
});
