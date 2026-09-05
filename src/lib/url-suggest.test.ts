import { describe, it, expect } from "vitest";
import {
  levenshtein,
  normalizeForDistance,
  parseKnowledgePath,
  pickFallback,
  suggestFromPath,
  type SuggestibleItem,
} from "./url-suggest";

// 稳定语料：3 个章节，每个章节 2 个 doc；标题混中英文
const corpus: SuggestibleItem[] = [
  { slug: "getting-started", title: "入门基础", href: "/zh/knowledge/getting-started" },
  { slug: "first-trade", title: "第一笔交易", href: "/zh/knowledge/getting-started/first-trade" },
  { slug: "risk-basics", title: "风险常识", href: "/zh/knowledge/getting-started/risk-basics" },
  { slug: "spot", title: "现货交易", href: "/zh/knowledge/spot" },
  { slug: "spot-vs-futures", title: "现货 vs 期货", href: "/zh/knowledge/spot/spot-vs-futures" },
  { slug: "spot-fees", title: "现货手续费", href: "/zh/knowledge/spot/spot-fees" },
  { slug: "futures", title: "期货基础", href: "/zh/knowledge/futures" },
  { slug: "margin-intro", title: "保证金入门", href: "/zh/knowledge/futures/margin-intro" },
  { slug: "leverage", title: "杠杆原理", href: "/zh/knowledge/futures/leverage" },
];

describe("levenshtein", () => {
  it("相同字符串距离为 0", () => {
    expect(levenshtein("hello", "hello")).toBe(0);
  });
  it("空字符串距离等于另一字符串长度", () => {
    expect(levenshtein("", "abc")).toBe(3);
    expect(levenshtein("abc", "")).toBe(3);
  });
  it("单字符替换距离 1", () => {
    expect(levenshtein("cat", "bat")).toBe(1);
  });
  it("插入/删除距离 1", () => {
    expect(levenshtein("cat", "cats")).toBe(1);
    expect(levenshtein("cats", "cat")).toBe(1);
  });
  it("中文按字计算", () => {
    expect(levenshtein("入门基础", "入门基石")).toBe(1);
  });
  it("对调顺序距离 2（非相邻字符 swap 计 2）", () => {
    expect(levenshtein("ab", "ba")).toBe(2);
  });
});

describe("normalizeForDistance", () => {
  it("小写化 + 去标点", () => {
    expect(normalizeForDistance("Getting-Started!")).toBe("gettingstarted");
  });
  it("保留中文汉字", () => {
    expect(normalizeForDistance("入门 / 基础")).toBe("入门基础");
  });
});

describe("parseKnowledgePath", () => {
  it("解析知识库 doc 路径", () => {
    expect(parseKnowledgePath("/zh/knowledge/getting-started/first-trade")).toEqual({
      locale: "zh",
      chapter: "getting-started",
      doc: "first-trade",
    });
  });
  it("解析知识库章节路径", () => {
    expect(parseKnowledgePath("/en/knowledge/spot")).toEqual({
      locale: "en",
      chapter: "spot",
    });
  });
  it("非知识库路径返回 null", () => {
    expect(parseKnowledgePath("/zh/search")).toBeNull();
    expect(parseKnowledgePath("/api/foo")).toBeNull();
    expect(parseKnowledgePath("/fr/knowledge/spot")).toBeNull();
  });
  it("处理 URL 编码段", () => {
    expect(parseKnowledgePath("/zh/knowledge/getting-started/%E7%AC%AC%E4%B8%80%E7%AC%94%E4%BA%A4%E6%98%93")).toEqual({
      locale: "zh",
      chapter: "getting-started",
      doc: "第一笔交易",
    });
  });
});

describe("suggestFromPath", () => {
  it("doc 段拼写错位（同章内）→ 推荐同章最近 doc", () => {
    const out = suggestFromPath("/zh/knowledge/getting-started/firstt-trade", corpus, 3);
    expect(out.length).toBeGreaterThan(0);
    expect(out[0]!.href).toBe("/zh/knowledge/getting-started/first-trade");
  });

  it("doc 段不存在但章节存在 → 推荐该章其他 doc + 章节自身", () => {
    const out = suggestFromPath("/zh/knowledge/getting-started/nonexistent-doc", corpus, 3);
    expect(out.length).toBeGreaterThan(0);
    for (const it of out) {
      expect(it.href.startsWith("/zh/knowledge/getting-started")).toBe(true);
    }
  });

  it("章节段拼写错位 → 推荐最近章节的 doc", () => {
    const out = suggestFromPath("/zh/knowledge/spotz/spot-vs-futures", corpus, 3);
    expect(out.length).toBeGreaterThan(0);
    expect(out.some((it) => it.href.startsWith("/zh/knowledge/spot"))).toBe(true);
  });

  it("未知章节 → 跨章节按距离猜", () => {
    const out = suggestFromPath("/zh/knowledge/nonexistent-chapter/anything", corpus, 3);
    expect(out.length).toBeGreaterThan(0);
    expect(out.length).toBeLessThanOrEqual(3);
  });

  it("非知识库路径 → 空数组（调用方回退到热门）", () => {
    expect(suggestFromPath("/zh/search", corpus, 3)).toEqual([]);
    expect(suggestFromPath("/api/foo", corpus, 3)).toEqual([]);
  });

  it("空 corpus → 空数组", () => {
    expect(suggestFromPath("/zh/knowledge/getting-started/first-trade", [], 3)).toEqual([]);
  });

  it("en 路径用 en 语料也能识别（slug 一致）", () => {
    // 语料全 zh，但函数只看 slug；slug 命中时仍能找到
    const out = suggestFromPath("/en/knowledge/getting-started/first-trade", corpus, 3);
    // 由于语料 href 都是 /zh/，会走"跨章节猜"路径，但 slug 距离仍生效
    expect(out.length).toBeGreaterThan(0);
  });
});

describe("pickFallback", () => {
  it("按语料顺序取前 k 个", () => {
    const out = pickFallback(corpus, 3);
    expect(out.map((it) => it.slug)).toEqual(["getting-started", "first-trade", "risk-basics"]);
  });

  it("k > 语料长度时全部返回", () => {
    const out = pickFallback(corpus, 100);
    expect(out.length).toBe(corpus.length);
  });

  it("空语料返回空数组", () => {
    expect(pickFallback([], 6)).toEqual([]);
  });
});
