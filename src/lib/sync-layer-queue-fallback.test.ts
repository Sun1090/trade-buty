// 队列 chunk 的动态 import 在「离线 + 该 chunk 从未加载」时会 reject：
// service worker 只预缓存 offline.html，JS chunk 一律走网络。本文件盯的就是这条
// 真实离线路径——既不能把拒绝漏给 fire-and-forget 的调用点，也不能把写入丢掉。
import { beforeEach, describe, expect, it, vi } from "vitest";

const { enqueueWrite, recordDroppedWrites, storeLoad } = vi.hoisted(() => ({
  enqueueWrite: vi.fn(),
  /** 队列 store 的「被上限挤掉」计数器（R16.139）：缓冲溢出也要落到同一本账上 */
  recordDroppedWrites: vi.fn(),
  /** 队列 store chunk 的可用性：离线时 import 直接失败 */
  storeLoad: { available: true, loads: 0 },
}));

const { MAX_QUEUE } = await import("./sync-queue");

/**
 * 每个用例注册一次 chunk 的可用状态、并拿一份全新的模块实例。
 * 缓冲是模块内的状态，共用实例会让上一条用例遗留的写入混进这一条的断言里；
 * 工厂必须逐用例重注册（`doMock`），因为一旦有一次加载成功，Vitest 就把结果
 * 缓存下来，之后再也模拟不出「chunk 拿不到」。
 */
async function loadFallback() {
  vi.resetModules();
  vi.doMock("./sync-queue-store", async () => {
    storeLoad.loads += 1;
    if (!storeLoad.available) throw new TypeError("Failed to fetch dynamically imported module");
    return { enqueueWrite, recordDroppedWrites };
  });
  const mod = await import("./sync-layer-queue-fallback");
  return {
    lazyEnqueueWrite: mod.lazyEnqueueWrite,
    retryBufferedWrites: mod.retryBufferedWrites,
    pendingWriteCount: mod.pendingWriteCount,
  };
}

/** 等离线期间那几次入队真的去尝试过加载 chunk */
async function settleLoadAttempts() {
  await vi.waitFor(() => expect(storeLoad.loads).toBeGreaterThan(0));
}

beforeEach(() => {
  vi.resetModules();
  enqueueWrite.mockReset();
  enqueueWrite.mockReturnValue([]);
  recordDroppedWrites.mockReset();
  storeLoad.available = true;
  storeLoad.loads = 0;
});

describe("lazyEnqueueWrite（R9.6 动态入队边界）", () => {
  it("把 kind / payloadKey / payload 原样转发给惰性引入的 sync-queue-store", async () => {
    const { lazyEnqueueWrite } = await loadFallback();
    const payload = { lessonSlug: "candlestick-basics", score: 3 };
    await lazyEnqueueWrite("progress", "tb-progress", payload);

    expect(enqueueWrite).toHaveBeenCalledTimes(1);
    expect(enqueueWrite).toHaveBeenCalledWith("progress", "tb-progress", payload, expect.any(Number), undefined);
  });

  it("支持全部队列类别（含删除与最佳成绩）", async () => {
    const { lazyEnqueueWrite } = await loadFallback();
    await lazyEnqueueWrite("wrongbook-delete", "tb-wrongbook", { id: "q1" });
    await lazyEnqueueWrite("replay-best", "tb-replay-best", { symbol: "BTCUSDT" });

    expect(enqueueWrite.mock.calls).toEqual([
      ["wrongbook-delete", "tb-wrongbook", { id: "q1" }, expect.any(Number), undefined],
      ["replay-best", "tb-replay-best", { symbol: "BTCUSDT" }, expect.any(Number), undefined],
    ]);
  });

  it("动态导入完成时身份已切换则不写旧账号队列", async () => {
    const { lazyEnqueueWrite } = await loadFallback();
    await lazyEnqueueWrite("progress", "a", {}, "user-a", () => false);
    expect(enqueueWrite).not.toHaveBeenCalled();
  });

  it("模块在 await 之前不得同步触达 sync-queue-store（保住 chunk 拆分）", async () => {
    const { lazyEnqueueWrite } = await loadFallback();
    const promise = lazyEnqueueWrite("goal", "tb-goal", { done: true });
    expect(enqueueWrite).not.toHaveBeenCalled();
    return promise;
  });
});

