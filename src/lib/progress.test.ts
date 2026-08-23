import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock localStorage + window（progress.ts 在浏览器环境运行）
const store = new Map<string, string>();
const localStorageMock = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => store.set(k, v),
  removeItem: (k: string) => store.delete(k),
};
vi.stubGlobal("localStorage", localStorageMock);
vi.stubGlobal("window", {
  dispatchEvent: vi.fn(),
});

const { readProgress, markRead } = await import("./progress");

describe("progress storage", () => {
  beforeEach(() => store.clear());

  it("空时返回空对象", () => {
    expect(readProgress()).toEqual({});
  });

  it("markRead 添加文档到正确篇章", () => {
    markRead("getting-started", "market-overview");
    const p = readProgress();
    expect(p["getting-started"]).toEqual(["market-overview"]);
  });

  it("markRead 多次追加，不重复", () => {
    markRead("spot", "a");
    markRead("spot", "b");
    markRead("spot", "a"); // 重复
    expect(readProgress()["spot"]).toEqual(["a", "b"]);
  });

  it("不同篇章独立", () => {
    markRead("spot", "a");
    markRead("futures", "b");
    const p = readProgress();
    expect(p["spot"]).toEqual(["a"]);
    expect(p["futures"]).toEqual(["b"]);
  });

  it("损坏的 JSON 返回空对象", () => {
    store.set("tb-progress", "{broken");
    expect(readProgress()).toEqual({});
  });
});
