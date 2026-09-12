import { describe, expect, it } from "vitest";
import { checkTitlePair, checkTitlePairs, renderTitleTerminologyMarkdown } from "../../scripts/title-terminology-lib.mjs";

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
});
