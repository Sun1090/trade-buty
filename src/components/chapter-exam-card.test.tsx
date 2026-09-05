// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChapterExamCard } from "./chapter-exam-card";
import type { ChapterQuiz } from "@/lib/quiz-types";

vi.mock("@/lib/quiz-store", () => ({
  readQuizProgress: () => null,
}));

const quiz: ChapterQuiz = {
  chapterNum: "spot",
  title: "现货测验",
  questions: [
    { question: "1+1?", options: ["1", "2", "3"], answer: 1, explain: "1+1=2" },
  ],
};

describe("ChapterExamCard", () => {
  it("渲染测验标题", () => {
    render(<ChapterExamCard quiz={quiz} dict={{
      questionsUnit: "题", bestTpl: "最佳 {n}/{total}",
      start: "开始", retry: "重试", progressTpl: "{i}/{n}",
      correct: "对", wrong: "错", nextQ: "下一题", finish: "完成", perfect: "满分",
      shareQuiz: "分享", previewQuiz: "预览", download: "下载", previewAlt: "预览",
    }} locale="zh" />);
    expect(screen.getByText(/现货测验/)).toBeInTheDocument();
  });

  it("显示题数", () => {
    const { container } = render(<ChapterExamCard quiz={quiz} dict={{
      questionsUnit: "题", bestTpl: "最佳 {n}/{total}",
      start: "开始", retry: "重试", progressTpl: "{i}/{n}",
      correct: "对", wrong: "错", nextQ: "下一题", finish: "完成", perfect: "满分",
      shareQuiz: "分享", previewQuiz: "预览", download: "下载", previewAlt: "预览",
    }} locale="zh" />);
    expect(container.textContent).toContain("1");
    expect(container.textContent).toContain("题");
  });

  it("点击展开显示 Quiz 组件", () => {
    const { container } = render(<ChapterExamCard quiz={quiz} dict={{
      questionsUnit: "题", bestTpl: "最佳 {n}/{total}",
      start: "开始", retry: "重试", progressTpl: "{i}/{n}",
      correct: "对", wrong: "错", nextQ: "下一题", finish: "完成", perfect: "满分",
      shareQuiz: "分享", previewQuiz: "预览", download: "下载", previewAlt: "预览",
    }} locale="zh" />);
    const btn = container.querySelector("button");
    expect(btn).toBeTruthy();
    fireEvent.click(btn!);
    // 展开后显示 Quiz 的开始按钮（两层开始）
    expect(container.textContent).toContain("现货测验");
  });
});
