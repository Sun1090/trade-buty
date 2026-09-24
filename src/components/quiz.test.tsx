// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Quiz } from "./quiz";
import type { ChapterQuiz } from "@/lib/quiz-types";
import { encodeQuiz } from "@/lib/share-decode";
import { addStudyTime } from "@/lib/study-time";
import { recordWrong, resolveWrong } from "@/lib/wrongbook";

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
vi.mock("@/lib/study-time", () => ({
  addStudyTime: vi.fn(),
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
  start: "开始", retry: "重试", progressTpl: "{i}/{n} 对 {c}",
  correct: "对", wrong: "错", nextQ: "下一题", skip: "跳过", finish: "完成", perfect: "满分",
  shareQuiz: "分享", previewQuiz: "预览", download: "下载", previewAlt: "预览", copyLink: "复制链接", copiedLink: "已复制", copyFailed: "复制失败", downloadFailed: "下载失败",
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

  it("跳过按钮的写法来自字典，而不是组件里写死的字", () => {
    render(<Quiz quiz={quiz} dict={{ ...dict, start: "Go", skip: "Skip this one" }} locale="en" />);
    fireEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(screen.getByRole("button", { name: "Skip this one" })).toBeInTheDocument();
  });

  it("点击开始显示第一道题", () => {
    const { container } = render(<Quiz quiz={quiz} dict={dict} locale="zh" />);
    const btn = container.querySelector("button");
    fireEvent.click(btn!);
    expect(container.textContent).toContain("1+1");
  });

  it("标题里的题数是真的落进句子，不是只剩量词", () => {
    render(<Quiz quiz={multiQuestionQuiz} dict={dict} locale="zh" />);
    expect(screen.getByText("3 题")).toBeInTheDocument();
  });

  it("答对数跟着作答走，那句「已答对」后面有数字", () => {
    const { container } = render(<Quiz quiz={quiz} dict={dict} locale="zh" />);
    fireEvent.click(container.querySelector("button")!);
    expect(screen.getByText("1/1 对 0")).toBeInTheDocument();

    const opts = container.querySelectorAll("ul li button");
    fireEvent.click(opts[1]);
    expect(screen.getByText("1/1 对 1")).toBeInTheDocument();
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

describe("Quiz progress, wrongbook, and share URL", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** 用时台账取墙钟差值，不钉住 Date.now 就会随并行负载在 0/1 秒之间抖动。 */
  function mockClock() {
    const state = { nowMs: 1_700_000_000_000 };
    vi.spyOn(Date, "now").mockImplementation(() => state.nowMs);
    return state;
  }

  it("writes wrong picks, resolves correct picks, and records quiz study time", () => {
    vi.mocked(recordWrong).mockClear();
    vi.mocked(resolveWrong).mockClear();
    vi.mocked(addStudyTime).mockClear();
    globalThis.localStorage.clear();
    mockClock();

    render(<Quiz quiz={multiQuestionQuiz} dict={dict} locale="zh" chapterTitle="入门基础" />);
    fireEvent.click(screen.getByRole("button", { name: "开始" }));

    fireEvent.click(screen.getByRole("button", { name: /C\./ }));
    expect(recordWrong).toHaveBeenCalledWith("getting-started", 0, 2);

    fireEvent.click(screen.getByRole("button", { name: "下一题" }));
    fireEvent.click(screen.getByRole("button", { name: /B\./ }));
    expect(resolveWrong).toHaveBeenCalledWith("getting-started", 1);
    expect(screen.getByText("对")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "下一题" }));
    fireEvent.click(screen.getByRole("button", { name: /B\./ }));
    fireEvent.click(screen.getByRole("button", { name: "完成" }));

    expect(saveQuizProgress).toHaveBeenCalledWith("getting-started", { best: 2, done: true }, 3);
    expect(addStudyTime).not.toHaveBeenCalled();
    expect(screen.getByText("重试")).toBeInTheDocument();
  });

  it("records the seconds spent between starting and finishing", () => {
    vi.mocked(addStudyTime).mockClear();
    globalThis.localStorage.clear();
    const clock = mockClock();

    render(<Quiz quiz={multiQuestionQuiz} dict={dict} locale="zh" chapterTitle="入门基础" />);
    fireEvent.click(screen.getByRole("button", { name: "开始" }));
    clock.nowMs += 42_000;
    fireEvent.click(screen.getByRole("button", { name: /A\./ }));
    fireEvent.click(screen.getByRole("button", { name: "下一题" }));
    fireEvent.click(screen.getByRole("button", { name: /B\./ }));
    fireEvent.click(screen.getByRole("button", { name: "下一题" }));
    fireEvent.click(screen.getByRole("button", { name: /B\./ }));
    fireEvent.click(screen.getByRole("button", { name: "完成" }));

    expect(addStudyTime).toHaveBeenCalledWith("quiz", 42);
  });

  it("caps recorded quiz study time at four hours", () => {
    vi.mocked(addStudyTime).mockClear();
    globalThis.localStorage.clear();
    const clock = mockClock();

    render(<Quiz quiz={multiQuestionQuiz} dict={dict} locale="zh" chapterTitle="入门基础" />);
    fireEvent.click(screen.getByRole("button", { name: "开始" }));
    clock.nowMs += 5 * 3600 * 1000;
    fireEvent.click(screen.getByRole("button", { name: /A\./ }));
    fireEvent.click(screen.getByRole("button", { name: "下一题" }));
    fireEvent.click(screen.getByRole("button", { name: /B\./ }));
    fireEvent.click(screen.getByRole("button", { name: "下一题" }));
    fireEvent.click(screen.getByRole("button", { name: /B\./ }));
    fireEvent.click(screen.getByRole("button", { name: "完成" }));

    expect(addStudyTime).toHaveBeenCalledWith("quiz", 4 * 3600);
  });

  it("builds a completed quiz share URL only after progress is done", async () => {
    globalThis.localStorage.clear();
    const encoded = encodeQuiz({
      chapterTitle: "Beginner Quiz",
      score: 3,
      total: 3,
      percent: 100,
      locale: "en",
    });
    expect(encoded).toMatch(/^v1\|/);

    render(<Quiz quiz={multiQuestionQuiz} dict={dict} locale="en" chapterTitle="Beginner Quiz" />);
    expect(screen.queryByTestId("quiz-share-btn")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "开始" }));
    fireEvent.click(screen.getByRole("button", { name: /A\./ }));
    fireEvent.click(screen.getByRole("button", { name: "下一题" }));
    fireEvent.click(screen.getByRole("button", { name: /B\./ }));
    fireEvent.click(screen.getByRole("button", { name: "下一题" }));
    fireEvent.click(screen.getByRole("button", { name: /B\./ }));
    fireEvent.click(screen.getByRole("button", { name: "完成" }));

    await waitFor(() => {
      expect(screen.getByTestId("quiz-share-btn")).toBeInTheDocument();
      expect(screen.getByTestId("quiz-share-link-btn")).toBeInTheDocument();
    });
  });

  it("supports keyboard shortcuts for picking and advancing questions", () => {
    render(<Quiz quiz={multiQuestionQuiz} dict={dict} locale="zh" />);
    fireEvent.click(screen.getByRole("button", { name: "开始" }));

    fireEvent.keyDown(window, { key: "a" });
    expect(screen.getByText("对")).toBeInTheDocument();
    expect(recordWrong).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { key: "Enter" });
    expect(screen.getByText("第 2 题")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "3" });
    expect(screen.getByText("错")).toBeInTheDocument();
    expect(recordWrong).toHaveBeenCalledWith("getting-started", 1, 2);

    fireEvent.keyDown(window, { key: " " });
    expect(screen.getByText("第 3 题")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "c" });
    expect(screen.getByText("错")).toBeInTheDocument();
    expect(recordWrong).toHaveBeenCalledWith("getting-started", 2, 2);

    fireEvent.keyDown(window, { key: " " });
    expect(screen.getByText("重试")).toBeInTheDocument();
  });

  it("ignores out-of-range keyboard shortcuts after a pick and skips only before a pick", () => {
    render(<Quiz quiz={multiQuestionQuiz} dict={dict} locale="zh" />);
    fireEvent.click(screen.getByRole("button", { name: "开始" }));
    fireEvent.keyDown(window, { key: "z" });
    // 判定反馈还没出现（进度行里也有「对」这个字，所以按整串匹配而不是子串）
    expect(screen.queryByText("对")).toBeNull();
    expect(screen.queryByText("错")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "跳过" }));
    expect(screen.getByText("第 2 题")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "b" });
    expect(screen.getByText("对")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "z" });
    expect(screen.getByText("第 2 题")).toBeInTheDocument();
  });
});
