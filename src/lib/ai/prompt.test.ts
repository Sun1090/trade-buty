import { describe, it, expect } from "vitest";
import { buildRagContext, SYSTEM_PROMPT } from "./prompt";

describe("buildRagContext", () => {
  it("空数组返回空字符串", () => {
    expect(buildRagContext([])).toBe("");
  });

  it("单块含篇章和课程引用", () => {
    const out = buildRagContext([
      { chapter: "getting-started", doc: "market-overview", chunk: "市场是..." },
    ]);
    expect(out).toContain("篇章:getting-started");
    expect(out).toContain("课程:market-overview");
    expect(out).toContain("市场是...");
    expect(out).toContain("检索到的知识库内容");
  });

  it("多块用分隔线分开", () => {
    const out = buildRagContext([
      { chapter: "spot", doc: "a", chunk: "内容A" },
      { chapter: "futures", doc: "b", chunk: "内容B" },
    ]);
    expect(out).toContain("[1]");
    expect(out).toContain("[2]");
    expect(out).toContain("---");
  });

  it("不复制原文，只做引用提示", () => {
    const out = buildRagContext([
      { chapter: "c", doc: "d", chunk: "原文" },
    ]);
    expect(out).toContain("不要原文复制");
  });
});

describe("SYSTEM_PROMPT", () => {
  it("含教育约束：不荐股/不承诺", () => {
    expect(SYSTEM_PROMPT).toContain("绝不推荐");
    expect(SYSTEM_PROMPT).toContain("不承诺");
  });

  it("含免责声明模板", () => {
    expect(SYSTEM_PROMPT).toContain("不构成投资建议");
  });

  it("要求用用户语言回答", () => {
    expect(SYSTEM_PROMPT).toContain("用用户提问的语言");
  });
});

describe("buildNoContextGuidance", () => {
  it("要求坦诚说明且不编造", async () => {
    const { buildNoContextGuidance } = await import("./prompt");
    const out = buildNoContextGuidance([]);
    expect(out).toContain("坦诚");
    expect(out).toContain("编造");
  });

  it("有推荐章节时列出章节", async () => {
    const { buildNoContextGuidance } = await import("./prompt");
    const out = buildNoContextGuidance([
      { chapter: "spot", title: "现货篇" },
      { chapter: "futures", title: "期货篇" },
    ]);
    expect(out).toContain("现货篇");
    expect(out).toContain("期货篇");
  });
});

describe("buildHistorySummaryPrompt", () => {
  it("中文场景生成中文摘要指令", async () => {
    const { buildHistorySummaryPrompt } = await import("./prompt");
    const msgs = buildHistorySummaryPrompt(
      [{ role: "user", content: "什么是止损？" }],
      "zh"
    );
    expect(msgs).toHaveLength(2);
    expect(msgs[0].role).toBe("system");
    expect(msgs[1].content).toContain("什么是止损？");
  });

  it("英文场景生成英文摘要指令", async () => {
    const { buildHistorySummaryPrompt } = await import("./prompt");
    const msgs = buildHistorySummaryPrompt(
      [{ role: "assistant", content: "Stop loss is..." }],
      "en"
    );
    expect(msgs[0].content).toContain("summarizer");
  });
});
