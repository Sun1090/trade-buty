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
});
