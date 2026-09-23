// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  enqueueWrite,
  flushPersistedQueue,
  clearPersistedQueue,
  getQueueLength,
  loadQueueAndNextId,
  QUEUE_KEY,
  QUEUE_NEXT_ID_KEY,
  QUEUE_OWNER_KEY,
  QUEUE_EVENT,
} from "./sync-queue-store";

// 内存 localStorage
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

beforeEach(() => memStore.clear());

describe("enqueueWrite (持久化)", () => {
  it("首次入队 → 持久化到 localStorage", () => {
    const out = enqueueWrite("progress", "ch1:doc-a", { chapter: "ch1" }, 1000);
    expect(out).toHaveLength(1);
    expect(JSON.parse(memStore.get(QUEUE_KEY)!)).toMatchObject([
      { kind: "progress", payloadKey: "ch1:doc-a", payload: { chapter: "ch1" }, at: 1000 },
    ]);
    expect(memStore.get(QUEUE_NEXT_ID_KEY)).toBe("2");
  });

  it("同 kind+key 重复入队 → 去重更新 payload + at，id 不变", () => {
    enqueueWrite("progress", "ch1:doc-a", { chapter: "ch1" }, 1000);
    enqueueWrite("progress", "ch1:doc-a", { chapter: "ch1", updated: true }, 2000);
    expect(getQueueLength()).toBe(1);
    const stored = JSON.parse(memStore.get(QUEUE_KEY)!);
    expect(stored[0].payload).toEqual({ chapter: "ch1", updated: true });
    expect(stored[0].at).toBe(2000);
    // nextId 没递增，因为没新增条目
    expect(memStore.get(QUEUE_NEXT_ID_KEY)).toBe("2");
  });

  it("不同 key → 都保留", () => {
    enqueueWrite("progress", "ch1:a", { x: 1 }, 1000);
    enqueueWrite("progress", "ch1:b", { x: 2 }, 2000);
    expect(getQueueLength()).toBe(2);
    expect(memStore.get(QUEUE_NEXT_ID_KEY)).toBe("3");
  });

  it("超过 MAX_QUEUE → 丢弃最旧", () => {
    for (let i = 0; i < 205; i++) {
      enqueueWrite("progress", `k${i}`, { i }, i);
    }
    expect(getQueueLength()).toBe(200);
    const stored = JSON.parse(memStore.get(QUEUE_KEY)!);
    // 最前 5 个被丢，剩下从 k5 开始
    expect(stored[0].payloadKey).toBe("k5");
    expect(stored[199].payloadKey).toBe("k204");
  });

  it("loadQueueAndNextId 解析现有数据", () => {
    memStore.set(
      QUEUE_KEY,
      JSON.stringify([
        { id: 1, kind: "progress", payloadKey: "k", payload: { x: 1 }, at: 100 },
        { id: 2, kind: "quiz", payloadKey: "ch1", payload: { best: 8 }, at: 200 },
      ]),
    );
    memStore.set(QUEUE_NEXT_ID_KEY, "3");
    const { queue, nextId } = loadQueueAndNextId();
    expect(queue).toHaveLength(2);
    expect(nextId).toBe(3);
  });

  it("nextId 丢失或落后时从队列最大 id 恢复，避免新条目撞号", () => {
    memStore.set(QUEUE_KEY, JSON.stringify([
      { id: 4, kind: "progress", payloadKey: "a", payload: {}, at: 1 },
      { id: 8, kind: "quiz", payloadKey: "b", payload: {}, at: 2 },
    ]));
    memStore.set(QUEUE_NEXT_ID_KEY, "3");
    expect(loadQueueAndNextId().nextId).toBe(9);
    const next = enqueueWrite("progress", "c", {}, 3);
    expect(next.map((item) => item.id)).toEqual([4, 8, 9]);
    expect(memStore.get(QUEUE_NEXT_ID_KEY)).toBe("10");
    memStore.delete(QUEUE_NEXT_ID_KEY);
    expect(loadQueueAndNextId().nextId).toBe(10);
  });

  it.each(["2junk", "1.5", "0", "-1", "9007199254740992"])(
    "不接受非规范或不安全的 nextId %s",
    (value) => {
      memStore.set(QUEUE_NEXT_ID_KEY, value);
      expect(loadQueueAndNextId().nextId).toBe(1);
    },
  );

  it("nextId 非法值回退到 1", () => {
    memStore.set(QUEUE_NEXT_ID_KEY, "abc");
    const { nextId } = loadQueueAndNextId();
    expect(nextId).toBe(1);
  });
});

