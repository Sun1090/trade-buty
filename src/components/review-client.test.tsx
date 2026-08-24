// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReviewClient } from "./review-client";
import type { ChapterQuiz } from "@/lib/quiz-types";

vi.mock("@/lib/wrongbook", () => ({
  readWrong: () => ({}),
  resolveWrong: vi.fn(),
}));
vi.mock("@/components/use-local-progress", () => ({
  useLocalProgress: () => null,
}));

const quizzes: ChapterQuiz[] = [
  {
    chapterNum: "spot",
    title: "现货测验",
    questions: [{ question: "Q", options: ["a", "b"], answer: 0, explain: "e" }],
  },
];

const dict = {
  title: "错题本", intro: "说明", label: "错题", showAnswer: "看答案",
  yourPick: "你选", correctPick: "正确", resolved: "已掌握", empty: "空空如也",
  emptyHint: "去做测验", browseCta: "浏览课程",
};

describe("ReviewClient (空态)", () => {
  it("无错题显示空态", () => {
    render(<ReviewClient quizzes={quizzes} dict={dict} locale="zh" />);
    expect(screen.getByText("空空如也")).toBeInTheDocument();
  });

  it("空态显示引导 CTA", () => {
    const { container } = render(<ReviewClient quizzes={quizzes} dict={dict} locale="zh" />);
    expect(container.textContent).toContain("浏览课程");
  });
});
