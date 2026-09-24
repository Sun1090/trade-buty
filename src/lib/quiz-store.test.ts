import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/sync-layer", () => ({
  syncQuizUpsert: vi.fn(),
}));

const store = new Map<string, string>();
const localStorageMock = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => store.set(k, v),
  removeItem: (k: string) => store.delete(k),
};
vi.stubGlobal("localStorage", localStorageMock);
vi.stubGlobal("window", { dispatchEvent: vi.fn() });

const { readQuizProgress, saveQuizProgress } = await import("./quiz-store");

describe("quiz-store", () => {
  beforeEach(() => store.clear());

  it("无记录返回 null", () => {
    expect(readQuizProgress("spot")).toBeNull();
  });

  it("保存后可读回", () => {
    saveQuizProgress("spot", { best: 8, done: true }, 10);
    const p = readQuizProgress("spot");
    expect(p).toEqual({ best: 8, done: true });
  });

  it("不同篇章独立", () => {
    saveQuizProgress("spot", { best: 7, done: true }, 10);
    saveQuizProgress("futures", { best: 5, done: true }, 10);
    expect(readQuizProgress("spot")?.best).toBe(7);
    expect(readQuizProgress("futures")?.best).toBe(5);
  });

  it("损坏 JSON 返回 null", () => {
    store.set("tb-quiz-spot", "{bad");
    expect(readQuizProgress("spot")).toBeNull();
  });

  it("合法 JSON 中的非对象或错误字段返回 null", () => {
    store.set("tb-quiz-spot", "null");
    expect(readQuizProgress("spot")).toBeNull();
    store.set("tb-quiz-spot", JSON.stringify([]));
    expect(readQuizProgress("spot")).toBeNull();
    store.set("tb-quiz-spot", JSON.stringify({ best: "8", done: true }));
    expect(readQuizProgress("spot")).toBeNull();
    store.set("tb-quiz-spot", JSON.stringify({ best: 8 }));
    expect(readQuizProgress("spot")).toBeNull();
  });

  it("归一化有限非负分数", () => {
    store.set("tb-quiz-spot", JSON.stringify({ best: 7.6, done: true }));
    expect(readQuizProgress("spot")).toEqual({ best: 8, done: true });
  });

  // 答题账本是「测验次数」的数据源。它曾经只收正分，于是全答错的那一套在趋势里
  // 凭空消失，而概览卡的「测验完成」照样数着它——同一屏两个数对不上。
  it("0 分的一套题也写进答题账本", () => {
    saveQuizProgress("spot", { best: 0, done: true }, 10);
    const ledger = JSON.parse(store.get("tb-quiz-attempts") ?? "{}");
    expect(Object.values(ledger)).toEqual([
      { chapter: "spot", best: 0, total: 10, at: expect.any(Number) },
    ]);
  });

  // 没做完的（`done: false`）不是完成事件，不进账本
  it("未完成的分数不写答题账本", () => {
    saveQuizProgress("spot", { best: 5, done: false }, 10);
    expect(store.has("tb-quiz-attempts")).toBe(false);
  });
});
