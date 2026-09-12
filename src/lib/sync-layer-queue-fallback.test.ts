import { beforeEach, describe, expect, it, vi } from "vitest";

const { enqueueWrite } = vi.hoisted(() => ({ enqueueWrite: vi.fn() }));
vi.mock("./sync-queue-store", () => ({ enqueueWrite }));

const { lazyEnqueueWrite } = await import("./sync-layer-queue-fallback");

describe("lazyEnqueueWrite（R9.6 动态入队边界）", () => {
  beforeEach(() => {
    enqueueWrite.mockReset();
    enqueueWrite.mockReturnValue([]);
  });

  it("把 kind / payloadKey / payload 原样转发给惰性引入的 sync-queue-store", async () => {
    const payload = { lessonSlug: "candlestick-basics", score: 3 };
    await lazyEnqueueWrite("progress", "tb-progress", payload);

    expect(enqueueWrite).toHaveBeenCalledTimes(1);
    expect(enqueueWrite).toHaveBeenCalledWith("progress", "tb-progress", payload);
  });

  it("支持全部队列类别（含删除与最佳成绩）", async () => {
    await lazyEnqueueWrite("wrongbook-delete", "tb-wrongbook", { id: "q1" });
    await lazyEnqueueWrite("replay-best", "tb-replay-best", { symbol: "BTCUSDT" });

    expect(enqueueWrite.mock.calls).toEqual([
      ["wrongbook-delete", "tb-wrongbook", { id: "q1" }],
      ["replay-best", "tb-replay-best", { symbol: "BTCUSDT" }],
    ]);
  });

  it("模块在 await 之前不得同步触达 sync-queue-store（保住 chunk 拆分）", () => {
    const promise = lazyEnqueueWrite("goal", "tb-goal", { done: true });
    expect(enqueueWrite).not.toHaveBeenCalled();
    return promise;
  });
});