describe("flushPersistedQueue", () => {
  it("executor 全成功 → 队列清空", async () => {
    enqueueWrite("progress", "a", { x: 1 });
    enqueueWrite("progress", "b", { x: 2 });
    const calls: number[] = [];
    const result = await flushPersistedQueue(async (item) => {
      calls.push(item.payloadKey === "a" ? 1 : 2);
      return true;
    });
    expect(result.succeeded).toBe(2);
    expect(getQueueLength()).toBe(0);
    expect(memStore.get(QUEUE_KEY)).toBe("[]");
  });

  it("executor 拒绝一条 → 失败项与未触达项都保留（短路语义）", async () => {
    enqueueWrite("progress", "a", { x: 1 });
    enqueueWrite("progress", "b", { x: 2 });
    enqueueWrite("progress", "c", { x: 3 });
    const result = await flushPersistedQueue(async (item) => {
      if (item.payloadKey === "b") return false;
      return true;
    });
    // 短路：b 失败立刻停，c 未触达也保留
    expect(result.executed).toBe(2);
    expect(result.succeeded).toBe(1);
    expect(getQueueLength()).toBe(2);
    const remaining = JSON.parse(memStore.get(QUEUE_KEY)!);
    expect(remaining.map((q: { payloadKey: string }) => q.payloadKey)).toEqual(["b", "c"]);
  });

  it("异步重放期间新增或更新的写入不会被旧快照覆盖", async () => {
    enqueueWrite("progress", "a", { version: 1 }, 1);
    enqueueWrite("progress", "b", { version: 1 }, 2);
    const result = await flushPersistedQueue(async (item) => {
      if (item.payloadKey === "a") {
        enqueueWrite("progress", "a", { version: 2 }, 3);
        enqueueWrite("progress", "c", { version: 1 }, 4);
      }
      return true;
    });
    expect(result.succeeded).toBe(2);
    expect(result.queue.map((item) => item.payloadKey)).toEqual(["a", "c"]);
    expect(result.queue[0]?.payload).toEqual({ version: 2 });
    expect(loadQueueAndNextId().nextId).toBe(4);
  });

  it("账号切换不得把 A 的队列重放到 B，旧账号的延迟 flush 不得清掉 B", async () => {
    enqueueWrite("progress", "a", {}, 1, "user-a");
    const calls = vi.fn(async () => true);
    const foreign = await flushPersistedQueue(calls, "user-b");
    expect(foreign.executed).toBe(0);
    expect(calls).not.toHaveBeenCalled();
    enqueueWrite("quiz", "b", {}, 2, "user-b");
    expect(memStore.get(QUEUE_OWNER_KEY)).toBe("user-b");
    expect(loadQueueAndNextId().queue.map((item) => item.payloadKey)).toEqual(["b"]);
    await flushPersistedQueue(calls, "user-a");
    expect(loadQueueAndNextId().queue.map((item) => item.payloadKey)).toEqual(["b"]);
  });

  it("A 的异步重放未完成时切到 B，不得覆盖 B 的队列", async () => {
    enqueueWrite("progress", "a", {}, 1, "user-a");
    const result = await flushPersistedQueue(async () => {
      enqueueWrite("progress", "b", {}, 2, "user-b");
      return true;
    }, "user-a");
    expect(result.succeeded).toBe(1);
    expect(memStore.get(QUEUE_OWNER_KEY)).toBe("user-b");
    expect(loadQueueAndNextId().queue.map((item) => item.payloadKey)).toEqual(["b"]);
  });

  it("不重放旧版无归属队列", async () => {
    enqueueWrite("progress", "legacy", {}, 1);
    const calls = vi.fn(async () => true);
    await flushPersistedQueue(calls, "user-b");
    expect(calls).not.toHaveBeenCalled();
    expect(loadQueueAndNextId().queue).toEqual([]);
    expect(memStore.get(QUEUE_OWNER_KEY)).toBe("user-b");
  });

  it("空队列 → 不调用 executor，返回 0/0", async () => {
    const executor = vi.fn(async () => true);
    const result = await flushPersistedQueue(executor);
    expect(result.executed).toBe(0);
    expect(executor).not.toHaveBeenCalled();
  });
});

describe("clearPersistedQueue", () => {
  it("清空后 getQueueLength → 0", () => {
    enqueueWrite("progress", "a", { x: 1 });
    enqueueWrite("progress", "b", { x: 2 });
    expect(getQueueLength()).toBe(2);
    clearPersistedQueue();
    expect(getQueueLength()).toBe(0);
    expect(memStore.has(QUEUE_KEY)).toBe(false);
    expect(memStore.has(QUEUE_NEXT_ID_KEY)).toBe(false);
  });
});

// 待上传条数是界面（首页 ☁「已云端存档」）的判据，所以每次队列变化都必须 announce：
// 只 announce 入队不 announce 重放/清空，标记会在该出现的时候一直不出现。
describe("队列变化的通知（tb-sync-queue）", () => {
  it("入队、重放、清空各通知一次", async () => {
    const seen: string[] = [];
    const onChange = () => seen.push(QUEUE_EVENT);
    window.addEventListener(QUEUE_EVENT, onChange);
    try {
      enqueueWrite("progress", "ch:doc", { chapter_num: "ch", doc_slug: "doc" });
      expect(seen).toHaveLength(1);

      await flushPersistedQueue(async () => true);
      expect(seen).toHaveLength(2);

      clearPersistedQueue();
      expect(seen).toHaveLength(3);
    } finally {
      window.removeEventListener(QUEUE_EVENT, onChange);
    }
  });
});
