import { describe, it, expect, beforeEach, vi } from "vitest";

const store = new Map<string, string>();
const localStorageMock = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => store.set(k, v),
  removeItem: (k: string) => store.delete(k),
};
vi.stubGlobal("localStorage", localStorageMock);
vi.stubGlobal("window", { dispatchEvent: vi.fn() });

vi.mock("./sync-layer", () => ({
  syncWrongbookWrite: vi.fn(),
  syncWrongbookDelete: vi.fn(),
}));

const { syncWrongbookWrite } = await import("./sync-layer");
const { readWrong, recordWrong, resolveWrong } = await import("./wrongbook");

describe("wrongbook storage", () => {
  beforeEach(() => {
    store.clear();
    vi.clearAllMocks();
  });

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

  it("recordWrong 持久化 SRS stage/due 并同步到云端", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 13, 12, 0, 0));
    try {
      recordWrong("spot", 2, 3);
      expect(readWrong()["spot:2"]).toMatchObject({
        srsStage: 0,
        srsDue: "2026-09-14",
      });
      expect(vi.mocked(syncWrongbookWrite)).toHaveBeenCalledWith(
        "spot",
        2,
        3,
        0,
        "2026-09-14",
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("recordWrong 再次答错时把已有 SRS 计划重置为 stage 0", () => {
    store.set("tb-wrong", JSON.stringify({
      "spot:2": {
        chapterNum: "spot",
        questionIdx: 2,
        picked: 0,
        at: 1,
        srsStage: 4,
        srsDue: "2026-12-01",
      },
    }));
    recordWrong("spot", 2, 1);
    expect(readWrong()["spot:2"].srsStage).toBe(0);
    expect(readWrong()["spot:2"].srsDue).not.toBe("2026-12-01");
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

  it("合法 JSON 中的非对象结构返回空对象且可恢复写入", () => {
    store.set("tb-wrong", "null");
    expect(readWrong()).toEqual({});
    recordWrong("spot", 1, 2);
    expect(readWrong()["spot:1"]).toMatchObject({ questionIdx: 1, picked: 2 });
  });

  it("过滤字段和 SRS 字段损坏的错题条目", () => {
    store.set(
      "tb-wrong",
      JSON.stringify({
        "spot:1": {
          chapterNum: "spot",
          questionIdx: 1,
          picked: 0,
          at: 100,
          srsStage: -1,
          srsDue: "tomorrow",
        },
        "spot:2": { chapterNum: "spot", questionIdx: "2", picked: 0, at: 100 },
        "spot:3": null,
      }),
    );
    expect(readWrong()).toEqual({
      "spot:1": { chapterNum: "spot", questionIdx: 1, picked: 0, at: 100 },
    });
  });
});
