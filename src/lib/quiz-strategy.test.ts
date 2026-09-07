// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildQuizStrategyConfig,
  clearQuizDifficulty,
  normalizeQuizDifficulty,
  readQuizDifficulty,
  resolveQuizStrategy,
  writeQuizDifficulty,
} from "./quiz-strategy";

describe("normalizeQuizDifficulty", () => {
  it("仅 advanced 被识别，其余输入回退 basic", () => {
    expect(normalizeQuizDifficulty("advanced")).toBe("advanced");
    expect(normalizeQuizDifficulty("basic")).toBe("basic");
    expect(normalizeQuizDifficulty("expert")).toBe("basic");
    expect(normalizeQuizDifficulty(undefined)).toBe("basic");
  });
});

describe("resolveQuizStrategy", () => {
  it("章节入门题使用 5 题、低温度、稳定相关性阈值", () => {
    const strategy = resolveQuizStrategy({ locale: "zh", difficulty: "basic", chapter: "behavioral-finance" });
    expect(strategy.expectedCount).toBe(5);
    expect(strategy.temperature).toBe(0.65);
    expect(strategy.minRelevance).toBe(0.25);
    expect(strategy.difficultyRule).toContain("入门");
  });

  it("章节进阶题提高 token 预算与相关性阈值", () => {
    const strategy = resolveQuizStrategy({ locale: "en", difficulty: "advanced", chapter: "behavioral-finance" });
    expect(strategy.locale).toBe("en");
    expect(strategy.expectedCount).toBe(5);
    expect(strategy.temperature).toBe(0.75);
    expect(strategy.maxTokens).toBe(3200);
    expect(strategy.minRelevance).toBe(0.32);
    expect(strategy.difficultyRule).toContain("advanced");
  });

  it("错题变体模式默认 3 题并共享 5 题输入上限", () => {
    const strategy = resolveQuizStrategy({ locale: "zh", difficulty: "advanced", variant: true });
    expect(strategy.expectedCount).toBe(3);
    expect(strategy.maxInputQuestions).toBe(5);
    expect(strategy.cacheKey).toBe("variant::zh::advanced::");
  });
});

describe("buildQuizStrategyConfig", () => {
  it("未知章节返回 warning 但不阻断配置解析", () => {
    const { warnings } = buildQuizStrategyConfig({ locale: "zh", difficulty: "basic", chapter: "missing-chapter" });
    expect(warnings).toContain("unknown-chapter");
  });

  it("已知章节不返回 unknown-chapter warning", () => {
    const { warnings } = buildQuizStrategyConfig({ locale: "zh", difficulty: "basic", chapter: "technical-analysis" });
    expect(warnings).not.toContain("unknown-chapter");
  });

  it("错题变体模式提示无章节上下文时按基础策略", () => {
    const { warnings } = buildQuizStrategyConfig({ locale: "en", difficulty: "advanced", variant: true });
    expect(warnings).toContain("variant-fallback-basic");
  });
});

describe("quiz difficulty localStorage preference", () => {
  let store = new Map<string, string>();

  function installLocalStorageMock(mock: Storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
  } as unknown as Storage) {
    vi.stubGlobal("localStorage", mock);
    Object.defineProperty(window, "localStorage", {
      value: mock,
      configurable: true,
      writable: true,
    });
  }

  beforeEach(() => {
    store = new Map();
    installLocalStorageMock();
  });

  it("难度偏好按 locale 隔离写入与读取", () => {
    writeQuizDifficulty("advanced", "zh");
    writeQuizDifficulty("basic", "en");

    expect(readQuizDifficulty("zh")).toBe("advanced");
    expect(readQuizDifficulty("en")).toBe("basic");
  });

  it("非法偏好回退 basic", () => {
    writeQuizDifficulty("advanced");
    store.set("tb-quiz-difficulty:zh", "expert");
    expect(readQuizDifficulty()).toBe("basic");
  });

  it("隐私模式无 localStorage 时读写均静默回退", () => {
    installLocalStorageMock(undefined as unknown as Storage);
    expect(readQuizDifficulty()).toBe("basic");
    expect(() => writeQuizDifficulty("advanced")).not.toThrow();
  });

  it("清除偏好后回到 basic", () => {
    writeQuizDifficulty("advanced", "zh");
    clearQuizDifficulty("zh");
    expect(readQuizDifficulty("zh")).toBe("basic");
  });
});
