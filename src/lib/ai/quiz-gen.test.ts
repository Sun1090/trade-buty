import { describe, it, expect } from "vitest";
import {
  validateAiQuestions,
  auditAiQuestions,
  questionRelevanceScore,
  filterRelevantQuestions,
  MIN_QUESTION_RELEVANCE,
  bigramSimilarity,
  filterDuplicateQuestions,
} from "./quiz-gen";

const goodQ = {
  question: "什么是止损单？",
  options: ["A", "B", "C", "D"],
  answer: 1,
  explain: "止损单用于限制亏损。",
  source: { chapter: "behavioral-finance", doc: "behavioral-finance-basics" },
};

describe("validateAiQuestions", () => {
  it("合法题目保留", () => {
    expect(validateAiQuestions({ questions: [goodQ] })).toHaveLength(1);
  });

  it("缺字段/answer 越界/选项数不对的剔除", () => {
    const out = validateAiQuestions({
      questions: [
        goodQ,
        { ...goodQ, question: "" },
        { ...goodQ, answer: 4 },
        { ...goodQ, answer: -1 },
        { ...goodQ, options: ["A", "B", "C"] },
        { ...goodQ, explain: "" },
        "junk",
      ],
    });
    expect(out).toHaveLength(1);
  });

  it("非对象/无 questions 返回空数组", () => {
    expect(validateAiQuestions(null)).toEqual([]);
    expect(validateAiQuestions({})).toEqual([]);
    expect(validateAiQuestions({ questions: "x" })).toEqual([]);
  });

  it("接受合法知识库引用与显式无引用", () => {
    const out = validateAiQuestions({
      questions: [
        { ...goodQ },
        { ...goodQ, source: { none: true } },
      ],
    });
    expect(out).toHaveLength(2);
    expect(out[0].source).toEqual(goodQ.source);
    expect(out[1].source).toEqual({ none: true });
  });

  it("缺失引用、未知章节、未知文档、非法引用均剔除", () => {
    const out = validateAiQuestions({
      questions: [
        { ...goodQ, source: undefined },
        { ...goodQ, source: "behavioral-finance" },
        { ...goodQ, source: { chapter: "missing-chapter" } },
        { ...goodQ, source: { chapter: "behavioral-finance", doc: "missing-doc" } },
        { ...goodQ, source: { none: false } },
      ],
    });
    expect(out).toEqual([]);
  });

  it("英文 locale 使用英文题库标题映射校验引用", () => {
    const out = validateAiQuestions({
      questions: [{ ...goodQ, source: { chapter: "technical-analysis" } }],
    }, "en");
    expect(out).toHaveLength(1);
  });

  it("合法题目会 trim 文本字段", () => {
    const out = validateAiQuestions({
      questions: [{
        ...goodQ,
        question: "  什么是止损单？  ",
        options: [" A ", "B", "C", "D"],
        explain: " 止损单用于限制亏损。 ",
      }],
    });
    expect(out[0]).toEqual({
      question: "什么是止损单？",
      options: ["A", "B", "C", "D"],
      answer: 1,
      explain: "止损单用于限制亏损。",
      source: goodQ.source,
    });
  });

  it("不可作答题目会被剔除", () => {
    const out = validateAiQuestions({
      questions: [
        { ...goodQ, question: "短" },
        { ...goodQ, options: ["A", "a", "C", "D"] },
        { ...goodQ, explain: "正确" },
      ],
    });
    expect(out).toEqual([]);
  });
});
describe("filterRelevantQuestions", () => {
  it("剔除低于相关性阈值的题目", () => {
    const relevant = { ...goodQ, question: "保证金与杠杆有什么不同？" };
    const irrelevant = { ...goodQ, question: "如何准备早餐？" };
    expect(filterRelevantQuestions(
      [relevant, irrelevant],
      "保证金与杠杆是本章核心概念。",
    )).toEqual([relevant]);
  });

  it("无上下文时不生成不可验证的题目", () => {
    expect(filterRelevantQuestions([goodQ], "   ", MIN_QUESTION_RELEVANCE)).toEqual([]);
  });

  it("阈值可配置", () => {
    expect(filterRelevantQuestions(
      [{ ...goodQ, question: "止损单有什么作用？" }],
      "止损用于控制交易风险。",
      0.9,
    )).toEqual([]);
  });
});



describe("auditAiQuestions", () => {
  it("无效响应返回统一的根级诊断码", () => {
    expect(auditAiQuestions("junk")).toEqual([
      { questionIndex: 0, code: "not-object" },
    ]);
    expect(auditAiQuestions({})).toEqual([
      { questionIndex: 0, code: "missing-question" },
    ]);
  });

  it("返回逐题诊断码", () => {
    const issues = auditAiQuestions({
      questions: [
        goodQ,
        { ...goodQ, answer: 9, options: ["A", "a", "C", "D"] },
        null,
      ],
    });
    expect(issues).toEqual([
      { questionIndex: 1, code: "duplicate-option" },
      { questionIndex: 1, code: "answer-out-of-range" },
      { questionIndex: 2, code: "not-object" },
    ]);
  });

  it("返回引用可访问性诊断码", () => {
    const issues = auditAiQuestions({
      questions: [
        { ...goodQ, source: undefined },
        { ...goodQ, source: { chapter: "missing-chapter" } },
        { ...goodQ, source: { chapter: "behavioral-finance", doc: "missing-doc" } },
      ],
    });
    expect(issues).toEqual([
      { questionIndex: 0, code: "missing-source" },
      { questionIndex: 1, code: "unknown-source-chapter" },
      { questionIndex: 2, code: "unknown-source-doc" },
    ]);
  });
});

describe("questionRelevanceScore", () => {
  it("计算题干 token 与章节上下文的覆盖率", () => {
    expect(questionRelevanceScore("什么是止损和风险控制？", "本章介绍止损、风险控制和仓位管理。"))
      .toBeCloseTo(0.7, 5);
  });

  it("支持英文并对无内容输入返回 0", () => {
    expect(questionRelevanceScore("What is leverage?", "Leverage and margin basics"))
      .toBeCloseTo(1 / 3, 5);
    expect(questionRelevanceScore("", "leverage")).toBe(0);
  });
});

describe("bigramSimilarity", () => {
  it("相同题面相似度 1", () => {
    expect(bigramSimilarity("什么是止损", "什么是止损")).toBe(1);
  });

  it("完全不同接近 0", () => {
    expect(bigramSimilarity("K线形态", "资金费率")).toBeLessThan(0.2);
  });

  it("空串返回 0（不 NaN）", () => {
    expect(bigramSimilarity("", "abc")).toBe(0);
  });
});

describe("filterDuplicateQuestions", () => {
  it("与已有题高度相似的被剔除", () => {
    const dup = { ...goodQ, question: "什么是止损单?" };
    const fresh = { ...goodQ, question: "保证金和杠杆的关系是什么？" };
    const out = filterDuplicateQuestions([dup, fresh], ["什么是止损单？"]);
    expect(out.map((q) => q.question)).toEqual([fresh.question]);
  });

  it("新题之间也互相去重", () => {
    const a = { ...goodQ, question: "市价单和限价单的区别是什么？" };
    const b = { ...goodQ, question: "市价单与限价单的区别是什么？" };
    const out = filterDuplicateQuestions([a, b], []);
    expect(out).toHaveLength(1);
  });

  it("空已有题库时全保留", () => {
    expect(filterDuplicateQuestions([goodQ], [])).toHaveLength(1);
  });
});
