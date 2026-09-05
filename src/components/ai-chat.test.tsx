// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { AiChat } from "./ai-chat";
import { SUGGESTED_QUESTIONS_ZH, SUGGESTED_QUESTIONS_EN } from "@/lib/ai/prompt";

// jsdom 没有 scrollTo，AiChat 挂载后会自动滚到底
beforeAll(() => {
  Element.prototype.scrollTo = vi.fn();
});

afterEach(cleanup);

function makeStreamBody(text: string) {
  const enc = new TextEncoder();
  let sent = false;
  return {
    getReader: () => ({
      read: async () =>
        sent
          ? { done: true, value: undefined }
          : ((sent = true), { done: false, value: enc.encode(text) }),
    }),
  };
}

/** 区分挂载时的历史拉取（GET）与提问请求（POST chat） */
function mockFetch(chatText = "回答内容") {
  return vi.fn(async (url: string, init?: RequestInit) => {
    if (url === "/api/ai/conversations" && !init) {
      return { ok: true, status: 200, json: async () => ({ messages: [] }) } as Response;
    }
    if (url === "/api/ai/chat") {
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        body: makeStreamBody(chatText),
      } as unknown as Response;
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
}

const dict = {
  placeholder: "问任何交易问题",
  title: "交易学习助手",
  subtitle: "基于 27 篇章知识库回答你的交易问题。",
  thinking: "思考中…",
  error: "出错了",
  retry: "重试",
  clear: "清空对话",
  copy: "复制",
  copied: "已复制",
  continueLabel: "继续生成",
  sourcesLabel: "来源",
  suggestedLabel: "相关章节",
  examplesLabel: "试试这样问",
  disclaimer: "⚠️ 仅用于学习",
  guestLimit: "游客每小时限 10 次",
  helpful: "有用",
  unhelpful: "无用",
};

describe("AiChat 空状态与首屏示例问题", () => {
  it("中文空状态：标题/副标题/示例区标题 + 5 条来自中文池的可点击示例", () => {
    const { container } = render(<AiChat locale="zh" dict={dict} />);
    expect(screen.getByText("交易学习助手")).toBeInTheDocument();
    expect(screen.getByText("试试这样问")).toBeInTheDocument();
    const buttons = container.querySelectorAll("button");
    const examples = [...buttons].filter((b) =>
      SUGGESTED_QUESTIONS_ZH.includes(b.textContent ?? "")
    );
    expect(examples).toHaveLength(5);
    for (const b of examples) {
      expect(SUGGESTED_QUESTIONS_ZH).toContain(b.textContent);
    }
  });

  it("英文 locale 使用英文问题池", () => {
    const { container } = render(<AiChat locale="en" dict={{ ...dict, examplesLabel: "Try asking" }} />);
    expect(screen.getByText("Try asking")).toBeInTheDocument();
    const buttons = [...container.querySelectorAll("button")].filter((b) =>
      SUGGESTED_QUESTIONS_EN.includes(b.textContent ?? "")
    );
    expect(buttons).toHaveLength(5);
  });

  it("点击示例即发送：用户消息出现在对话区，空状态消失", async () => {
    const fetchMock = mockFetch();
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<AiChat locale="zh" dict={dict} />);
    // 示例是随机抽 5 条，从已渲染的按钮中取目标
    const rendered = [...container.querySelectorAll("button")].filter((b) =>
      SUGGESTED_QUESTIONS_ZH.includes(b.textContent ?? "")
    );
    const target = rendered[0].textContent as string;
    fireEvent.click(rendered[0]);

    // 空状态消失，用户气泡出现
    await screen.findByText(target);
    expect(screen.queryByText("试试这样问")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/ai/chat",
      expect.objectContaining({ method: "POST" })
    );
    const body = JSON.parse(
      (fetchMock.mock.calls.find(([u]) => u === "/api/ai/chat")?.[1] as RequestInit).body as string
    );
    expect(body.messages.at(-1)).toEqual({ role: "user", content: target });
    expect(container).toBeDefined();
  });

  it("有云端历史时不展示空状态示例", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "/api/ai/conversations") {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              messages: [{ role: "user", content: "上次的问题" }],
            }),
          } as Response;
        }
        throw new Error(`unexpected fetch: ${url}`);
      })
    );
    render(<AiChat locale="zh" dict={dict} />);
    await screen.findByText("上次的问题");
    expect(screen.queryByText("试试这样问")).not.toBeInTheDocument();
  });
});

describe("AiChat 加载态（R1.10）", () => {
  it("首个 token 未到时显示思考文案和骨架屏，流式到达后填充正文", async () => {
    let resolveChat!: (r: Response) => void;
    const chatPromise = new Promise<Response>((res) => { resolveChat = res; });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "/api/ai/conversations" && !url.includes("POST")) {
          return { ok: true, status: 200, json: async () => ({ messages: [] }) } as Response;
        }
        if (url === "/api/ai/chat") return chatPromise;
        throw new Error(`unexpected fetch: ${url}`);
      })
    );
    const { container } = render(<AiChat locale="zh" dict={dict} />);
    const rendered = [...container.querySelectorAll("button")].filter((b) =>
      SUGGESTED_QUESTIONS_ZH.includes(b.textContent ?? "")
    );
    fireEvent.click(rendered[0]);

    // 思考中：骨架屏可见
    expect(await screen.findByText(dict.thinking)).toBeInTheDocument();
    expect(container.querySelector('[data-testid="chat-skeleton"]')).toBeTruthy();

    // 首个 token 到达后正文填充、骨架消失
    resolveChat({
      ok: true,
      status: 200,
      headers: { get: () => null },
      body: makeStreamBody("流式回答"),
    } as unknown as Response);
    await screen.findByText("流式回答");
    expect(container.querySelector('[data-testid="chat-skeleton"]')).toBeNull();
  });

  it("非流式响应（无 body reader）回退为一次性读取全文", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/ai/conversations") {
        return { ok: true, status: 200, json: async () => ({ messages: [] }) } as Response;
      }
      if (url === "/api/ai/chat") {
        return {
          ok: true,
          status: 200,
          headers: { get: () => null },
          text: async () => "非流式全文",
        } as unknown as Response;
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<AiChat locale="zh" dict={dict} />);
    const rendered = [...container.querySelectorAll("button")].filter((b) =>
      SUGGESTED_QUESTIONS_ZH.includes(b.textContent ?? "")
    );
    fireEvent.click(rendered[0]);
    await screen.findByText("非流式全文");
    expect(container.querySelector('[data-testid="chat-skeleton"]')).toBeNull();
  });
});
