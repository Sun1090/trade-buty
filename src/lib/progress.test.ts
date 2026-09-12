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

const { readProgress, readProgressCompletions, markRead } = await import("./progress");

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

  it("合法但结构错误的 progress 返回空对象", () => {
    for (const raw of ["null", "[]", '"oops"', "42"]) {
      store.set("tb-progress", raw);
      expect(readProgress()).toEqual({});
    }
  });

  it("过滤非数组章节、非字符串文档并去重", () => {
    store.set(
      "tb-progress",
      JSON.stringify({
        spot: ["a", "a", "b", 3, null],
        broken: "not-an-array",
        empty: [],
      }),
    );
    expect(readProgress()).toEqual({ spot: ["a", "b"], empty: [] });
  });

  it("结构损坏后仍可正常标记并恢复进度", () => {
    store.set("tb-progress", "null");
    expect(() => markRead("spot", "a")).not.toThrow();
    expect(readProgress()).toEqual({ spot: ["a"] });
  });

  it("首次标记课程会写入 completion ledger", () => {
    const before = Date.now();
    markRead("getting-started", "market-overview");
    const after = Date.now();
    const completions = readProgressCompletions();
    const entry = completions["getting-started:market-overview"];

    expect(entry).toEqual({ chapter: "getting-started", doc: "market-overview", at: entry!.at });
    expect(entry!.at).toBeGreaterThanOrEqual(before);
    expect(entry!.at).toBeLessThanOrEqual(after);
  });

  it("重复标记同一课程不会覆盖 completion 时间", () => {
    markRead("spot", "a");
    const firstAt = readProgressCompletions()["spot:a"]!.at;
    markRead("spot", "a");
    expect(readProgressCompletions()["spot:a"]!.at).toBe(firstAt);
  });

  it("损坏的 completion ledger 安全降级并允许继续写入", () => {
    store.set("tb-progress-completions", "{broken");
    expect(readProgressCompletions()).toEqual({});

    markRead("futures", "margin");
    expect(readProgressCompletions()["futures:margin"]).toMatchObject({
      chapter: "futures",
      doc: "margin",
    });
  });

  it("completion ledger 忽略非对象条目并清洗字段", () => {
    store.set(
      "tb-progress-completions",
      JSON.stringify({
        good: { chapter: "spot", doc: "a", at: 1 },
        nullish: null,
        array: [],
        partial: { chapter: "futures", at: "bad" },
      }),
    );

    expect(readProgressCompletions()).toEqual({
      good: { chapter: "spot", doc: "a", at: 1 },
      partial: { chapter: "futures" },
    });
  });
});
