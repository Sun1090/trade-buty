import { describe, it, expect, beforeEach, vi } from "vitest";

const store = new Map<string, string>();
const localStorageMock = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => store.set(k, v),
  removeItem: (k: string) => store.delete(k),
};
vi.stubGlobal("localStorage", localStorageMock);
vi.stubGlobal("window", { dispatchEvent: vi.fn() });

const { readWrong, recordWrong, resolveWrong } = await import("./wrongbook");

describe("wrongbook storage", () => {
  beforeEach(() => store.clear());

  it("空时返回空对象", () => {
    expect(readWrong()).toEqual({});
  });

  it("recordWrong 添加错题", () => {
    recordWrong("getting-started", 0, 1);
    const w = readWrong();
    expect(w["getting-started:0"]).toMatchObject({
      chapterNum: "getting-started",
      questionIdx: 0,
      picked: 1,
    });
    expect(w["getting-started:0"].at).toBeGreaterThan(0);
  });

  it("recordWrong 同题覆盖（更新 picked 和 at）", () => {
    recordWrong("spot", 2, 0);
    const first = readWrong()["spot:2"];
    recordWrong("spot", 2, 3); // 改了 picked
    const second = readWrong()["spot:2"];
    expect(second.picked).toBe(3);
    expect(second.at).toBeGreaterThanOrEqual(first.at);
  });

  it("resolveWrong 移除指定错题", () => {
    recordWrong("futures", 0, 1);
    recordWrong("futures", 1, 2);
    resolveWrong("futures", 0);
    const w = readWrong();
    expect(w["futures:0"]).toBeUndefined();
    expect(w["futures:1"]).toBeDefined();
  });

  it("不同篇章/题号独立", () => {
    recordWrong("a", 0, 0);
    recordWrong("b", 1, 1);
    const w = readWrong();
    expect(Object.keys(w).sort()).toEqual(["b:1", "a:0"].sort());
  });

  it("损坏 JSON 返回空对象", () => {
    store.set("tb-wrong", "not json");
    expect(readWrong()).toEqual({});
  });
});
