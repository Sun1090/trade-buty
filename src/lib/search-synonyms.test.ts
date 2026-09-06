import { describe, expect, it } from "vitest";
import {
  SYNONYM_GROUPS,
  normalizeQuery,
  dictionaryProblems,
  matchedGroups,
  expandQuery,
  scoreWithSynonyms,
} from "./search-synonyms";

const mk = (o: Partial<{ title: string; chapter: string; text: string }>) => ({
  url: "/",
  title: "",
  chapter: "",
  text: "",
  ...o,
});

describe("search-synonyms (R10.21)", () => {
  it("词典自检无重复/空组/未归一问题", () => {
    expect(dictionaryProblems()).toEqual([]);
  });

  it("每组成员 ≥2，且组内存在中英两侧词条（跨语言可达的前提）", () => {
    for (const g of SYNONYM_GROUPS) {
      expect(g.terms.length, g.id).toBeGreaterThanOrEqual(2);
      const zh = g.terms.some((t) => /[\u4e00-\u9fff]/.test(t));
      const en = g.terms.some((t) => /^[a-z]/.test(t));
      expect(zh, `${g.id} 缺中文词条`).toBe(true);
      expect(en, `${g.id} 缺英文词条`).toBe(true);
    }
  });

  it("normalizeQuery 去空白转小写", () => {
    expect(normalizeQuery("  Stop Loss ")).toBe("stop loss");
    expect(normalizeQuery("")).toBe("");
  });

  it("matchedGroups 双向包含命中（缩写、后缀短语）", () => {
    expect(matchedGroups("dca").map((g) => g.id)).toContain("dca");
    expect(matchedGroups("定投").map((g) => g.id)).toContain("dca");
    // q 是词条前缀：ma → moving-average 组
    expect(matchedGroups("ma").map((g) => g.id)).toContain("moving-average");
  });

  it("单字符查询不触发同义词扩展（避免噪声）", () => {
    expect(matchedGroups("e")).toEqual([]);
    expect(expandQuery("e")).toEqual(["e"]);
  });

  it("expandQuery 原词在前、同义词去重、无命中时只返回原词", () => {
    const ex = expandQuery("定投");
    expect(ex[0]).toBe("定投");
    expect(ex).toContain("dca");
    expect(ex).toContain("dollar-cost averaging");
    expect(new Set(ex).size).toBe(ex.length);
    expect(expandQuery("无此词")).toEqual(["无此词"]);
  });

  it("scoreWithSynonyms：en 正文命中 zh 查询的同义词", () => {
    const entry = mk({ title: "DCA strategy", chapter: "x", text: "dollar-cost averaging keeps risk low" });
    expect(scoreWithSynonyms(entry, "定投")).toBeGreaterThan(0);
  });

  it("scoreWithSynonyms：无命中为 0", () => {
    const entry = mk({ title: "abc", chapter: "x", text: "def" });
    expect(scoreWithSynonyms(entry, "定投")).toBe(0);
  });
});
