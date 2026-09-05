// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { AiQuiz } from "./ai-quiz";

// jsdom 环境无 localStorage，用 Map mock（同 daily-goal.test.ts 惯例）
const store = new Map<string, string>();
const localStorageMock = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => store.set(k, v),
  removeItem: (k: string) => store.delete(k),
  clear: () => store.clear(),
};
vi.stubGlobal("localStorage", localStorageMock);

const { readWrong } = await import("@/lib/wrongbook");

afterEach(() => {
  cleanup();
  store.clear();
  vi.unstubAllGlobals();
});

const dict = {
  generate: "AI 针对错题出变体题",
  generating: "正在生成…",
  error: "生成失败，请重试",
  question: "题目",
  explain: "解析",
  report: "举报题目",
  reported: "已举报",
  badge: "AI 变体题",
  correct: "正确",
  wrong: "错误",
  next: "下一题 →",
  done: "完成",
};

const wrongItems = [{ chapterNum: "getting-started", questionIdx: 2 }];
const questions = [
  {
    question: "变体题：止损的核心目的是什么？",
    options: ["限制单笔亏损", "预测走势", "加仓信号", "提高收益"],
    answer: 0,
    explain: "止损用于限制单笔亏损。",
  },
];

function setup() {
  return vi.fn(async (url: string) => {
    if (url === "/api/ai/quiz") {
      return { ok: true, status: 200, json: async () => ({ questions }) } as unknown as Response;
    }
    if (url === "/api/ai/feedback") {
      return { ok: true, status: 200, json: async () => ({ ok: true }) } as Response;
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
}

async function generateQuestions() {
  fireEvent.click(screen.getByText(dict.generate));
  await screen.findByText(questions[0].question);
}

describe("AiQuiz 错题本打通与幂等（R2.6/R2.8/R2.11）", () => {
  it("答错变体题刷新错题本条目（保留在错题本）", async () => {
    vi.stubGlobal("fetch", setup());
    render(<AiQuiz wrongItems={wrongItems} quizzes={[]} dict={dict} />);
    await generateQuestions();
    fireEvent.click(screen.getByText("预测走势"));
    const w = readWrong();
    expect(w["getting-started:2"]).toBeDefined();
    expect(w["getting-started:2"].picked).toBe(1);
  });

  it("答对变体题移出错题本", async () => {
    store.set("tb-wrong", JSON.stringify({
      "getting-started:2": { chapterNum: "getting-started", questionIdx: 2, picked: 1, at: 1 },
    }));
    vi.stubGlobal("fetch", setup());
    render(<AiQuiz wrongItems={wrongItems} quizzes={[]} dict={dict} />);
    await generateQuestions();
    fireEvent.click(screen.getByText("限制单笔亏损"));
    expect(readWrong()["getting-started:2"]).toBeUndefined();
  });

  it("重复作答被阻止（幂等）：已作答后再次点击不改变结果", async () => {
    vi.stubGlobal("fetch", setup());
    render(<AiQuiz wrongItems={wrongItems} quizzes={[]} dict={dict} />);
    await generateQuestions();
    fireEvent.click(screen.getByText("限制单笔亏损"));
    fireEvent.click(screen.getByText("预测走势")); // 第二次点击应无效
    expect(readWrong()["getting-started:2"]).toBeUndefined();
    expect(screen.getByText("✅ 正确")).toBeInTheDocument();
  });

  it("举报按钮调用 feedback API 且只报一次", async () => {
    const fetchMock = setup();
    vi.stubGlobal("fetch", fetchMock);
    render(<AiQuiz wrongItems={wrongItems} quizzes={[]} dict={dict} />);
    await generateQuestions();
    fireEvent.click(screen.getByText("限制单笔亏损"));
    const reportBtn = screen.getByText(`⚑ ${dict.report}`);
    fireEvent.click(reportBtn);
    fireEvent.click(reportBtn); // 重复点击不重复上报
    const calls = fetchMock.mock.calls.filter((c) => c[0] === "/api/ai/feedback") as unknown as [string, RequestInit][];
    expect(calls).toHaveLength(1);
    expect(JSON.parse(calls[0][1].body as string).rating).toBe("unhelpful");
    expect(screen.getByText(dict.reported)).toBeInTheDocument();
  });
});
