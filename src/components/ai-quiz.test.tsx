// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { AiQuiz } from "./ai-quiz";

// jsdom 环境无 localStorage，用 Map mock（同 daily-goal.test.ts 惯例）
const store = new Map<string, string>();
const localStorageMock = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => store.set(k, v),
  removeItem: (k: string) => store.delete(k),
  clear: () => store.clear(),
};
beforeEach(() => {
  vi.stubGlobal("localStorage", localStorageMock);
});

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
  loginRequired: "登录后可用 AI 出题",
  rateLimited: "请求过于频繁，请稍后再试",
  retryInTpl: "约 {n} 分钟后重试",
  question: "题目",
  explain: "解析",
  report: "举报题目",
  reported: "已举报",
  reportFailed: "举报没送出去，点这里重试",
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
  it("R5.5：答错变体题重置 SRS 阶段并排到明天", async () => {
    vi.stubGlobal("fetch", setup());
    render(<AiQuiz wrongItems={wrongItems} dict={dict} />);
    await generateQuestions();
    fireEvent.click(screen.getByText("预测走势"));
    const w = readWrong();
    expect(w["getting-started:2"]).toBeDefined();
    expect(w["getting-started:2"].picked).toBe(1);
    expect(w["getting-started:2"].srsStage).toBe(0);
    expect(w["getting-started:2"].srsDue).toBeDefined();
  });

  it("R5.5：答对推进 SRS 阶段；走完间隔表后掌握并移出错题本", async () => {
    // 最后一档（stage=4）答对 → mastered 移出
    store.set("tb-wrong", JSON.stringify({
      "getting-started:2": { chapterNum: "getting-started", questionIdx: 2, picked: 1, at: 1, srsStage: 4, srsDue: "2020-01-01" },
    }));
    vi.stubGlobal("fetch", setup());
    render(<AiQuiz wrongItems={wrongItems} dict={dict} />);
    await generateQuestions();
    fireEvent.click(screen.getByText("限制单笔亏损"));
    expect(readWrong()["getting-started:2"]).toBeUndefined();
  });

  it("R5.5：中间阶段答对 → 阶段 +1、到期日推后", async () => {
    store.set("tb-wrong", JSON.stringify({
      "getting-started:2": { chapterNum: "getting-started", questionIdx: 2, picked: 1, at: 1, srsStage: 1, srsDue: "2020-01-01" },
    }));
    vi.stubGlobal("fetch", setup());
    render(<AiQuiz wrongItems={wrongItems} dict={dict} />);
    await generateQuestions();
    fireEvent.click(screen.getByText("限制单笔亏损"));
    const entry = readWrong()["getting-started:2"];
    expect(entry).toBeDefined();
    expect(entry.srsStage).toBe(2);
    expect(entry.srsDue! > "2020-01-01").toBe(true);
  });

  it("重复作答被阻止（幂等）：已作答后再次点击不改变 SRS 状态", async () => {
    vi.stubGlobal("fetch", setup());
    render(<AiQuiz wrongItems={wrongItems} dict={dict} />);
    await generateQuestions();
    fireEvent.click(screen.getByText("限制单笔亏损"));
    const first = readWrong()["getting-started:2"];
    expect(first.srsStage).toBe(1); // R5.5：答对推进到 stage1
    fireEvent.click(screen.getByText("预测走势")); // 第二次点击应无效
    const after = readWrong()["getting-started:2"];
    expect(after.srsStage).toBe(first.srsStage);
    expect(after.srsDue).toBe(first.srsDue);
    expect(screen.getByText("✅ 正确")).toBeInTheDocument();
  });

  it("R13.9：选项是键盘可聚焦的按钮，作答后全部禁用", async () => {
    vi.stubGlobal("fetch", setup());
    render(<AiQuiz wrongItems={wrongItems} dict={dict} />);
    await generateQuestions();

    const optionA = screen.getByRole("button", { name: "A. 限制单笔亏损" });
    expect(optionA).toBeEnabled();
    fireEvent.click(optionA);

    expect(optionA).toBeDisabled();
    expect(screen.getByRole("button", { name: "B. 预测走势" })).toBeDisabled();
  });

  it("R2.6 契约：变体模式把错题的篇章 slug 原样发给 /api/ai/quiz", async () => {
    // 服务端 QUIZZES 的键是英文 slug（getting-started…），客户端必须传同一种形状。
    // 曾经服务端拿 /^\d{1,3}$/ 校验 chapterNum，把这条通路整段打死。
    const fetchMock = setup();
    vi.stubGlobal("fetch", fetchMock);
    render(<AiQuiz wrongItems={wrongItems} dict={dict} />);
    await generateQuestions();

    const quizCalls = fetchMock.mock.calls.filter((c) => c[0] === "/api/ai/quiz") as unknown as [string, RequestInit][];
    expect(quizCalls).toHaveLength(1);
    expect(JSON.parse(quizCalls[0][1].body as string)).toEqual({
      items: [{ chapterNum: "getting-started", questionIdx: 2 }],
    });
  });

  it("举报按钮调用 feedback API 且只报一次", async () => {
    const fetchMock = setup();
    vi.stubGlobal("fetch", fetchMock);
    render(<AiQuiz wrongItems={wrongItems} dict={dict} />);
    await generateQuestions();
    fireEvent.click(screen.getByText("限制单笔亏损"));
    const reportBtn = screen.getByText(`⚑ ${dict.report}`);
    fireEvent.click(reportBtn);
    fireEvent.click(reportBtn); // 送出途中再点不重复上报
    // 服务端点头之后才允许说「已举报」
    await waitFor(() => expect(screen.getByText(dict.reported)).toBeDisabled());
    const calls = fetchMock.mock.calls.filter((c) => c[0] === "/api/ai/feedback") as unknown as [string, RequestInit][];
    expect(calls).toHaveLength(1);
    expect(JSON.parse(calls[0][1].body as string).rating).toBe("unhelpful");
  });

  it("送出途中也不得提前说「已举报」", async () => {
    let release: (value: { ok: boolean }) => void = () => {};
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/ai/quiz") return Promise.resolve({ ok: true, json: async () => ({ questions }) });
      return new Promise<{ ok: boolean }>((resolve) => {
        release = resolve;
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<AiQuiz wrongItems={wrongItems} dict={dict} />);
    await generateQuestions();
    fireEvent.click(screen.getByText("限制单笔亏损"));
    fireEvent.click(screen.getByText(`⚑ ${dict.report}`));
    // 请求还挂着：按钮锁住防重复，但话还没说出口
    await waitFor(() =>
      expect(screen.getByRole("button", { name: `⚑ ${dict.report}` })).toBeDisabled(),
    );
    expect(screen.queryByText(dict.reported)).toBeNull();
    release({ ok: true });
    await waitFor(() => expect(screen.getByText(dict.reported)).toBeInTheDocument());
  });
});

