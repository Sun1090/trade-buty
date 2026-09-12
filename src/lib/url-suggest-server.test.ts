import { describe, it, expect } from "vitest";
import { buildKnowledgeCorpus } from "./url-suggest-server";

describe("buildKnowledgeCorpus（R8.11）", () => {
  it("zh 语料包含章节与其下的 doc，且 href 指向站内路由", () => {
    const corpus = buildKnowledgeCorpus("zh");
    expect(corpus.length).toBeGreaterThan(0);
    for (const item of corpus) {
      expect(typeof item.slug).toBe("string");
      expect(item.slug.length).toBeGreaterThan(0);
      expect(item.title.length).toBeGreaterThan(0);
      expect(item.href.startsWith("/zh/knowledge/")).toBe(true);
    }
    // 至少有一条 doc 级条目（带二级路径）
    expect(corpus.some((i) => i.href.split("/").length === 5)).toBe(true);
  });

  it("en 语料使用 /en 前缀", () => {
    const corpus = buildKnowledgeCorpus("en");
    expect(corpus.length).toBeGreaterThan(0);
    expect(corpus.every((i) => i.href.startsWith("/en/knowledge/"))).toBe(true);
  });

  it("每个章节 slug 都有对应条目，标题不重复为空", () => {
    const corpus = buildKnowledgeCorpus("zh");
    const chapters = corpus.filter((i) => i.href.split("/").length === 4);
    expect(chapters.length).toBeGreaterThan(0);
    expect(new Set(chapters.map((c) => c.slug)).size).toBe(chapters.length);
  });
});
