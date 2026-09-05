import { describe, it, expect, vi } from "vitest";
import { buildRagContext, SYSTEM_PROMPT, pickRandomQuestions, buildChapterQuizPrompt } from "./prompt";

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

describe("getRefusalMessage", () => {
  it("中英文与分类返回不同话术且可读", async () => {
    const { getRefusalMessage } = await import("./prompt");
    const zhPick = getRefusalMessage("stock-pick", "zh");
    const zhProfit = getRefusalMessage("profit-promise", "zh");
    const enPick = getRefusalMessage("stock-pick", "en");
    expect(zhPick).not.toBe(zhProfit);
    expect(zhProfit).toContain("收益");
    expect(enPick).toContain("recommend");
  });
});

describe("pickRandomQuestions", () => {
  const pool = ["a", "b", "c", "d", "e"];

  it("抽取数量正确且全部来自问题池", () => {
    const picked = pickRandomQuestions(pool, 3);
    expect(picked).toHaveLength(3);
    for (const q of picked) expect(pool).toContain(q);
  });

  it("不修改原数组", () => {
    const copy = [...pool];
    pickRandomQuestions(pool, 5);
    expect(pool).toEqual(copy);
  });

  it("count 超过池大小时返回整个池且无重复", () => {
    const picked = pickRandomQuestions(pool, 10);
    expect(picked).toHaveLength(5);
    expect(new Set(picked).size).toBe(5);
  });

  it("count 为 0 或负数返回空数组", () => {
    expect(pickRandomQuestions(pool, 0)).toEqual([]);
    expect(pickRandomQuestions(pool, -1)).toEqual([]);
  });

  it("固定随机源下结果可复现", () => {
    const seq = [0.9, 0.1, 0.5, 0.3, 0.7];
    let i = 0;
    const spy = vi.spyOn(Math, "random").mockImplementation(() => seq[i++ % seq.length]);
    const first = pickRandomQuestions(pool, 3);
    i = 0;
    const second = pickRandomQuestions(pool, 3);
    spy.mockRestore();
    expect(first).toEqual(second);
  });
});

describe("buildChapterQuizPrompt", () => {
  it("中文 prompt：含章节名、5 题、JSON 格式与教育红线", () => {
    const msgs = buildChapterQuizPrompt("行为金融", "## 章节：行为金融", "zh");
    expect(msgs[0].role).toBe("system");
    expect(msgs[0].content).toContain("章节：行为金融");
    expect(msgs[0].content).toContain("5 道选择题");
    expect(msgs[0].content).toContain("不荐股");
    expect(msgs[0].content).toContain("严格 JSON");
  });

  it("英文 locale 出英文题指令", () => {
    const msgs = buildChapterQuizPrompt("Behavioral Finance", "ctx", "en");
    expect(msgs[0].content).toContain("strict JSON, English");
    expect(msgs[0].content).toContain("Behavioral Finance");
  });

  it("难度档影响出题要求", () => {
    const basic = buildChapterQuizPrompt("止损", "ctx", "zh", "basic");
    const adv = buildChapterQuizPrompt("止损", "ctx", "zh", "advanced");
    expect(basic[0].content).toContain("入门");
    expect(adv[0].content).toContain("进阶");
  });
});