describe("AiQuiz 入口、错误态与多题流程", () => {
  it("AI 禁用或没有错题时隐藏/禁用入口", () => {
    const { rerender } = render(<AiQuiz wrongItems={wrongItems} dict={dict} aiEnabled={false} />);
    expect(screen.queryByText(dict.generate)).not.toBeInTheDocument();

    rerender(<AiQuiz wrongItems={[]} dict={dict} />);
    expect(screen.getByRole("button", { name: /AI 针对错题出变体题/ })).toBeDisabled();
  });

  it("失败文案按状态码分三种说法，不把上游状态串摆到界面上（R16.54）", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ error: "Login required" }) })
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: { get: () => "120" },
        json: async () => ({ error: "Rate limit exceeded" }),
      })
      .mockResolvedValueOnce({ ok: false, status: 502, json: async () => ({ error: "AI 服务暂时不可用" }) })
      .mockRejectedValueOnce("offline");
    vi.stubGlobal("fetch", fetchMock);
    render(<AiQuiz wrongItems={wrongItems} dict={dict} />);

    fireEvent.click(screen.getByText(dict.generate));
    expect(await screen.findByText(dict.loginRequired)).toBeInTheDocument();
    fireEvent.click(screen.getByText(dict.generate));
    expect(
      await screen.findByText(`${dict.rateLimited} · 约 2 分钟后重试`)
    ).toBeInTheDocument();
    fireEvent.click(screen.getByText(dict.generate));
    expect(await screen.findByText(dict.error)).toBeInTheDocument();
    fireEvent.click(screen.getByText(dict.generate));
    expect(await screen.findByText(dict.error)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(4);
    // 上游的三条状态串一条都不该出现在屏幕上
    for (const raw of ["Login required", "Rate limit exceeded", "AI 服务暂时不可用"]) {
      expect(screen.queryByText(raw), `上游状态串漏到了界面上：${raw}`).not.toBeInTheDocument();
    }
  });

  it("多题可进入下一题，末题完成后回到生成入口", async () => {
    const twoQuestions = [questions[0], {
      question: "变体题：仓位控制的主要作用是什么？",
      options: ["控制风险敞口", "保证盈利", "预测价格", "消除滑点"],
      answer: 0,
      explain: "仓位控制用于限制总体风险敞口。",
    }];
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ questions: twoQuestions }),
    })));
    render(<AiQuiz wrongItems={wrongItems} dict={dict} />);

    fireEvent.click(screen.getByText(dict.generate));
    await screen.findByText(twoQuestions[0].question);
    fireEvent.click(screen.getByText("限制单笔亏损"));
    fireEvent.click(screen.getByText(dict.next));
    expect(await screen.findByText(twoQuestions[1].question)).toBeInTheDocument();
    expect(screen.getByText("AI 变体题 2/2")).toBeInTheDocument();

    fireEvent.click(screen.getByText("控制风险敞口"));
    fireEvent.click(screen.getByText(dict.done));
    expect(screen.getByText(dict.generate)).toBeInTheDocument();
  });

  it("举报没送出去时不说「已举报」，而且可以再点一次", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/ai/quiz") return { ok: true, json: async () => ({ questions }) };
      throw new Error("feedback offline");
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<AiQuiz wrongItems={wrongItems} dict={dict} />);
    await generateQuestions();
    fireEvent.click(screen.getByText("限制单笔亏损"));
    fireEvent.click(screen.getByText(`⚑ ${dict.report}`));
    const retry = await screen.findByText(`⚠ ${dict.reportFailed}`);
    expect(screen.queryByText(dict.reported)).toBeNull();
    expect(retry).toBeEnabled();
    // 失败必须可重试：再点一次真的再发一遍
    fireEvent.click(retry);
    await waitFor(() =>
      expect(fetchMock.mock.calls.filter(([u]) => u === "/api/ai/feedback")).toHaveLength(2),
    );
  });

  it("服务端回非 2xx 时同样不算举报成功", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/ai/quiz") return { ok: true, json: async () => ({ questions }) };
      return { ok: false, status: 500 };
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<AiQuiz wrongItems={wrongItems} dict={dict} />);
    await generateQuestions();
    fireEvent.click(screen.getByText("限制单笔亏损"));
    fireEvent.click(screen.getByText(`⚑ ${dict.report}`));
    expect(await screen.findByText(`⚠ ${dict.reportFailed}`)).toBeEnabled();
    expect(screen.queryByText(dict.reported)).toBeNull();
  });
});
