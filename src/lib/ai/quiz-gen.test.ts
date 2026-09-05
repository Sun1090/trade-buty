import { describe, it, expect } from "vitest";
import { validateAiQuestions, bigramSimilarity, filterDuplicateQuestions } from "./quiz-gen";

const goodQ = {
  question: "什么是止损单？",
  options: ["A", "B", "C", "D"],
  answer: 1,
  explain: "止损单用于限制亏损。",
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
