// @vitest-environment jsdom
/**
 * 账号身份变化时，AI 对话面板必须放下上一个账号的云端历史。
 * `/api/ai/conversations` 按会话 cookie 返回内容，而组件过去只在挂载时拉一次、
 * 从不感知身份变化：登出或换号后，A 的问答会一直留在屏幕上给下一个人看。
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
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
  copy: "复制",
  copied: "已复制",
  copyFailed: "复制失败",
  continueLabel: "继续生成",
  sourcesLabel: "来源",
  suggestedLabel: "相关章节",
  examplesLabel: "试试这样问",
  disclaimer: "⚠️ 仅用于学习",
  guestLimit: "游客每小时限 10 次",
  quotaRemaining: "游客每小时限 10 次，本小时剩余 {n} 次",
  quotaLoginHint: "本小时次数已用完，登录可获更多额度",
  contextBannerTpl: "正在基于《{title}》篇章回答",
  followups: ["展开讲讲「{t}」", "「{t}」怎么用？", "「{t}」的误区？"],
  helpful: "有用",
  unhelpful: "无用",
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
