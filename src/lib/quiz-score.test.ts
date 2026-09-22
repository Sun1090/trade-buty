import { describe, expect, it } from "vitest";
import { quizScoreCount, quizScorePct } from "./quiz-score";

describe("quizScorePct", () => {
  it("正常得分四舍五入成百分数", () => {
    expect(quizScorePct(7, 10)).toBe(70);
    expect(quizScorePct(2, 3)).toBe(67);
  });

  it("题库改小后存档的 best 超过当前题数：封顶 100，不出现 120%", () => {
    expect(quizScorePct(12, 10)).toBe(100);
  });

  it("没有题数或没有得分时为 0，不除零", () => {
    expect(quizScorePct(5, 0)).toBe(0);
    expect(quizScorePct(0, 10)).toBe(0);
  });
});

describe("quizScoreCount", () => {
  it("正常分数原样写出", () => {
    expect(quizScoreCount(2, 10)).toBe(2);
    expect(quizScoreCount(10, 10)).toBe(10);
  });

  it("存档超过当前题数时按题数封顶：不写「99/3」", () => {
    expect(quizScoreCount(99, 3)).toBe(3);
  });

  it("没有题数或没有得分时为 0", () => {
    expect(quizScoreCount(5, 0)).toBe(0);
    expect(quizScoreCount(0, 10)).toBe(0);
  });
});
