import { describe, it, expect, vi } from "vitest";
import * as fs from "node:fs";

// Mock fs + content 模块（避免读取真实知识库）
vi.mock("node:fs", () => ({
  default: {
    existsSync: () => true,
    readdirSync: () => [{ name: "getting-started", isDirectory: () => true }],
    readFileSync: (p: string) => {
      if (p.endsWith("README.md")) return "# 01 · 入门\nintro";
      return `# Test Doc

## 第一节：市场概述

这一段内容描述了金融市场的基本概念，包括股票市场、债券市场和商品市场的基本运作方式。
投资者需要理解这些基础概念才能做出明智的决策。

## 第二节：交易机制

交易所的撮合机制是价格优先、时间优先。市价单和限价单是两种最基本的订单类型。
了解这些机制对于控制交易成本和执行效率至关重要。
`;
    },
  },
}));
vi.mock("@/lib/content", () => ({
  getChapterSlugs: () => ["getting-started"],
  getDocMetas: () => [{ slug: "test-doc", title: "Test", description: "" }],
  assertKnowledgeRoot: () => {},
}));

const { getAllChunks } = await import("./chunk");

describe("chunk", () => {
  it("按 H2 分块", () => {
    const chunks = getAllChunks("zh");
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0]).toHaveProperty("chapter");
    expect(chunks[0]).toHaveProperty("doc");
    expect(chunks[0]).toHaveProperty("chunk");
    expect(chunks[0]).toHaveProperty("locale");
  });

  it("每块含元信息", () => {
    const chunks = getAllChunks("zh");
    for (const c of chunks) {
      expect(c.locale).toBe("zh");
      expect(c.chapter).toBeTruthy();
      expect(c.doc).toBeTruthy();
    }
  });

  it("太短的块被过滤（<50 字符）", () => {
    const chunks = getAllChunks("zh");
    for (const c of chunks) {
      expect(c.chunk.length).toBeGreaterThan(50);
    }
  });
});
