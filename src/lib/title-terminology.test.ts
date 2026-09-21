import { describe, expect, it } from "vitest";
import {
  checkTitlePair,
  checkTitlePairs,
  findTitleTerms,
  renderTitleTerminologyMarkdown,
  stripTitleOrder,
  TITLE_TERMS,
} from "../../scripts/title-terminology-lib.mjs";

describe("title terminology (R10.3)", () => {
  it("matches Chinese trading terms in an English title", () => {
    const result = checkTitlePair({ chapter: "futures", document: "risk", zhTitle: "04 · 合约交易与风控", enTitle: "Perpetual Trading and Risk Control" });
    expect(result.status).toBe("pass");
  });

  it("reports missing English terms without treating punctuation or numbers as mismatches", () => {
    const result = checkTitlePair({ chapter: "futures", document: "leverage", zhTitle: "05 · 杠杆：为什么 10 倍不等于赚 10 倍", enTitle: "Why 10x Is Not 10x Profit" });
    expect(result.status).toBe("gap");
    expect((result as { missingTerms?: Array<{ zh: string }> }).missingTerms?.map((term) => term.zh)).toEqual(["杠杆"]);
  });

  it("subsumes a shorter term when a longer dictionary term already matched", () => {
    const result = checkTitlePair({ chapter: "market-ecosystem", document: "exchange-business-models", zhTitle: "05 · 交易所商业模式", enTitle: "05 · Exchange Business Models" });
    expect(result.status).toBe("pass");
    expect((result as { terms?: Array<{ zh: string }> }).terms?.map((term) => term.zh)).toEqual(["交易所"]);
  });

  it("marks titles with no known dictionary term for human review", () => {
    const result = checkTitlePair({ chapter: "basics", document: "intro", zhTitle: "从零开始的学习路线", enTitle: "A Learning Path from Zero" });
    expect(result).toMatchObject({ status: "review", reason: "no-known-zh-term" });
  });

  it("pairs by chapter and document slug, including missing files", () => {
    const results = checkTitlePairs([
      { chapter: "b", document: "same", zhTitle: "杠杆基础", enTitle: "Leverage Basics" },
      { chapter: "a", document: "missing", zhTitle: "止损基础", enTitle: "" },
    ]);
    expect(results.map((result: { chapter: string; document: string; status: string }) => [result.chapter, result.document, result.status])).toEqual([
      ["a", "missing", "gap"],
      ["b", "same", "pass"],
    ]);
  });

  it("renders stable summary counts", () => {
    const markdown = renderTitleTerminologyMarkdown({ generatedAt: "2026-09-06", results: [
      checkTitlePair({ chapter: "a", document: "x", zhTitle: "现货交易", enTitle: "Spot Trading" }),
    ] });
    expect(markdown).toContain("pass：1");
    expect(markdown).toContain("2026-09-06");
  });

  it("strips every leading order form and tolerates a missing title", () => {
    expect(stripTitleOrder("04 · 合约交易")).toBe("合约交易");
    expect(stripTitleOrder("05、杠杆")).toBe("杠杆");
    expect(stripTitleOrder("07 - 爆仓")).toBe("爆仓");
    expect(stripTitleOrder("12.现货")).toBe("现货");
    expect(stripTitleOrder("永续合约")).toBe("永续合约");
    expect(stripTitleOrder(undefined)).toBe("");
  });

  it("finds dictionary terms against the built-in list and subsumes shorter ones", () => {
    expect(findTitleTerms("风险与保证金").map((t: { zh: string }) => t.zh)).toEqual(["风险", "保证金"]);
    expect(findTitleTerms("交易所里的合约").map((t: { zh: string }) => t.zh)).toEqual(["合约", "交易所"]);
    expect(findTitleTerms("")).toEqual([]);
    expect(findTitleTerms(undefined)).toEqual([]);
    // 传入自定义词表时不得回落到内置表
    expect(findTitleTerms("风险与保证金", [{ zh: "风险", en: ["risk"] }])).toHaveLength(1);
    expect(TITLE_TERMS.length).toBeGreaterThan(0);
  });

  it("treats an absent title as a gap on whichever side is missing", () => {
    expect(checkTitlePair({ chapter: "a", document: "x", zhTitle: "杠杆基础", enTitle: undefined })).toMatchObject({
      status: "gap",
      reason: "missing-en-title",
      enTitle: "",
    });
    expect(checkTitlePair({ chapter: "a", document: "x", zhTitle: undefined, enTitle: "Leverage Basics" })).toMatchObject({
      status: "gap",
      reason: "missing-zh-title",
      zhTitle: "",
    });
  });

  it("normalizes dashes and whitespace before comparing English terms", () => {
    const result = checkTitlePair({ chapter: "a", document: "x", zhTitle: "止损与止盈", enTitle: "Stop—Loss / Take Profit" });
    expect(result.status).toBe("pass");
  });

  it("renders an empty report and marks the missing side of a gap row", () => {
    const empty = renderTitleTerminologyMarkdown({ generatedAt: "2026-09-22", results: [] });
    expect(empty).toContain("总课程：0");
    expect(empty).not.toContain("| 状态 | 章节 |");

    const gap = renderTitleTerminologyMarkdown({
      generatedAt: "2026-09-22",
      results: [checkTitlePair({ chapter: "b", document: "y", zhTitle: "杠杆基础", enTitle: undefined })],
    });
    expect(gap).toContain("（缺失）");
    expect(gap).toContain("missing-en-title");
  });
});
