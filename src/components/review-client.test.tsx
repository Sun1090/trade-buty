// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ReviewClient } from "./review-client";
import type { ChapterQuiz } from "@/lib/quiz-types";

const wrongState = vi.hoisted(() => ({
  items: {} as Record<string, { chapterNum: string; questionIdx: number; picked: number; at: number }>,
}));

vi.mock("@/lib/wrongbook", () => ({
  readWrong: () => wrongState.items,
  resolveWrong: vi.fn(),
  clearAllWrong: vi.fn(),
  applySrsResult: vi.fn(),
  pruneOrphanWrong: vi.fn(),
}));
vi.mock("@/lib/study-time", () => ({
  addStudyTime: vi.fn(),
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

describe("ReviewClient 重答选项键盘可达（R13.9）", () => {
  beforeEach(() => {
    wrongState.items = {
      "spot:0": { chapterNum: "spot", questionIdx: 0, picked: 0, at: 1 },
    };
  });

  afterEach(() => {
    wrongState.items = {};
  });

  it("重答选项是按钮，作答后禁用", () => {
    render(<ReviewClient quizzes={quizzes} dict={dict} locale="zh" />);
    fireEvent.click(screen.getByText("开始快速重答"));

    const optionA = screen.getByRole("button", { name: "A. a" });
    expect(optionA).toBeEnabled();
    fireEvent.click(optionA);
    expect(optionA).toBeDisabled();
  });
});
