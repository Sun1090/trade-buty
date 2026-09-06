import { describe, expect, it } from "vitest";
import {
  diagnoseNoResults,
  similarTerms,
  triedVariants,
} from "./search-diagnostics";
import { SYNONYM_GROUPS } from "./search-synonyms";

/** 站内零命中时推荐用词池：同义词组词条 + 常见课程标题/篇章。 */
const CANDIDATES = [
  ...SYNONYM_GROUPS.flatMap((g) => g.terms),
  "K 线图",
  "蜡烛图形态",
  "移动平均线战法",
  "DCA 定投策略",
];

describe("search-diagnostics (R10.22)", () => {
  it("triedVariants：原词在前、同义扩展去重、只留 ≥2 字符", () => {
    const tried = triedVariants("定投");
    expect(tried[0]).toBe("定投");
    expect(tried).toEqual(["定投", "dca", "dollar-cost averaging", "定期定额"]);
    // 单字符查询不扩展，也不被列入尝试清单
    expect(triedVariants("e")).toEqual([]);
  });

  it("similarTerms：中文错字（保证金→保证今）推荐回正词", () => {
    expect(similarTerms("保证今", CANDIDATES)).toContain("保证金");
  });

  it("similarTerms：英文拼写错误（leverage→levrage）推荐回正词", () => {
    expect(similarTerms("levrage", CANDIDATES)).toContain("leverage");
  });

  it("similarTerms：排除自身；距离超阈值的无关词不推荐；过短查询不推荐", () => {
    // 「止损」→「趋势」距离 2，超过 2 字符查询的阈值 1 → 不推荐
    expect(similarTerms("止损", ["止损", "趋势"])).toEqual([]);
    expect(similarTerms("止", CANDIDATES)).toEqual([]);
  });

  it("similarTerms：返回有序且不超过 k 条", () => {
    const hits = similarTerms("均线", CANDIDATES, { k: 3 });
    expect(hits.length).toBeLessThanOrEqual(3);
  });

  it("空查询 / 单字符查询 → empty / too-short", () => {
    expect(diagnoseNoResults("  ").kind).toBe("empty");
    expect(diagnoseNoResults("e").kind).toBe("too-short");
  });

  it("查询命中词典但全组无内容 → coverage-gap（含已尝试词条）", () => {
    const d = diagnoseNoResults("模拟盘交易", { candidates: [] });
    expect(d.kind).toBe("coverage-gap");
    expect(d.groupIds).toContain("paper-trading");
    expect(d.groupTerms).toContain("模拟盘");
    expect(d.tried).toContain("paper trading");
  });

  it("疑似错字且有近义候选 → typo（优先于 coverage-gap）", () => {
    const d = diagnoseNoResults("止损失", { candidates: CANDIDATES });
    expect(d.kind).toBe("typo");
    expect(d.suggestions).toContain("止损");
  });

  it("无词典命中也无近义候选 → no-match", () => {
    const d = diagnoseNoResults("随机指标", { candidates: [] });
    expect(d.kind).toBe("no-match");
    expect(d.suggestions).toEqual([]);
    expect(d.groupIds).toEqual([]);
  });
});
