// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { ChapterExamCard } from "./chapter-exam-card";
import type { ChapterQuiz } from "@/lib/quiz-types";

const readQuizProgress = vi.hoisted(() => vi.fn());
vi.mock("@/lib/quiz-store", () => ({ readQuizProgress }));

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
  correct: "对", wrong: "错", nextQ: "下一题", skip: "跳过", finish: "完成", perfect: "满分",
  shareQuiz: "分享", previewQuiz: "预览", download: "下载", previewAlt: "预览", copyLink: "复制链接", copiedLink: "已复制", copyFailed: "复制失败", downloadFailed: "下载失败",
};

function renderCard() {
  return render(<ChapterExamCard quiz={quiz} dict={dict} locale="zh" />);
}

beforeEach(() => {
  readQuizProgress.mockReturnValue(null);
});

describe("ChapterExamCard", () => {
  it("渲染测验标题", () => {
    renderCard();
    expect(screen.getByText(/现货测验/)).toBeInTheDocument();
  });

  it("显示题数", () => {
    const { container } = renderCard();
    expect(container.textContent).toContain("1");
    expect(container.textContent).toContain("题");
  });

  it("点击展开显示 Quiz 组件", () => {
    const { container } = renderCard();
    const btn = container.querySelector("button");
    expect(btn).toBeTruthy();
    fireEvent.click(btn!);
    // 展开后显示 Quiz 的开始按钮（两层开始）
    expect(container.textContent).toContain("现货测验");
  });

  // 成绩在 localStorage 里：服务端快照必须是「无进度」，否则 SSG 的 HTML 与客户端
  // 首帧对不上（ prerender 时是「开始」，hydrate 时已经是「重试 · 最佳 1/1」）。
  it("服务端快照固定用无进度形态，不泄漏本地成绩", () => {
    readQuizProgress.mockReturnValue({ best: 1, done: true });
    const html = renderToString(<ChapterExamCard quiz={quiz} dict={dict} locale="zh" />);
    expect(html).toContain("开始");
    expect(html).not.toContain("重试");
    expect(html).not.toContain("最佳 1/1");
  });

  it("客户端挂载后对齐本地成绩", () => {
    readQuizProgress.mockReturnValue({ best: 1, done: true });
    const { container } = renderCard();
    expect(container.textContent).toContain("重试");
    expect(container.textContent).toContain("最佳 1/1");
  });

  // 答完一套题后 quiz-store 派发 tb-progress；不重新挂载也必须看到新成绩
  it("保存成绩后（tb-progress）就地更新按钮与历史最佳", () => {
    const { container } = renderCard();
    expect(container.textContent).toContain("开始");

    readQuizProgress.mockReturnValue({ best: 1, done: true });
    act(() => {
      window.dispatchEvent(new Event("tb-progress"));
    });

    expect(container.textContent).toContain("重试");
    expect(container.textContent).toContain("最佳 1/1");
  });
});
