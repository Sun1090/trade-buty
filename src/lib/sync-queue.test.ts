import { describe, it, expect } from "vitest";
import {
  enqueueUnique,
  trimQueue,
  flushQueue,
  flushQueueAsync,
  readQueue,
  MAX_QUEUE,
  type QueueItem,
} from "./sync-queue";

const mk = (id: number, kind: QueueItem["kind"], key: string): QueueItem => ({
  id,
  kind,
  payloadKey: key,
  payload: { x: id },
  at: id * 1000,
});

describe("enqueueUnique", () => {
  it("空队列追加新条目", () => {
    const out = enqueueUnique([], "progress", "ch1:doc-a", { a: 1 }, 1000, 1);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: 1, kind: "progress", payloadKey: "ch1:doc-a", at: 1000 });
  });

  it("同 kind+key 已存在 → 更新 payload + at，保留 id 不变", () => {
    const q = [mk(1, "progress", "ch1:doc-a")];
    const out = enqueueUnique(q, "progress", "ch1:doc-a", { a: 99 }, 2000, 2);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: 1, payload: { a: 99 }, at: 2000 });
  });

  it("同 kind 不同 key → 都保留", () => {
    const q = [mk(1, "progress", "ch1:doc-a")];
    const out = enqueueUnique(q, "progress", "ch1:doc-b", { x: 2 }, 2000, 2);
    expect(out).toHaveLength(2);
  });

  it("不同 kind 同一 payloadKey → 都保留", () => {
    const q = [mk(1, "progress", "shared")];
    const out = enqueueUnique(q, "quiz", "shared", { x: 2 }, 2000, 2);
    expect(out).toHaveLength(2);
  });

  it("不修改入参（immutable）", () => {
    const q = [mk(1, "progress", "k")];
    const snapshot = JSON.stringify(q);
    enqueueUnique(q, "progress", "k2", { x: 2 }, 2000, 2);
    expect(JSON.stringify(q)).toBe(snapshot);
  });
});

describe("trimQueue", () => {
  it("未超限：原样返回（但 copy）", () => {
    const q = [mk(1, "progress", "a"), mk(2, "progress", "b")];
    const out = trimQueue(q, 5);
    expect(out).toEqual(q);
    expect(out).not.toBe(q);
  });

  it("超限：丢弃最旧条目（FIFO 截断）", () => {
    const q = Array.from({ length: 10 }, (_, i) => mk(i + 1, "progress", `k${i}`));
    const out = trimQueue(q, 5);
    expect(out).toHaveLength(5);
    expect(out[0]?.id).toBe(6); // 最早的 5 个被丢
    expect(out[4]?.id).toBe(10);
  });

  it("默认 MAX_QUEUE = 200", () => {
    expect(MAX_QUEUE).toBe(200);
  });
});

describe("flushQueue (sync executor)", () => {
  it("全部成功 → 队列清空", () => {
    const q = [mk(1, "progress", "a"), mk(2, "progress", "b")];
    const seen: number[] = [];
    const out = flushQueue(q, (item) => {
      seen.push(item.id);
      return true;
    });
    expect(out.queue).toHaveLength(0);
    expect(out.executed).toBe(2);
    expect(out.succeeded).toBe(2);
    expect(seen).toEqual([1, 2]);
  });

  it("中间失败 → 保留失败项，后续继续尝试（每条独立）", () => {
    const q = [mk(1, "progress", "a"), mk(2, "progress", "b"), mk(3, "progress", "c")];
    const out = flushQueue(q, (item) => item.id !== 2);
    expect(out.executed).toBe(3);
    expect(out.succeeded).toBe(2);
    expect(out.queue.map((i) => i.id)).toEqual([2]); // 只有第 2 条失败保留
  });

  it("executor 抛错 → 当条失败，后续继续尝试", () => {
    const q = [mk(1, "progress", "a"), mk(2, "progress", "b")];
    const out = flushQueue(q, (item) => {
      if (item.id === 1) throw new Error("boom");
      return true;
    });
    expect(out.queue.map((i) => i.id)).toEqual([1]); // 第 1 条抛错保留；第 2 条独立成功
    expect(out.succeeded).toBe(1);
  });
});

describe("flushQueueAsync", () => {
  it("全部成功（async executor） → 队列清空", async () => {
    const q = [mk(1, "progress", "a"), mk(2, "progress", "b")];
    const out = await flushQueueAsync(q, async (item) => {
      await new Promise((r) => setTimeout(r, 1));
      return true;
    });
    expect(out.queue).toHaveLength(0);
    expect(out.succeeded).toBe(2);
  });

  it("中间 reject → 保留失败项与剩余（async 模式短路）", async () => {
    // async 模式选择短路策略：失败即停（避免网络抖动时反复撞墙）
    const q = [mk(1, "progress", "a"), mk(2, "progress", "b"), mk(3, "progress", "c")];
    const out = await flushQueueAsync(q, async (item) => {
      if (item.id === 2) throw new Error("net down");
      return true;
    });
    expect(out.queue.map((i) => i.id)).toEqual([2, 3]);
    expect(out.succeeded).toBe(1);
  });

  it("async 返回 false → 保留后续", async () => {
    const q = [mk(1, "progress", "a"), mk(2, "progress", "b")];
    const out = await flushQueueAsync(q, async (item) => item.id !== 1);
    expect(out.queue.map((i) => i.id)).toEqual([1, 2]);
  });
});

describe("readQueue", () => {
  it("null/空 → 空数组", () => {
    expect(readQueue(null)).toEqual([]);
    expect(readQueue(undefined)).toEqual([]);
    expect(readQueue("")).toEqual([]);
  });

  it("非法 JSON → 空数组（不抛）", () => {
    expect(readQueue("not json")).toEqual([]);
    expect(readQueue("{")).toEqual([]);
  });

  it("非数组 → 空数组", () => {
    expect(readQueue('{"foo":1}')).toEqual([]);
  });

  it("合法队列 JSON → 解析", () => {
    const json = JSON.stringify([
      { id: 1, kind: "progress", payloadKey: "k", payload: { x: 1 }, at: 100 },
    ]);
    const out = readQueue(json);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: 1, kind: "progress" });
  });

  it("缺字段条目被丢弃", () => {
    const json = JSON.stringify([
      { id: 1, kind: "progress", payloadKey: "k", payload: { x: 1 }, at: 100 }, // 合法
      { id: 2, kind: "progress" }, // 缺 payloadKey/payload/at
      { kind: "progress", payloadKey: "k", payload: { x: 1 }, at: 100 }, // 缺 id
      null,
      "string",
    ]);
    expect(readQueue(json)).toHaveLength(1);
  });
});