describe("队列 chunk 加载失败（离线写入的实际路径）", () => {
  it("chunk 加载失败时不把拒绝抛回调用方", async () => {
    const { lazyEnqueueWrite, pendingWriteCount } = await loadFallback();
    storeLoad.available = false;

    await expect(
      lazyEnqueueWrite("progress", "spot:first-trade", { chapter_num: "spot", doc_slug: "first-trade" }),
    ).resolves.toBeUndefined();
    expect(enqueueWrite).not.toHaveBeenCalled();
    expect(pendingWriteCount(), "这次写入应当还握着，等 chunk 可用").toBe(1);
  });

  it("离线期间交给队列的写入一条都不少，chunk 恢复后全部落盘", async () => {
    const { lazyEnqueueWrite, retryBufferedWrites, pendingWriteCount } = await loadFallback();
    storeLoad.available = false;
    lazyEnqueueWrite("progress", "spot:a", { doc_slug: "a" });
    lazyEnqueueWrite("wrongbook-upsert", "spot:2", { question_idx: 2 }, "user-a");
    await settleLoadAttempts();
    expect(pendingWriteCount()).toBe(2);

    storeLoad.available = true;
    await retryBufferedWrites();

    expect(enqueueWrite.mock.calls.map((c) => [c[0], c[1], c[4]])).toEqual([
      ["progress", "spot:a", undefined],
      ["wrongbook-upsert", "spot:2", "user-a"],
    ]);
    expect(enqueueWrite.mock.calls.every((c) => typeof c[3] === "number")).toBe(true);
    expect(pendingWriteCount(), "落盘后不再握着，重复 flush 不会写两遍").toBe(0);
  });

  it("离线期间同一条反复写入只补最后一次", async () => {
    const { lazyEnqueueWrite, retryBufferedWrites } = await loadFallback();
    storeLoad.available = false;
    lazyEnqueueWrite("quiz", "spot", { best: 3, total: 10 });
    lazyEnqueueWrite("quiz", "spot", { best: 7, total: 10 });
    await settleLoadAttempts();

    storeLoad.available = true;
    await retryBufferedWrites();

    expect(enqueueWrite).toHaveBeenCalledTimes(1);
    expect(enqueueWrite).toHaveBeenCalledWith("quiz", "spot", { best: 7, total: 10 }, expect.any(Number), undefined);
  });

  it("去重口径与持久化队列一致：同键覆盖 payload、保持先入队的位置", async () => {
    const { lazyEnqueueWrite, retryBufferedWrites } = await loadFallback();
    storeLoad.available = false;
    lazyEnqueueWrite("wrongbook-upsert", "spot:1", { picked: 0 });
    lazyEnqueueWrite("wrongbook-delete", "spot:1", { picked: 0 });
    lazyEnqueueWrite("wrongbook-upsert", "spot:1", { picked: 3 });
    await settleLoadAttempts();

    storeLoad.available = true;
    await retryBufferedWrites();

    expect(enqueueWrite.mock.calls.map((c) => [c[0], c[1], c[2]])).toEqual([
      ["wrongbook-upsert", "spot:1", { picked: 3 }],
      ["wrongbook-delete", "spot:1", { picked: 0 }],
    ]);
  });

  it("账号已切换的离线写入不落到当前账号队列，也不留在缓冲里", async () => {
    const { lazyEnqueueWrite, retryBufferedWrites, pendingWriteCount } = await loadFallback();
    let current = true;
    storeLoad.available = false;
    lazyEnqueueWrite("progress", "spot:a", { doc_slug: "a" }, "user-a", () => current);
    await settleLoadAttempts();
    current = false;

    storeLoad.available = true;
    await retryBufferedWrites();
    await retryBufferedWrites();

    expect(enqueueWrite).not.toHaveBeenCalled();
    expect(pendingWriteCount(), "旧账号的写入不能一直握着").toBe(0);
  });

  it("缓冲有上限，离线刷屏不会把内存吃满", async () => {
    const { lazyEnqueueWrite, retryBufferedWrites } = await loadFallback();
    expect(MAX_QUEUE, "队列上限口径来自 sync-queue").toBe(200);
    storeLoad.available = false;
    for (let i = 0; i < MAX_QUEUE + 5; i++) {
      lazyEnqueueWrite("progress", `spot:doc-${i}`, { doc_slug: `doc-${i}` });
    }
    await settleLoadAttempts();

    storeLoad.available = true;
    await retryBufferedWrites();

    const keys = enqueueWrite.mock.calls.map((c) => c[1]);
    expect(keys.length).toBe(MAX_QUEUE);
    // 丢最旧：前 5 条不在，最后一条在
    expect(keys).not.toContain("spot:doc-0");
    expect(keys).toContain(`spot:doc-${MAX_QUEUE + 4}`);
  });

  it("落盘本身出错时保留写入，等下一次重试", async () => {
    const { lazyEnqueueWrite, retryBufferedWrites, pendingWriteCount } = await loadFallback();
    storeLoad.available = false;
    lazyEnqueueWrite("progress", "spot:a", { doc_slug: "a" });
    await settleLoadAttempts();

    storeLoad.available = true;
    enqueueWrite.mockImplementationOnce(() => {
      throw new Error("QuotaExceededError");
    });
    await retryBufferedWrites();
    expect(enqueueWrite).toHaveBeenCalledTimes(1);
    expect(pendingWriteCount(), "没交出去就不能丢").toBe(1);

    await retryBufferedWrites();
    expect(enqueueWrite).toHaveBeenCalledTimes(2);
    expect(pendingWriteCount()).toBe(0);
    expect(enqueueWrite).toHaveBeenLastCalledWith(
      "progress",
      "spot:a",
      { doc_slug: "a" },
      expect.any(Number),
      undefined,
    );
  });
});

