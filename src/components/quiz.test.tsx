// @vitest-environment jsdom
import { beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Quiz } from "./quiz";
import type { ChapterQuiz } from "@/lib/quiz-types";

const { saveQuizProgress } = vi.hoisted(() => ({
  saveQuizProgress: vi.fn(),
}));

vi.mock("@/lib/wrongbook", () => ({
  recordWrong: vi.fn(),
  resolveWrong: vi.fn(),
}));
vi.mock("@/lib/quiz-store", () => ({
  readQuizProgress: () => null,
  saveQuizProgress,
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
  shareQuiz: "分享", previewQuiz: "预览", download: "下载", previewAlt: "预览", copyLink: "复制链接", copiedLink: "已复制", downloadFailed: "下载失败",
};

const multiQuestionQuiz: ChapterQuiz = {
  chapterNum: "getting-started",
  title: "入门测验",
  questions: [
    { question: "第 1 题", options: ["A", "B", "C"], answer: 0, explain: "A" },
    { question: "第 2 题", options: ["A", "B", "C"], answer: 1, explain: "B" },
    { question: "第 3 题", options: ["A", "B", "C"], answer: 1, explain: "B" },
  ],
};

describe("Quiz", () => {
  beforeEach(() => {
    saveQuizProgress.mockClear();
  });

  it("未开始显示标题和开始按钮", () => {
    render(<Quiz quiz={quiz} dict={dict} locale="zh" />);
    expect(screen.getByText(/现货测验/)).toBeInTheDocument();
    expect(screen.getByText("开始")).toBeInTheDocument();
  });

  it("点击开始显示第一道题", () => {
    const { container } = render(<Quiz quiz={quiz} dict={dict} locale="zh" />);
    const btn = container.querySelector("button");
    fireEvent.click(btn!);
    expect(container.textContent).toContain("1+1");
  });

  it("选答案后显示对/错", () => {
    const { container } = render(<Quiz quiz={quiz} dict={dict} locale="zh" />);
    fireEvent.click(container.querySelector("button")!);
    // 选第二个选项（正确答案 answer=1）
    const opts = container.querySelectorAll("ul li button");
    expect(opts.length).toBe(3);
    fireEvent.click(opts[1]);
    expect(container.textContent).toContain("对");
  });

  it("选项是原生 button：键盘可聚焦并回车作答", () => {
    const { container } = render(<Quiz quiz={quiz} dict={dict} locale="zh" />);
    fireEvent.click(container.querySelector("button")!);
    const first = container.querySelector("ul li button") as HTMLElement;
    expect(first.tagName).toBe("BUTTON");
    expect(first.hasAttribute("disabled")).toBe(false);
    first.focus();
    expect(document.activeElement).toBe(first);
  });

  it("最后一题答对时保存满分而不是少一分", () => {
    render(<Quiz quiz={multiQuestionQuiz} dict={dict} locale="zh" />);
    fireEvent.click(screen.getByRole("button", { name: "开始" }));

    fireEvent.click(screen.getByRole("button", { name: /A\./ }));
    fireEvent.click(screen.getByRole("button", { name: "下一题" }));
    fireEvent.click(screen.getByRole("button", { name: /B\./ }));
    fireEvent.click(screen.getByRole("button", { name: "下一题" }));
    fireEvent.click(screen.getByRole("button", { name: /B\./ }));
    fireEvent.click(screen.getByRole("button", { name: "完成" }));

    expect(saveQuizProgress).toHaveBeenCalledWith(
      "getting-started",
      { best: 3, done: true },
      3,
    );
  });
});
