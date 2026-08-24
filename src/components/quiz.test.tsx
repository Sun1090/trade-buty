// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Quiz } from "./quiz";
import type { ChapterQuiz } from "@/lib/quiz-types";

vi.mock("@/lib/wrongbook", () => ({
  recordWrong: vi.fn(),
  resolveWrong: vi.fn(),
}));
vi.mock("@/lib/quiz-store", () => ({
  readQuizProgress: () => null,
  saveQuizProgress: vi.fn(),
}));

const quiz: ChapterQuiz = {
  chapterNum: "spot",
  title: "现货测验",
  questions: [
    { question: "1+1?", options: ["1", "2", "3"], answer: 1, explain: "1+1=2" },
  ],
};

const dict = {
  questionsUnit: "题", bestTpl: "最佳 {n}/{total}",
  start: "开始", retry: "重试", progressTpl: "{i}/{n}",
  correct: "对", wrong: "错", nextQ: "下一题", finish: "完成", perfect: "满分",
};

describe("Quiz", () => {
  it("未开始显示标题和开始按钮", () => {
    render(<Quiz quiz={quiz} dict={dict} />);
    expect(screen.getByText(/现货测验/)).toBeInTheDocument();
    expect(screen.getByText("开始")).toBeInTheDocument();
  });

  it("点击开始显示第一道题", () => {
    const { container } = render(<Quiz quiz={quiz} dict={dict} />);
    const btn = container.querySelector("button");
    fireEvent.click(btn!);
    expect(container.textContent).toContain("1+1");
  });

  it("选答案后显示对/错", () => {
    const { container } = render(<Quiz quiz={quiz} dict={dict} />);
    fireEvent.click(container.querySelector("button")!);
    // 选第二个选项（正确答案 answer=1）
    const opts = container.querySelectorAll("ul li");
    expect(opts.length).toBe(3);
    fireEvent.click(opts[1]);
    expect(container.textContent).toContain("对");
  });
});