/**
 * R16.139：内存缓冲与持久化队列同一条 `MAX_QUEUE` 规矩——超上限丢最旧。
 * 丢的那些同样是「没到云上」的写。缓冲只活在当前会话，chunk 拿不到时没法记账，
 * 所以这里盯的是「chunk 恢复可用后，欠的账要补记上」。
 */
describe("缓冲溢出也要记账", () => {
  it("chunk 恢复可用时，把挤掉的条数补给持久化的计数器", async () => {
    const { lazyEnqueueWrite, retryBufferedWrites, pendingWriteCount } = await loadFallback();
    storeLoad.available = false;
    for (let i = 0; i < MAX_QUEUE + 3; i++) {
      await lazyEnqueueWrite("progress", `spot:doc-${i}`, { doc_slug: `doc-${i}` });
    }
    expect(pendingWriteCount(), "缓冲同样裁到上限").toBe(MAX_QUEUE);
    expect(recordDroppedWrites, "chunk 都拿不到，账不该在这时候记").not.toHaveBeenCalled();

    storeLoad.available = true;
    await retryBufferedWrites();
    expect(recordDroppedWrites).toHaveBeenCalledTimes(1);
    expect(recordDroppedWrites).toHaveBeenCalledWith(3);
    expect(enqueueWrite).toHaveBeenCalledTimes(MAX_QUEUE);
    expect(pendingWriteCount()).toBe(0);
  });

  it("没有溢出时一个字都不记", async () => {
    const { lazyEnqueueWrite, retryBufferedWrites } = await loadFallback();
    await lazyEnqueueWrite("progress", "spot:a", { doc_slug: "a" });
    expect(recordDroppedWrites).not.toHaveBeenCalled();
    await retryBufferedWrites();
    expect(recordDroppedWrites).not.toHaveBeenCalled();
  });
});
