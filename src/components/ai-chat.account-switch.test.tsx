// @vitest-environment jsdom
/**
 * 账号身份变化时，AI 对话面板必须放下上一个账号的云端历史。
 * `/api/ai/conversations` 按会话 cookie 返回内容，而组件过去只在挂载时拉一次、
 * 从不感知身份变化：登出或换号后，A 的问答会一直留在屏幕上给下一个人看。
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SUGGESTED_QUESTIONS_ZH } from "@/lib/ai/prompt";
import { getDict } from "@/lib/i18n";
import { AiChat } from "./ai-chat";

type AuthUser = { id: string; email: string | null } | null;
let authValue: AuthUser = { id: "user-a", email: "a@example.test" };

vi.mock("@/components/auth-provider", () => ({
  useAuth: () => authValue,
}));
vi.mock("next/dynamic", () => ({
  default: () =>
    function MarkdownStub({ content }: { content?: string }) {
      return <>{content}</>;
    },
}));

beforeAll(() => {
  Element.prototype.scrollTo = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  authValue = { id: "user-a", email: "a@example.test" };
});

const dict = {
  placeholder: "问任何交易问题",
  title: "交易学习助手",
  subtitle: "基于 27 篇章知识库回答你的交易问题。",
  thinking: "思考中…",
  error: "出错了",
  errorServer: "服务暂时不可用，请稍后再试",
  errorTimeout: "请求超时，请检查网络后重试",
  retry: "重试",
  clear: "清空对话",
  clearFailed: "云端对话未能清空，请稍后再试",
  copy: "复制",
  copied: "已复制",
  copyFailed: "复制失败",
  continueLabel: "继续生成",
  sourcesLabel: "来源",
  suggestedLabel: "相关章节",
  examplesLabel: "试试这样问",
  disclaimer: "⚠️ 仅用于学习",
  guestLimit: "本小时游客提问次数已用完，登录可获更多额度",
  accountLimit: "本小时提问次数已用完",
  retryInTpl: "约 {n} 分钟后重试",
  quotaRemaining: "游客每小时限 {l} 次，本小时剩余 {n} 次",
  quotaLoginHint: "本小时次数已用完，登录可获更多额度",
  contextBannerTpl: getDict("zh").ai.contextBannerTpl,
  threadTooLongTpl: getDict("zh").ai.threadTooLongTpl,
  answerTooLongTpl: getDict("zh").ai.answerTooLongTpl,
  followups: ["展开讲讲「{t}」", "「{t}」怎么用？", "「{t}」的误区？"],
  helpful: "有用",
  unhelpful: "无用",
  feedbackFailed: "这条反馈没送出去，请再点一次",
};

/** 历史接口按当前身份返回：A 有自己的对话，游客没有，B 只有一句开场。 */
function stubConversationsFetch() {
  return vi.fn(async (url: string) => {
    if (url !== "/api/ai/conversations") throw new Error(`unexpected fetch: ${url}`);
    const history =
      authValue?.id === "user-a"
        ? [{ role: "assistant", content: "A 的私密回答", sources: null }]
        : authValue?.id === "user-b"
          ? [{ role: "assistant", content: "B 的回答", sources: null }]
          : [];
    return { ok: true, status: 200, json: async () => ({ messages: history }) } as Response;
  });
}

function AiChatProbe() {
  return <AiChat locale="zh" dict={dict} />;
}

async function renderChat() {
  vi.stubGlobal("fetch", stubConversationsFetch());
  const view = render(<AiChatProbe />);
  await screen.findByText("A 的私密回答");
  return view;
}

describe("AiChat 账号身份变化", () => {
  it("登出后上一个账号的云端对话立刻从屏幕上消失", async () => {
    const { rerender } = await renderChat();

    authValue = null;
    rerender(<AiChatProbe />);

    await waitFor(() => expect(screen.queryByText("A 的私密回答")).toBeNull());
    expect(screen.queryByText("交易学习助手")).not.toBeNull();
  });

  it("换到另一个账号时不保留前一个账号的历史，也不自动拉新账号的历史", async () => {
    const { rerender } = await renderChat();

    authValue = { id: "user-b", email: "b@example.test" };
    rerender(<AiChatProbe />);

    await waitFor(() => expect(screen.queryByText("A 的私密回答")).toBeNull());
    // 新身份的历史要等重新加载页面：不清空反而是缺陷（会串号）
    expect(screen.queryByText("B 的回答")).toBeNull();
  });

  it("游客登录后继续当前会话，不被清空", async () => {
    authValue = null;
    vi.stubGlobal("fetch", stubConversationsFetch());
    const { rerender } = render(<AiChatProbe />);

    // 游客没有云端历史：组件不会去拉 conversations，也不该被后续身份变化清掉内容
    authValue = { id: "user-a", email: "a@example.test" };
    rerender(<AiChatProbe />);
    await waitFor(() => expect(screen.queryByText("A 的私密回答")).toBeNull());
    expect(screen.queryByText("交易学习助手")).not.toBeNull();
  });

  it("同一身份重复渲染（令牌刷新）不触碰已展示的对话", async () => {
    const { rerender } = await renderChat();

    rerender(<AiChatProbe />);
    rerender(<AiChatProbe />);

    expect(await screen.findByText("A 的私密回答")).toBeDefined();
  });
});

