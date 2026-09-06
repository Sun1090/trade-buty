import { describe, expect, it } from "vitest";
import { analyzeRiskWarning, renderRiskWarningMarkdown } from "../../scripts/risk-warning-lib.mjs";

describe("risk-warning coverage (R10.5)", () => {
  it("passes a VitePress warning container with zh marker", () => {
    const result = analyzeRiskWarning({
      markdown: "正文……\n\n::: warning ⚠️ 风险提示\n合约是少数赢家通吃的游戏。\n:::\n",
      kind: "lesson",
    });
    expect(result).toMatchObject({ status: "pass", hasRiskBlock: true, containerBlocks: 1, inlineBlocks: 0 });
  });

  it("passes a VitePress warning container with en marker", () => {
    const result = analyzeRiskWarning({ markdown: "::: warning ⚠️ Risk Warning\nNot investment advice.\n:::\n" });
    expect(result.status).toBe("pass");
    expect(result.containerBlocks).toBe(1);
  });

  it("passes a boxed inline blockquote (marker after ⚠️, text on same line)", () => {
    const result = analyzeRiskWarning({ markdown: "> ⚠️ **风险提示：期货是保证金交易，亏损可能超过本金。**\n" });
    expect(result).toMatchObject({ status: "pass", inlineBlocks: 1, containerBlocks: 0 });
  });

  it("passes a boxed inline blockquote (⚠️ inside bold, content on following lines)", () => {
    const result = analyzeRiskWarning({
      markdown: "> **⚠️ 风险提示**\n>\n> 本篇章全部内容仅用于学习与研究，不构成任何投资建议。\n",
    });
    expect(result.status).toBe("pass");
    expect(result.inlineBlocks).toBe(1);
  });

  it("passes an en one-line boxed blockquote", () => {
    const result = analyzeRiskWarning({
      markdown: "> ⚠️ **Risk Warning**: Futures are margin trading; losses may exceed your principal.\n",
    });
    expect(result.status).toBe("pass");
  });

  it("counts multiple separate inline blocks in one document", () => {
    const result = analyzeRiskWarning({
      markdown: [
        "> ⚠️ **风险提示：杠杆代币不是持仓工具。**",
        "",
        "> ⚠️ **风险提示：稳定币 ≠ 无风险。**",
      ].join("\n"),
    });
    expect(result.inlineBlocks).toBe(2);
  });

  it("flags mention-only prose as review, not pass", () => {
    const result = analyzeRiskWarning({
      markdown: "- 每篇都配有「⚠️ 风险提示」框，请先读风险框再读正文。\n- 涉及杠杆与衍生品的章节都包含「风险提示」框。\n",
    });
    expect(result).toMatchObject({ status: "review", hasRiskBlock: false, reasons: ["mention-only"] });
  });

  it("flags an unboxed risk sentence as review", () => {
    const result = analyzeRiskWarning({
      markdown: "> 现货虽然风险最低，但仍有归零、市场流动性枯竭、平台风险等隐患。这笔钱亏掉能接受吗？\n",
    });
    expect(result).toMatchObject({ status: "review", hasRiskBlock: false, reasons: ["unboxed-risk-sentence"] });
  });

  it("marks documents with no risk phrasing as gap", () => {
    expect(analyzeRiskWarning({ markdown: "只讲 K 线构成，不涉及任何杠杆产品。\n" })).toMatchObject({
      status: "gap",
      hasRiskBlock: false,
      reasons: [],
    });
  });

  it("does not treat a generic warning container as a risk block", () => {
    const result = analyzeRiskWarning({ markdown: "::: warning 一般注意\n示例价格仅用于说明计算。\n:::\n" });
    expect(result.status).toBe("gap");
  });

  it("does not treat a soft 'risk management' mention as an unboxed risk sentence", () => {
    const result = analyzeRiskWarning({
      markdown: "> 技术分析不是圣杯。请配合风险管理一起使用。\n",
    });
    expect(result.status).toBe("gap");
  });

  it("keeps kind metadata (lesson vs readme) in the result", () => {
    expect(analyzeRiskWarning({ markdown: "", kind: "readme" }).kind).toBe("readme");
    expect(analyzeRiskWarning({ markdown: "::: warning ⚠️ 风险提示\nx\n:::\n", kind: "readme" })).toMatchObject({
      kind: "readme",
      status: "pass",
    });
  });

  it("renders a stable markdown report with status counts", () => {
    const lesson = { locale: "zh", chapter: "spot", document: "spot-basics", ...analyzeRiskWarning({ markdown: "::: warning ⚠️ 风险提示\nx\n:::\n", kind: "lesson" }) };
    const readme = { locale: "en", chapter: "spot", document: "README", ...analyzeRiskWarning({ markdown: "> 正文仅介绍现货买卖流程。\n", kind: "readme" }) };
    const markdown = renderRiskWarningMarkdown({ generatedAt: "2026-09-06", results: [lesson, readme] });
    expect(markdown).toContain("zh：1 篇课程");
    expect(markdown).toContain("待处理清单");
    expect(markdown).toContain("| gap | en | spot | README | readme |");
    expect(markdown).toContain("2026-09-06");
  });
});
