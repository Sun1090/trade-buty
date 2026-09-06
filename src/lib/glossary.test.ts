import { describe, expect, it } from "vitest";
import { GLOSSARY_TERMS, GLOSSARY_COUNT } from "./glossary";
import glossaryData from "./glossary-data.json";

const CJK = /[\u4e00-\u9fff]/;
const LATIN = /[A-Za-z]{2,}/;

/** R6.8 时代已存在的核心词条，扩展不得删除 */
const LEGACY_TERMS = [
  "做多", "做空", "杠杆", "止损", "止盈", "K 线", "订单簿", "滑点",
  "爆仓", "保证金", "现货", "合约", "永续合约", "资金费率", "成交量",
  "流动性", "支撑位", "阻力位", "趋势", "回撤",
];

describe("glossary data（R10.13 双语扩展）", () => {
  it("数据源与包装导出一致，且已从 20 条扩展", () => {
    expect(glossaryData).toHaveLength(GLOSSARY_COUNT);
    expect(GLOSSARY_COUNT).toBeGreaterThanOrEqual(40);
  });

  it("每个词条四个字段齐全且非空", () => {
    for (const t of GLOSSARY_TERMS) {
      expect(t.term.trim()).not.toBe("");
      expect(t.en.trim()).not.toBe("");
      expect(t.def.trim()).not.toBe("");
      expect(t.defEn.trim()).not.toBe("");
    }
  });

  it("term/def 为中文，en/defEn 为英文（语言侧正确）", () => {
    for (const t of GLOSSARY_TERMS) {
      expect(t.term).toMatch(CJK);
      expect(t.def).toMatch(CJK);
      expect(t.en).not.toMatch(CJK);
      expect(t.defEn).toMatch(LATIN);
      expect(t.defEn).not.toMatch(CJK);
    }
  });

  it("中英文主词各自唯一（不区分大小写）", () => {
    const zh = GLOSSARY_TERMS.map((t) => t.term);
    const en = GLOSSARY_TERMS.map((t) => t.en.toLowerCase());
    expect(new Set(zh).size).toBe(zh.length);
    expect(new Set(en).size).toBe(en.length);
  });

  it("同一语言内无交叉占用（一词既是 A 主词又是 B 译文）", () => {
    const allZh = new Set(GLOSSARY_TERMS.map((t) => t.term));
    const allEn = new Set(GLOSSARY_TERMS.map((t) => t.en.toLowerCase()));
    for (const t of GLOSSARY_TERMS) {
      expect(allZh.has(t.en)).toBe(false);
      expect(allEn.has(t.term.toLowerCase())).toBe(false);
    }
  });

  it("定义不得双语雷同（def 与 defEn 需为不同语言内容）", () => {
    for (const t of GLOSSARY_TERMS) {
      expect(t.def).not.toBe(t.defEn);
    }
  });

  it("R6.8 核心词条全部保留", () => {
    const present = new Set(GLOSSARY_TERMS.map((t) => t.term));
    for (const legacy of LEGACY_TERMS) {
      expect(present.has(legacy)).toBe(true);
    }
  });

  it("en 主词均为语料实际用词（非凭空翻译）：抽查常见缩写与合成词", () => {
    const enSet = new Set(GLOSSARY_TERMS.map((t) => t.en));
    for (const expected of ["RSI", "DCA", "Futures/Perpetual", "P/E Ratio", "Bollinger Bands"]) {
      expect(enSet.has(expected)).toBe(true);
    }
  });
});