/** 流式回答：第一块立刻到达，收尾交给 release()——用来在「回答还没结束」时点清空。 */
function gatedStreamBody(text: string) {
  const enc = new TextEncoder();
  let stage = 0;
  let release: () => void = () => {};
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  return {
    release,
    getReader: () => ({
      async read() {
        if (stage === 0) {
          stage = 1;
          return { done: false, value: enc.encode(text) };
        }
        if (stage === 1) {
          stage = 2;
          await pending;
          return { done: true, value: undefined };
        }
        return { done: true, value: undefined };
      },
    }),
  };
}

type FetchCall = { url: string; method: string };

function stubChatFetch(
  calls: FetchCall[],
  body: unknown,
  opts: { deleteStatus?: number; history?: boolean } = {}
) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    const method = String(init?.method ?? "GET");
    calls.push({ url, method });
    if (url === "/api/ai/chat") {
      return { ok: true, status: 200, headers: { get: () => null }, body } as unknown as Response;
    }
    if (url === "/api/ai/conversations" && method === "DELETE") {
      const status = opts.deleteStatus ?? 200;
      return { ok: status === 200, status, json: async () => ({}) } as Response;
    }
    if (url === "/api/ai/conversations" && method === "POST") {
      return { ok: true, status: 200, json: async () => ({ ok: true }) } as Response;
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        messages: opts.history === false
          ? []
          : [{ role: "assistant", content: "A 的私密回答", sources: null }],
      }),
    } as Response;
  });
}

async function clickSuggestion(): Promise<void> {
  const target = [...document.querySelectorAll("button")].filter((button) =>
    SUGGESTED_QUESTIONS_ZH.includes(button.textContent ?? "")
  )[0];
  fireEvent.click(target);
  await screen.findByText("流式回答内容");
}

