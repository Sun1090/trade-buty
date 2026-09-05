// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { AiChapterQuizCard } from "./ai-chapter-quiz";

afterEach(cleanup);

const dict = {
  start: "AI 智能出题",
  generating: "AI 正在出题…",
  badge: "AI 生成",
  loginRequired: "登录后可用 AI 出题",
  error: "AI 出题暂时不可用",
  fallback: "已回退站方题库",
  correct: "✅ 答对了",
  wrong: "❌ 不对，看解析",
  next: "下一题 →",
  done: "完成",
  disclaimer: "⚠️ 仅用于学习",
  basic: "入门",
  advanced: "进阶",
  report: "举报题目",
  reported: "已举报",
};

const questions = [
  {
    question: "止损单的作用是什么？",
    options: ["限制亏损", "保证盈利", "提高杠杆", "降低手续费"],
    answer: 0,
    explain: "止损单在价格触及预设位时自动平仓，限制单笔亏损。",
  },
];

function setup(status = 200, body: unknown = { questions, source: "ai" }) {
  return vi.fn(async () => ({
    ok: status < 400,
    status,
    json: async () => body,
  }) as unknown as Response);
}

describe("AiChapterQuizCard", () => {
  it("入口态：标题 + AI 生成徽标 + 开始按钮", () => {
    const { container } = render(<AiChapterQuizCard chapter="spot" locale="zh" dict={dict} />);
    expect(screen.getByRole("button", { name: dict.start })).toBeInTheDocument();
    expect(container.textContent).toContain(dict.badge);
  });

  it("未登录 401：展示登录引导，不出题", async () => {
    vi.stubGlobal("fetch", setup(401, { error: "Login required" }));
    const { container } = render(<AiChapterQuizCard chapter="spot" locale="zh" dict={dict} />);
    fireEvent.click(screen.getByRole("button", { name: dict.start }));
    expect(await screen.findByText(dict.loginRequired)).toBeInTheDocument();
    expect(container.textContent).not.toContain(questions[0].question);
  });

  it("出题成功：渲染题目，作答后显示解析，答完返回入口", async () => {
    vi.stubGlobal("fetch", setup());
    const { container } = render(<AiChapterQuizCard chapter="spot" locale="zh" dict={dict} />);
    fireEvent.click(screen.getByRole("button", { name: dict.start }));
    expect(await screen.findByText(questions[0].question)).toBeInTheDocument();

    fireEvent.click(screen.getByText("限制亏损"));
    expect(container.textContent).toContain(dict.correct);
    expect(container.textContent).toContain(questions[0].explain);

    fireEvent.click(screen.getByText(dict.done));
    expect(container.textContent).toContain(dict.badge);
    expect(container.textContent).not.toContain(questions[0].question);
  });

  it("fallback 来源显示回退标识", async () => {
    vi.stubGlobal("fetch", setup(200, { questions, source: "fallback" }));
    const { container } = render(<AiChapterQuizCard chapter="spot" locale="zh" dict={dict} />);
    fireEvent.click(screen.getByRole("button", { name: dict.start }));
    await screen.findByText(questions[0].question);
    expect(container.textContent).toContain(dict.fallback);
  });

  it("AI 失败（无固定题场景）：展示错误文案不白屏", async () => {
    vi.stubGlobal("fetch", setup(502, { error: "AI quiz error" }));
    const { container } = render(<AiChapterQuizCard chapter="spot" locale="zh" dict={dict} />);
    fireEvent.click(screen.getByRole("button", { name: dict.start }));
    expect(await screen.findByText(dict.error)).toBeInTheDocument();
    expect(container.textContent).toContain(dict.start);
  });
});
