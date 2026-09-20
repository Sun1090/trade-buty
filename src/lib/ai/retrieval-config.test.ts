import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getRetrievalProfile } from "./retrieval-config";

beforeEach(() => {
  delete process.env.AI_RETRIEVAL_JSON;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getRetrievalProfile", () => {
  it("默认返回各场景配置", () => {
    expect(getRetrievalProfile("chat")).toEqual({ topK: 4, threshold: 0.3, relaxedTopK: 6 });
    expect(getRetrievalProfile("quiz")).toEqual({ topK: 3, threshold: 0.3, relaxedTopK: 0 });
    expect(getRetrievalProfile("summary")).toEqual({ topK: 6, threshold: 0.3, relaxedTopK: 0 });
  });

  it("环境变量可覆盖部分字段（含 0 值）", () => {
    process.env.AI_RETRIEVAL_JSON = JSON.stringify({
      chat: { threshold: 0.25, relaxedTopK: 0 },
    });
    expect(getRetrievalProfile("chat")).toEqual({ topK: 4, threshold: 0.25, relaxedTopK: 0 });
    // 未覆盖场景不受影响
    expect(getRetrievalProfile("quiz").threshold).toBe(0.3);
  });

  it("非法 JSON 被忽略不阻断", () => {
    process.env.AI_RETRIEVAL_JSON = "not-json{{{";
    expect(getRetrievalProfile("chat").threshold).toBe(0.3);
  });

  it("非法字段值回退默认值", () => {
    process.env.AI_RETRIEVAL_JSON = JSON.stringify({
      chat: { threshold: "high", topK: -5 },
    });
    const p = getRetrievalProfile("chat");
    expect(p.threshold).toBe(0.3);
    expect(p.topK).toBe(4);
  });
});

  it("非对象 JSON 被忽略并告警", () => {
    process.env.AI_RETRIEVAL_JSON = "[1,2,3]";
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(getRetrievalProfile("summary").topK).toBe(6);
    expect(warnSpy).toHaveBeenCalledWith("[retrieval-config] AI_RETRIEVAL_JSON 非对象，已忽略");
  });

  it("阈值必须保持在 0..1，越界值回退默认阈值", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    process.env.AI_RETRIEVAL_JSON = JSON.stringify({
      chat: { threshold: 1.5 },
      quiz: { threshold: -0.1 },
    });

    expect(getRetrievalProfile("chat").threshold).toBe(0.3);
    expect(getRetrievalProfile("quiz").threshold).toBe(0.3);
    expect(warnSpy).toHaveBeenCalledWith("[retrieval-config] 检索阈值超出 0..1，已回退为 0.3");
  });

  it("边界阈值和有效覆盖字段被保留", () => {
    process.env.AI_RETRIEVAL_JSON = JSON.stringify({
      chat: { threshold: 0, topK: 2.9, relaxedTopK: 1 },
    });
    expect(getRetrievalProfile("chat")).toEqual({ topK: 2, threshold: 0, relaxedTopK: 1 });
  });

  it("未知场景按 chat 默认配置回退", () => {
    expect(getRetrievalProfile("unknown" as never)).toEqual({ topK: 4, threshold: 0.3, relaxedTopK: 6 });
  });