describe("AiChat 清空对话", () => {
  beforeEach(() => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("点「清空对话」连云端那一份一起删，不只是清屏幕", async () => {
    const calls: FetchCall[] = [];
    vi.stubGlobal("fetch", stubChatFetch(calls, gatedStreamBody("流式回答内容")));
    render(<AiChatProbe />);
    await screen.findByText("A 的私密回答");

    fireEvent.click(screen.getByRole("button", { name: "清空对话" }));

    await waitFor(() =>
      expect(calls).toContainEqual({ url: "/api/ai/conversations", method: "DELETE" })
    );
    expect(screen.queryByText("A 的私密回答")).toBeNull();
  });

  it("云端没删成时说「未能清空」，不假装已经清空", async () => {
    const calls: FetchCall[] = [];
    vi.stubGlobal("fetch", stubChatFetch(calls, gatedStreamBody("流式回答内容"), { deleteStatus: 500 }));
    render(<AiChatProbe />);
    await screen.findByText("A 的私密回答");

    fireEvent.click(screen.getByRole("button", { name: "清空对话" }));

    expect(await screen.findByText("云端对话未能清空，请稍后再试")).toBeDefined();
  });

  it("游客清空不发删除请求：游客的对话本来就不落库", async () => {
    authValue = null;
    const calls: FetchCall[] = [];
    vi.stubGlobal("fetch", stubChatFetch(calls, gatedStreamBody("流式回答内容"), { history: false }));
    render(<AiChatProbe />);
    await clickSuggestion();

    fireEvent.click(screen.getByRole("button", { name: "清空对话" }));

    expect(calls.some((call) => call.method === "DELETE")).toBe(false);
  });

  it("回答还在流式返回时点清空，那一轮不再被写回云端", async () => {
    const body = gatedStreamBody("流式回答内容");
    const calls: FetchCall[] = [];
    vi.stubGlobal("fetch", stubChatFetch(calls, body, { history: false }));
    render(<AiChatProbe />);
    await clickSuggestion();

    fireEvent.click(screen.getByRole("button", { name: "清空对话" }));
    body.release();
    // 输入框随 loading 一起解禁，而 loading 在归档判断之后的 finally 里才置回：
    // 等到它就能确定「归档那一刻已经发生」，不用靠墙钟定时器赌一个 tick。
    await waitFor(() =>
      expect(screen.getByPlaceholderText("问任何交易问题")).not.toBeDisabled()
    );

    // 归档发生在流结束后：没有这道闸，刚清掉的这轮会被 POST 原样写回去
    expect(calls.some((call) => call.method === "POST" && call.url === "/api/ai/conversations")).toBe(false);
  });
});

/**
 * R16.168：`/api/ai/chat` 的配额按身份分桶（游客 10 次/小时按 IP，登录 50 次/小时按 `user.id`，
 * `route.ts:31-34,67`），可 429 之后界面只有一句「本小时**游客**提问次数已用完，**登录**可获更多额度」。
 * 对一个已经登录、刚用完自己 50 次的人来说，这句话两半都是假的，而登录是他做不到的动作。
 * 身份这个组件本来就有（`auth?.id`，清空对话那条路径就在读它），不需要服务端多带一个字段。
 */
describe("AiChat 限流提示说对是谁的上限", () => {
  function stubRateLimited(retryAfter = "90") {
    return vi.fn(async (url: string) => {
      if (url === "/api/ai/chat") {
        return {
          ok: false,
          status: 429,
          headers: { get: (key: string) => (key.toLowerCase() === "retry-after" ? retryAfter : null) },
          json: async () => ({}),
        } as unknown as Response;
      }
      return { ok: true, status: 200, json: async () => ({ messages: [] }) } as unknown as Response;
    });
  }

  async function askOneQuestion(): Promise<void> {
    const target = [...document.querySelectorAll("button")].filter((button) =>
      SUGGESTED_QUESTIONS_ZH.includes(button.textContent ?? ""),
    )[0];
    fireEvent.click(target);
  }

  it("登录账号撞自己那份小时上限时，不许他去「登录」", async () => {
    vi.stubGlobal("fetch", stubRateLimited());
    render(<AiChatProbe />);
    await askOneQuestion();

    const line = await screen.findByText(`${dict.accountLimit} · 约 2 分钟后重试`);
    expect(line.textContent).not.toMatch(/游客|登录/);
  });

  it("正向对照：游客那一句仍然要点名「登录可获更多额度」", async () => {
    authValue = null;
    vi.stubGlobal("fetch", stubRateLimited());
    render(<AiChatProbe />);
    await askOneQuestion();

    expect(await screen.findByText(`${dict.guestLimit} · 约 2 分钟后重试`)).toBeDefined();
  });
});

/**
 * R16.169：云端没删掉时报「未能清空」，可那一栏唯一的按钮「重试」重跑的是**上一句提问**——
 * 而 `clear()` 早把 `messages` 清空了，于是 `send("")` 在 `ai-chat.tsx` 的开头判空直接返回，
 * 顺带 `setError(null)` 把这条警告藏起来：一次什么都没重试的重试，还把「云端还留着这段对话」
 * 这个唯一可见的证据抹掉了（下次进页 `/api/ai/conversations` 会把它整段送回来）。
 * 「重试」必须重跑那件失败的事。
 */
describe("AiChat 「清空失败」之后的重试真的再去删一次", () => {
  beforeEach(() => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("点重试再发一次 DELETE，警告不在没重试的情况下消失", async () => {
    const calls: FetchCall[] = [];
    vi.stubGlobal(
      "fetch",
      stubChatFetch(calls, gatedStreamBody("流式回答内容"), { deleteStatus: 500, history: false }),
    );
    render(<AiChatProbe />);
    await clickSuggestion();

    fireEvent.click(screen.getByRole("button", { name: "清空对话" }));
    await screen.findByText("云端对话未能清空，请稍后再试");
    const deletesBefore = calls.filter((c) => c.method === "DELETE").length;
    expect(deletesBefore, "第一次清空就该发过一次 DELETE").toBe(1);

    const chatCallsBefore = calls.filter((c) => c.url === "/api/ai/chat").length;
    fireEvent.click(screen.getByRole("button", { name: "重试" }));

    await waitFor(() =>
      expect(calls.filter((c) => c.method === "DELETE").length).toBe(deletesBefore + 1),
    );
    expect(await screen.findByText("云端对话未能清空，请稍后再试")).toBeDefined();
    // 正向对照：这条路径不是在「重发上一句提问」——消息早被清了，那样只会是空转。
    // （`/api/ai/chat` 上早有 clickSuggestion 留下的那一次，所以比的是点重试之后有没有新增。）
    expect(calls.filter((c) => c.url === "/api/ai/chat").length).toBe(chatCallsBefore);
  });
});
