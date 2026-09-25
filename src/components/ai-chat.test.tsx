// @vitest-environment jsdom
import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterEach,
  beforeEach,
} from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
  act,
} from "@testing-library/react";
import { getDict } from "@/lib/i18n";
import { AiChat } from "./ai-chat";
import { renderToString } from "react-dom/server";
import {
  SUGGESTED_QUESTIONS_ZH,
  SUGGESTED_QUESTIONS_EN,
} from "@/lib/ai/prompt";
import { TRUNCATED_MARKER } from "@/lib/ai/streaming";
import { MAX_CHAT_CONTENT_CHARS, MAX_CHAT_TURNS } from "@/lib/ai/chat-input";

// Keep the streaming-state test deterministic: lazy chunk loading is covered in the
// production build and E2E, while this unit test should only observe AiChat state.
vi.mock("next/dynamic", () => ({
  default: () =>
    function MarkdownStub({ content }: { content?: string }) {
      return <>{content}</>;
    },
}));

// jsdom 没有 scrollTo，AiChat 挂载后会自动滚到底
beforeAll(() => {
  Element.prototype.scrollTo = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  // 这个 delete 挂在 `window.visualViewport` 上：这一套里是 `Object.defineProperty`
  // 定义在 window 自己那层，别绕到 `window.visualViewport.visualViewport` 去——
  // 那一层在 jsdom 里是 undefined，整个文件单独跑时 `delete undefined.x` 直接把
  // 这个钩子抛出来（测试全过了、套件照样红），只有在别的文件先跑过时才侥幸不响。
  delete (window as unknown as { visualViewport?: unknown }).visualViewport;
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
/**
 * `contextChapter` 是**服务端**认下并回带的篇章标题（`X-Context-Chapter`）：
 * 传 `undefined` 就是不回带，等于这次回答没带上下文，或那个 slug 认不出来。
 */
function mockFetch(chatText = "回答内容", contextChapter?: string) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    if (url === "/api/ai/conversations" && !init) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ messages: [] }),
      } as Response;
    }
    if (url === "/api/ai/chat") {
      return {
        ok: true,
        status: 200,
        headers: {
          get: (key: string) =>
            contextChapter !== undefined && key === "X-Context-Chapter"
              ? encodeURIComponent(contextChapter)
              : null,
        },
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
  // 横幅的句式子从字典取：这几条断言比的就是渲染出来的那句真话，手抄一份就会漂（R16.66 那一族）。
  contextBannerTpl: getDict("zh").ai.contextBannerTpl,
  threadTooLongTpl: getDict("zh").ai.threadTooLongTpl,
  answerTooLongTpl: getDict("zh").ai.answerTooLongTpl,
  followups: ["展开讲讲「{t}」", "「{t}」怎么用？", "「{t}」的误区？"],
  helpful: "有用",
  unhelpful: "无用",
  feedbackFailed: "这条反馈没送出去，请再点一次",
};

describe("AiChat 空状态与首屏示例问题", () => {
  it("中文空状态：标题/副标题/示例区标题 + 5 条来自中文池的可点击示例", () => {
    const { container } = render(<AiChat locale="zh" dict={dict} />);
    expect(screen.getByText("交易学习助手")).toBeInTheDocument();
    expect(screen.getByText("试试这样问")).toBeInTheDocument();
    const buttons = container.querySelectorAll("button");
    const examples = [...buttons].filter((b) =>
      SUGGESTED_QUESTIONS_ZH.includes(b.textContent ?? ""),
    );
    expect(examples).toHaveLength(5);
    for (const b of examples) {
      expect(SUGGESTED_QUESTIONS_ZH).toContain(b.textContent);
    }
  });

  it("英文 locale 使用英文问题池", () => {
    const { container } = render(
      <AiChat locale="en" dict={{ ...dict, examplesLabel: "Try asking" }} />,
    );
    expect(screen.getByText("Try asking")).toBeInTheDocument();
    const buttons = [...container.querySelectorAll("button")].filter((b) =>
      SUGGESTED_QUESTIONS_EN.includes(b.textContent ?? ""),
    );
    expect(buttons).toHaveLength(5);
  });

  it("服务端渲染是确定值：两次渲染的示例完全一致", () => {
    // /ai 是静态页，服务端 HTML 构建时固化；水合首帧与它不同会让 React 丢掉服务端树重渲染
    const html = renderToString(<AiChat locale="zh" dict={dict} />);
    expect(renderToString(<AiChat locale="zh" dict={dict} />)).toBe(html);
    for (const question of SUGGESTED_QUESTIONS_ZH.slice(0, 5)) {
      expect(html).toContain(question);
    }
  });

  it("随机只发生在挂载之后，且不在重渲染时洗牌", () => {
    const spy = vi.spyOn(Math, "random");
    try {
      const { rerender } = render(<AiChat locale="zh" dict={dict} />);
      const exampleButtons = screen
        .getAllByRole("button")
        .map((b) => b.textContent ?? "")
        .filter((text) => SUGGESTED_QUESTIONS_ZH.includes(text));
      expect(exampleButtons).toHaveLength(5);
      // 洗牌抽的是不重复的 5 条
      expect(new Set(exampleButtons).size).toBe(5);
      expect(spy).toHaveBeenCalled();

      spy.mockClear();
      rerender(<AiChat locale="zh" dict={dict} />);
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it("点击示例即发送：用户消息出现在对话区，空状态消失", async () => {
    const fetchMock = mockFetch();
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<AiChat locale="zh" dict={dict} />);
    // 示例是随机抽 5 条，从已渲染的按钮中取目标
    const rendered = [...container.querySelectorAll("button")].filter((b) =>
      SUGGESTED_QUESTIONS_ZH.includes(b.textContent ?? ""),
    );
    const target = rendered[0].textContent as string;
    fireEvent.click(rendered[0]);

    // 空状态消失，用户气泡出现
    await screen.findByText(target);
    expect(screen.queryByText("试试这样问")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/ai/chat",
      expect.objectContaining({ method: "POST" }),
    );
    const body = JSON.parse(
      (
        fetchMock.mock.calls.find(
          ([u]) => u === "/api/ai/chat",
        )?.[1] as RequestInit
      ).body as string,
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
      }),
    );
    render(<AiChat locale="zh" dict={dict} />);
    await screen.findByText("上次的问题");
    expect(screen.queryByText("试试这样问")).not.toBeInTheDocument();
  });

  it("恢复云端历史时兼容 JSON 字符串与对象 sources/suggested", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      void init;
      if (url === "/api/ai/conversations") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            messages: [
              { role: "user", content: "历史问题" },
              {
                role: "assistant",
                content: "历史回答",
                sources: JSON.stringify([
                  { chapter: "spot", doc: "order-types", title: "订单类型" },
                ]),
              },
              {
                role: "assistant",
                content: "推荐回答",
                suggested: [{ chapter: "spot", title: "现货基础" }],
              },
            ],
          }),
        } as Response;
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<AiChat locale="zh" dict={dict} />);

    const sourceLink = await waitFor(() => {
      const link = document.querySelector(
        'a[href="/zh/knowledge/spot/order-types"]',
      );
      expect(link?.textContent).toContain("订单类型");
      return link;
    });
    expect(sourceLink).toBeTruthy();
    expect(await screen.findByText("📚 现货基础")).toBeInTheDocument();
    expect(screen.queryByText("试试这样问")).not.toBeInTheDocument();
    expect(
      fetchMock.mock.calls.filter(([url]) => url === "/api/ai/chat"),
    ).toHaveLength(0);
  });

  it("历史拉取失败时仍可进入空状态，并用 URL q 自动提问", async () => {
    window.history.replaceState(
      {},
      "",
      "/zh/ai?q=自动问题&ctx=spot&ct=现货基础",
    );
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/ai/conversations" && !init) {
        return Promise.reject(new Error("offline"));
      }
      if (url === "/api/ai/chat") {
        return {
          ok: true,
          status: 200,
          headers: {
            get: (key: string) =>
              key === "X-Context-Chapter" ? encodeURIComponent("现货基础") : null,
          },
          body: makeStreamBody("自动回答"),
        } as unknown as Response;
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<AiChat locale="zh" dict={dict} />);
    await screen.findByText("自动回答");

    const chatCall = fetchMock.mock.calls.find(
      ([url]) => url === "/api/ai/chat",
    )?.[1] as RequestInit;
    expect(JSON.parse(chatCall.body as string)).toMatchObject({
      messages: [{ role: "user", content: "自动问题" }],
    });
    expect(
      screen.getByText("📖 《现货基础》篇章已作为参考上下文带上"),
    ).toBeInTheDocument();
    window.history.replaceState({}, "", "/zh/ai");
  });
});

describe("AiChat 加载态（R1.10）", () => {
  it("首个 token 未到时显示思考文案和骨架屏，流式到达后填充正文", async () => {
    let resolveChat!: (r: Response) => void;
    const chatPromise = new Promise<Response>((res) => {
      resolveChat = res;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "/api/ai/conversations" && !url.includes("POST")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ messages: [] }),
          } as Response;
        }
        if (url === "/api/ai/chat") return chatPromise;
        throw new Error(`unexpected fetch: ${url}`);
      }),
    );
    const { container } = render(<AiChat locale="zh" dict={dict} />);
    const rendered = [...container.querySelectorAll("button")].filter((b) =>
      SUGGESTED_QUESTIONS_ZH.includes(b.textContent ?? ""),
    );
    fireEvent.click(rendered[0]);

    // 思考中：骨架屏可见
    expect(await screen.findByText(dict.thinking)).toBeInTheDocument();
    expect(
      container.querySelector('[data-testid="chat-skeleton"]'),
    ).toBeTruthy();

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
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      void init; // preserve the real fetch signature for typed mock call assertions
      if (url === "/api/ai/conversations") {
        return {
          ok: true,
          status: 200,
          json: async () => ({ messages: [] }),
        } as Response;
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
      SUGGESTED_QUESTIONS_ZH.includes(b.textContent ?? ""),
    );
    fireEvent.click(rendered[0]);
    await screen.findByText("非流式全文");
    expect(container.querySelector('[data-testid="chat-skeleton"]')).toBeNull();
  });
});

describe("AiChat 错误态分级（R1.11）", () => {
  function setupAndAsk() {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "/api/ai/conversations") {
          return {
            ok: true,
            status: 200,
            json: async () => ({ messages: [] }),
          } as Response;
        }
        if (url === "/api/ai/chat") return chatResponsePromise;
        throw new Error(`unexpected fetch: ${url}`);
      }),
    );
    const { container } = render(<AiChat locale="zh" dict={dict} />);
    const rendered = [...container.querySelectorAll("button")].filter((b) =>
      SUGGESTED_QUESTIONS_ZH.includes(b.textContent ?? ""),
    );
    fireEvent.click(rendered[0]);
    return container;
  }

  let resolveChat!: (r: Response) => void;
  let chatResponsePromise!: Promise<Response>;

  beforeEach(() => {
    chatResponsePromise = new Promise<Response>((res) => {
      resolveChat = res;
    });
  });

  afterEach(() => {
    // 每个用例结束时释放挂起的请求，避免泄漏
    resolveChat({
      ok: false,
      status: 500,
      headers: { get: () => null },
      json: async () => ({}),
    } as unknown as Response);
  });

  it("429 限流展示配额文案", async () => {
    setupAndAsk();
    resolveChat({
      ok: false,
      status: 429,
      headers: { get: () => null },
      json: async () => ({}),
    } as unknown as Response);
    expect(await screen.findByText(dict.guestLimit)).toBeInTheDocument();
  });

  it("5xx 展示服务不可用文案（而非笼统错误）", async () => {
    setupAndAsk();
    resolveChat({
      ok: false,
      status: 503,
      headers: { get: () => null },
      json: async () => ({ error: "upstream" }),
    } as unknown as Response);
    expect(await screen.findByText(dict.errorServer)).toBeInTheDocument();
  });

  it("请求超时（AbortError）展示超时文案", async () => {
    setupAndAsk();
    resolveChat(
      Promise.reject(
        new DOMException("aborted", "AbortError"),
      ) as unknown as Response,
    );
    expect(await screen.findByText(dict.errorTimeout)).toBeInTheDocument();
  });

  it("网络错误用服务不可用文案，未知错误对象走兜底文案", async () => {
    const cases = [
      { error: new TypeError("failed fetch"), expected: dict.errorServer },
      { error: { unexpected: true }, expected: dict.error },
    ];

    for (const { error, expected } of cases) {
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string) => {
          if (url === "/api/ai/conversations") {
            return {
              ok: true,
              status: 200,
              json: async () => ({ messages: [] }),
            } as Response;
          }
          if (url === "/api/ai/chat") return Promise.reject(error);
          throw new Error(`unexpected fetch: ${url}`);
        }),
      );
      const { container } = render(<AiChat locale="zh" dict={dict} />);
      const rendered = [...container.querySelectorAll("button")].filter((b) =>
        SUGGESTED_QUESTIONS_ZH.includes(b.textContent ?? ""),
      );
      fireEvent.click(rendered[0]);
      expect(await screen.findByText(expected)).toBeInTheDocument();
      cleanup();
    }
  });

  it("失败后重试会复用最后一条用户问题，成功时清空错误态", async () => {
    let chatResponse: unknown = Promise.reject(
      new DOMException("aborted", "AbortError"),
    );
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/ai/conversations" && !init) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ messages: [] }),
        } as Response;
      }
      if (url === "/api/ai/chat") return chatResponse;
      if (url === "/api/ai/conversations" && init?.method === "POST") {
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true }),
        } as Response;
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<AiChat locale="zh" dict={dict} />);
    const rendered = [...container.querySelectorAll("button")].filter((b) =>
      SUGGESTED_QUESTIONS_ZH.includes(b.textContent ?? ""),
    );
    const question = rendered[0].textContent as string;
    fireEvent.click(rendered[0]);

    await screen.findByText(dict.errorTimeout);
    chatResponse = {
      ok: true,
      status: 200,
      headers: { get: () => null },
      body: makeStreamBody("重试成功"),
    } as unknown as Response;
    fireEvent.click(screen.getByRole("button", { name: dict.retry }));
    expect(await screen.findByText("重试成功")).toBeInTheDocument();
    expect(screen.queryByText(dict.errorTimeout)).not.toBeInTheDocument();
    expect(
      fetchMock.mock.calls.filter(([url]) => url === "/api/ai/chat").length,
    ).toBeGreaterThanOrEqual(2);
    const retryBody = JSON.parse(
      (
        fetchMock.mock.calls
          .filter(([url]) => url === "/api/ai/chat")
          .at(-1)?.[1] as RequestInit
      ).body as string,
    );
    expect(retryBody.messages.at(-1)).toEqual({
      role: "user",
      content: question,
    });
  });

  /**
   * R16.204：路由在 4xx 上回的是**开发者标识串**（`Invalid payload`、`Payload too large`，
   * 见 `src/lib/ai/chat-input.ts` 的 `BODY_ERRORS`），不是给人看的文案。以前这里是
   * `throw new Error(errBody.error || dict.error)`，于是中文界面上会原样印出
   * `Invalid payload` 这样一个英文词组。真能发生的两种成因（轮数超上限、单条回答超上限）
   * 在发送前就能算出来，已由本文件「带不动的长对话在发送前就说清楚」那一组各自说清
   * （上限本身的行为在 `src/lib/ai/chat-brick.test.ts`）；算不出来的这一条只说「出错了」，
   * 不再替开发者说话。
   */
  it("4xx 的 JSON error 不印到界面上，只说『出错了』", async () => {
    setupAndAsk();
    resolveChat({
      ok: false,
      status: 400,
      headers: { get: () => null },
      json: async () => ({ error: "Invalid payload" }),
    } as unknown as Response);
    expect(await screen.findByText(dict.error)).toBeInTheDocument();
    expect(screen.queryByText("Invalid payload")).not.toBeInTheDocument();
  });
});

describe("AiChat 配额提示（R1.12）", () => {
  function quotaHeaders(remaining: number, limit = 10) {
    return {
      get: (k: string) => {
        const key = k.toLowerCase();
        if (key === "x-quota-limit") return String(limit);
        if (key === "x-quota-remaining") return String(remaining);
        return null;
      },
    };
  }

  it("游客请求带配额头时展示剩余次数", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "/api/ai/conversations") {
          return {
            ok: true,
            status: 200,
            json: async () => ({ messages: [] }),
          } as Response;
        }
        if (url === "/api/ai/chat") {
          return {
            ok: true,
            status: 200,
            headers: quotaHeaders(7),
            body: makeStreamBody("回答"),
          } as unknown as Response;
        }
        throw new Error(`unexpected fetch: ${url}`);
      }),
    );
    const { container } = render(<AiChat locale="zh" dict={dict} />);
    const rendered = [...container.querySelectorAll("button")].filter((b) =>
      SUGGESTED_QUESTIONS_ZH.includes(b.textContent ?? ""),
    );
    fireEvent.click(rendered[0]);
    expect(
      await screen.findByText(
        dict.quotaRemaining.replace("{l}", "10").replace("{n}", "7"),
      ),
    ).toBeInTheDocument();
    expect(container).toBeDefined();
  });

  it("游客提示里的上限来自 X-Quota-Limit，不是文案里的常量", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "/api/ai/conversations") {
          return {
            ok: true,
            status: 200,
            json: async () => ({ messages: [] }),
          } as Response;
        }
        if (url === "/api/ai/chat") {
          return {
            ok: true,
            status: 200,
            headers: quotaHeaders(2, 3),
            body: makeStreamBody("回答"),
          } as unknown as Response;
        }
        throw new Error(`unexpected fetch: ${url}`);
      }),
    );
    const { container } = render(<AiChat locale="zh" dict={dict} />);
    const rendered = [...container.querySelectorAll("button")].filter((b) =>
      SUGGESTED_QUESTIONS_ZH.includes(b.textContent ?? ""),
    );
    fireEvent.click(rendered[0]);
    const strip = await screen.findByText(
      dict.quotaRemaining.replace("{l}", "3").replace("{n}", "2"),
    );
    expect(strip).toBeInTheDocument();
    expect(strip.textContent).not.toContain("10");
  });

  it("配额用尽时展示登录引导链接", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "/api/ai/conversations") {
          return {
            ok: true,
            status: 200,
            json: async () => ({ messages: [] }),
          } as Response;
        }
        if (url === "/api/ai/chat") {
          return {
            ok: true,
            status: 200,
            headers: quotaHeaders(0),
            body: makeStreamBody("回答"),
          } as unknown as Response;
        }
        throw new Error(`unexpected fetch: ${url}`);
      }),
    );
    const { container } = render(<AiChat locale="zh" dict={dict} />);
    const rendered = [...container.querySelectorAll("button")].filter((b) =>
      SUGGESTED_QUESTIONS_ZH.includes(b.textContent ?? ""),
    );
    fireEvent.click(rendered[0]);
    const loginLink = await screen
      .findByText(dict.quotaLoginHint)
      .then((el) => el.closest("a"));
    expect(loginLink?.getAttribute("href")).toBe("/zh/auth");
    expect(container).toBeDefined();
  });

  it("429 带 retry-after 时展示向上取整的分钟提示", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "/api/ai/conversations")
          return {
            ok: true,
            status: 200,
            json: async () => ({ messages: [] }),
          } as Response;
        if (url === "/api/ai/chat") {
          return {
            ok: false,
            status: 429,
            headers: {
              get: (k: string) =>
                k.toLowerCase() === "retry-after" ? "90" : null,
            },
            json: async () => ({}),
          } as unknown as Response;
        }
        throw new Error(`unexpected fetch: ${url}`);
      }),
    );
    const { container } = render(<AiChat locale="zh" dict={dict} />);
    const rendered = [...container.querySelectorAll("button")].filter((b) =>
      SUGGESTED_QUESTIONS_ZH.includes(b.textContent ?? ""),
    );
    fireEvent.click(rendered[0]);
    expect(
      await screen.findByText(`${dict.guestLimit} · 约 2 分钟后重试`)
    ).toBeInTheDocument();
    expect(container).toBeDefined();
  });

  it("空响应会展示通用错误，且后续手动提问仍可继续", async () => {
    let emptyResponse = true;
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/ai/conversations" && !init)
        return {
          ok: true,
          status: 200,
          json: async () => ({ messages: [] }),
        } as Response;
      if (url === "/api/ai/chat") {
        return {
          ok: true,
          status: 200,
          headers: { get: () => null },
          text: async () => (emptyResponse ? "" : "恢复后的回答"),
        } as unknown as Response;
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<AiChat locale="zh" dict={dict} />);
    const suggested = [...container.querySelectorAll("button")].filter((b) =>
      SUGGESTED_QUESTIONS_ZH.includes(b.textContent ?? ""),
    );
    fireEvent.click(suggested[0]);

    expect(await screen.findByText(dict.error)).toBeInTheDocument();
    emptyResponse = false;
    fireEvent.click(screen.getByRole("button", { name: dict.retry }));
    expect(await screen.findByText("恢复后的回答")).toBeInTheDocument();
  });
});

describe("AiChat 引用点击统计（R1.13）", () => {
  it("点击来源引用上报 citation-click，携带章节与问题", async () => {
    const sources = [
      { chapter: "spot", doc: "order-types", title: "订单类型" },
    ];
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      void init; // preserve the real fetch signature for typed mock call assertions
      if (url === "/api/ai/conversations") {
        return {
          ok: true,
          status: 200,
          json: async () => ({ messages: [] }),
        } as Response;
      }
      if (url === "/api/ai/citation-click") {
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true }),
        } as Response;
      }
      if (url === "/api/ai/chat") {
        return {
          ok: true,
          status: 200,
          headers: {
            get: (k: string) =>
              k === "X-Sources"
                ? encodeURIComponent(JSON.stringify(sources))
                : null,
          },
          body: makeStreamBody("回答正文"),
        } as unknown as Response;
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<AiChat locale="zh" dict={dict} />);
    const rendered = [...container.querySelectorAll("button")].filter((b) =>
      SUGGESTED_QUESTIONS_ZH.includes(b.textContent ?? ""),
    );
    const question = rendered[0].textContent as string;
    fireEvent.click(rendered[0]);

    // 等回答渲染出来源 pill
    const pill = await screen.findByText("📖 订单类型");
    fireEvent.click(pill);

    const call = fetchMock.mock.calls.find(
      ([u]) => u === "/api/ai/citation-click",
    );
    expect(call).toBeDefined();
    const body = JSON.parse((call?.[1] as RequestInit).body as string);
    expect(body).toEqual({
      kind: "source",
      chapter: "spot",
      doc: "order-types",
      question,
    });
    expect(container).toBeDefined();
  });

  it("点击相关章节上报 suggested，且不带 doc", async () => {
    const suggested = [{ chapter: "spot", title: "现货基础" }];
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      void init;
      if (url === "/api/ai/conversations")
        return {
          ok: true,
          status: 200,
          json: async () => ({ messages: [] }),
        } as Response;
      if (url === "/api/ai/citation-click")
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true }),
        } as Response;
      if (url === "/api/ai/chat") {
        return {
          ok: true,
          status: 200,
          headers: {
            get: (k: string) =>
              k === "X-Suggested"
                ? encodeURIComponent(JSON.stringify(suggested))
                : null,
          },
          body: makeStreamBody("只有推荐章节"),
        } as unknown as Response;
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<AiChat locale="zh" dict={dict} />);
    const rendered = [...container.querySelectorAll("button")].filter((b) =>
      SUGGESTED_QUESTIONS_ZH.includes(b.textContent ?? ""),
    );
    const question = rendered[0].textContent as string;
    fireEvent.click(rendered[0]);

    const link = await screen.findByText("📚 现货基础");
    fireEvent.click(link);
    const call = fetchMock.mock.calls.find(
      ([u]) => u === "/api/ai/citation-click",
    );
    expect(JSON.parse((call?.[1] as RequestInit).body as string)).toEqual({
      kind: "suggested",
      chapter: "spot",
      doc: undefined,
      question,
    });
    expect(link.getAttribute("href")).toBe("/zh/knowledge/spot");
  });
});

describe("AiChat 移动端键盘遮挡（R1.15）", () => {
  it("输入框聚焦后延迟滚动到可见", async () => {
    vi.useFakeTimers();
    render(<AiChat locale="zh" dict={dict} />);
    const input = screen.getByPlaceholderText(dict.placeholder);
    fireEvent.focus(input);
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
    vi.advanceTimersByTime(350);
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith(
      expect.objectContaining({ block: "end" }),
    );
    vi.useRealTimers();
  });
});

describe("AiChat visualViewport 键盘调整", () => {
  it("软键盘 resize 且输入框聚焦时再次滚动输入框", async () => {
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: { addEventListener, removeEventListener },
    });
    render(<AiChat locale="zh" dict={dict} />);
    const input = screen.getByPlaceholderText(
      dict.placeholder,
    ) as HTMLInputElement;
    fireEvent.focus(input);
    Object.defineProperty(document, "activeElement", {
      configurable: true,
      get: () => input,
    });

    expect(addEventListener).toHaveBeenCalledWith(
      "resize",
      expect.any(Function),
    );
    const listener = addEventListener.mock.calls[0][1] as () => void;
    listener();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith(
      expect.objectContaining({ block: "end" }),
    );

    cleanup();
    expect(removeEventListener).toHaveBeenCalledWith("resize", listener);
  });
});

describe("AiChat 追问链与课程上下文（R3.4/R3.7）", () => {
  it("回答完成后基于引用标题展示 3 个追问按钮，点击即发送", async () => {
    const sources = [
      { chapter: "spot", doc: "order-types", title: "订单类型" },
    ];
    let chatCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "/api/ai/conversations") {
          return {
            ok: true,
            status: 200,
            json: async () => ({ messages: [] }),
          } as Response;
        }
        if (url === "/api/ai/chat") {
          chatCount++;
          return {
            ok: true,
            status: 200,
            headers: {
              get: (k: string) =>
                k === "X-Sources"
                  ? encodeURIComponent(JSON.stringify(sources))
                  : null,
            },
            body: makeStreamBody(`回答${chatCount}`),
          } as unknown as Response;
        }
        throw new Error(`unexpected fetch: ${url}`);
      }),
    );
    const { container } = render(<AiChat locale="zh" dict={dict} />);
    const rendered = [...container.querySelectorAll("button")].filter((b) =>
      SUGGESTED_QUESTIONS_ZH.includes(b.textContent ?? ""),
    );
    fireEvent.click(rendered[0]);
    await screen.findByText("回答1");

    const chips = container.querySelectorAll("button");
    const followups = [...chips].filter((b) =>
      (b.textContent ?? "").startsWith("💬"),
    );
    expect(followups).toHaveLength(3);
    fireEvent.click(followups[0]);
    await screen.findByText("回答2");
    expect(chatCount).toBe(2);
  });

  /**
   * R16.178：这条横幅以前印的是地址栏里的 `ct`——访客可以自己写的一段文本，而且在任何
   * 请求发生**之前**就挂出来（同 R16.142「首帧替服务端抢答」那一族）。服务端那一头做的只是
   * 「认得这个 slug 就往 system prompt 追加一句请优先结合该篇章」，未知 slug 静默忽略。
   * 现在横幅只跟着服务端回带的 `X-Context-Chapter` 走，文案也只说代码真做的那件事。
   */
  it("横幅的标题来自服务端回带的那个，不是地址栏里可自定的 ct", async () => {
    window.history.replaceState({}, "", "/zh/ai?ctx=spot&ct=我编的篇章");
    vi.stubGlobal("fetch", mockFetch("章节回答", "现货基础"));
    const { container } = render(<AiChat locale="zh" dict={dict} />);
    // 还没有任何一次回答：这一屏不许替服务端断言「正在基于某篇章回答」
    expect(screen.queryByText(/篇章已作为参考上下文带上/)).not.toBeInTheDocument();

    const ask = [...container.querySelectorAll("button")].find((b) =>
      SUGGESTED_QUESTIONS_ZH.includes(b.textContent ?? ""),
    )!;
    fireEvent.click(ask);
    await screen.findByText("章节回答");
    expect(
      screen.getByText("📖 《现货基础》篇章已作为参考上下文带上"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/我编的篇章/)).not.toBeInTheDocument();
    window.history.replaceState({}, "", "/zh/ai");
  });

  it("服务端没回带篇章（slug 认不出来）时，这条横幅根本不出现", async () => {
    window.history.replaceState({}, "", "/zh/ai?ctx=not-a-chapter&ct=现货基础");
    vi.stubGlobal("fetch", mockFetch("无上下文回答"));
    const { container } = render(<AiChat locale="zh" dict={dict} />);
    const ask = [...container.querySelectorAll("button")].find((b) =>
      SUGGESTED_QUESTIONS_ZH.includes(b.textContent ?? ""),
    )!;
    fireEvent.click(ask);
    await screen.findByText("无上下文回答");
    expect(screen.queryByText(/篇章已作为参考上下文带上/)).not.toBeInTheDocument();
    window.history.replaceState({}, "", "/zh/ai");
  });

  it("自动提问携带 contextChapter，横幅等服务端确认后才出现", async () => {
    window.history.replaceState({}, "", "/zh/ai?ctx=spot&q=带章节问题");
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/ai/conversations")
        return {
          ok: true,
          status: 200,
          json: async () => ({ messages: [] }),
        } as Response;
      if (url === "/api/ai/chat") {
        expect(JSON.parse(String((init as RequestInit).body))).toMatchObject({
          contextChapter: "spot",
        });
        return {
          ok: true,
          status: 200,
          headers: {
            get: (key: string) =>
              key === "X-Context-Chapter"
                ? encodeURIComponent("现货基础")
                : null,
          },
          body: makeStreamBody("带章节回答"),
        } as unknown as Response;
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<AiChat locale="zh" dict={dict} />);

    await screen.findByText("📖 《现货基础》篇章已作为参考上下文带上");
    window.history.replaceState({}, "", "/zh/ai");
  });
});

describe("AiChat 回答操作与对话管理", () => {
  function suggestedButtons(container: HTMLElement) {
    return [...container.querySelectorAll("button")].filter((b) =>
      SUGGESTED_QUESTIONS_ZH.includes(b.textContent ?? ""),
    );
  }

  async function ask(answer: string) {
    vi.stubGlobal("fetch", mockFetch(answer));
    const { container } = render(<AiChat locale="zh" dict={dict} />);
    const button = suggestedButtons(container)[0];
    const question = button.textContent as string;
    fireEvent.click(button);
    await screen.findByText(answer);
    return { container, question };
  }

  it("反馈只提交一次，并携带配对的用户问题与回答", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/ai/conversations" && !init) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ messages: [] }),
        } as Response;
      }
      if (url === "/api/ai/chat") {
        return {
          ok: true,
          status: 200,
          headers: { get: () => null },
          body: makeStreamBody("可反馈的回答"),
        } as unknown as Response;
      }
      if (url === "/api/ai/feedback") {
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true }),
        } as Response;
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<AiChat locale="zh" dict={dict} />);
    const button = suggestedButtons(container)[0];
    const question = button.textContent as string;
    fireEvent.click(button);
    await screen.findByText("可反馈的回答");

    const helpful = screen.getByRole("button", { name: dict.helpful });
    fireEvent.click(helpful);
    await waitFor(() => expect(helpful).toHaveClass("font-medium"));

    const feedbackCalls = fetchMock.mock.calls.filter(
      ([url]) => url === "/api/ai/feedback",
    );
    expect(feedbackCalls).toHaveLength(1);
    expect(
      JSON.parse((feedbackCalls[0][1] as RequestInit).body as string),
    ).toEqual({
      rating: "helpful",
      question,
      answer: "可反馈的回答",
    });

    fireEvent.click(helpful);
    fireEvent.click(screen.getByRole("button", { name: dict.unhelpful }));
    expect(
      fetchMock.mock.calls.filter(([url]) => url === "/api/ai/feedback"),
    ).toHaveLength(1);
  });

  /**
   * R16.172：以前点一下就先把按钮标成「已反馈」，`void fetch(...).catch(() => {})` 把结果丢掉——
   * 服务端拒收（答案超长会被 `/api/ai/feedback` 判 4xx）、离线、500，界面都显示成记上了。
   * 与 `ai-quiz` 那条「已举报只有服务端收下才算」的既定规矩相反。
   */
  it("反馈没送出去时不留下「已反馈」的样子，按钮还能再点", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/ai/conversations" && !init) {
        return { ok: true, status: 200, json: async () => ({ messages: [] }) } as Response;
      }
      if (url === "/api/ai/chat") {
        return {
          ok: true,
          status: 200,
          headers: { get: () => null },
          body: makeStreamBody("答完的这一条"),
        } as unknown as Response;
      }
      if (url === "/api/ai/feedback") {
        return { ok: false, status: 500, json: async () => ({ error: "upstream" }) } as Response;
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<AiChat locale="zh" dict={dict} />);
    fireEvent.click(suggestedButtons(container)[0]);
    await screen.findByText("答完的这一条");

    const helpful = screen.getByRole("button", { name: dict.helpful });
    fireEvent.click(helpful);

    await screen.findByText(dict.feedbackFailed);
    expect(helpful).not.toHaveClass("font-medium");
    // 这一栏不摆「重试」：它重跑不了评分这件事，点了只会把上一句提问又发一遍
    expect(
      screen.queryByRole("button", { name: dict.retry }),
    ).not.toBeInTheDocument();
    // 退回去之后还能再点：乐观标记不撤的话，用户就再也没有重试的入口
    fireEvent.click(helpful);
    await waitFor(() =>
      expect(fetchMock.mock.calls.filter(([url]) => url === "/api/ai/feedback")).toHaveLength(2),
    );
  });

  it("清空对话先确认：取消时保留，确认后回到空状态", async () => {
    const { question } = await ask("待清空回答");
    const clearButton = screen.getByRole("button", { name: dict.clear });
    const confirm = vi.fn().mockReturnValue(false);
    vi.spyOn(window, "confirm").mockImplementation(confirm);

    fireEvent.click(clearButton);
    expect(confirm).toHaveBeenCalledWith("清空所有对话？");
    expect(screen.getByText(question)).toBeInTheDocument();

    confirm.mockReturnValue(true);
    fireEvent.click(clearButton);
    expect(
      screen.queryByRole("button", { name: dict.clear }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(dict.title)).toBeInTheDocument();
  });

  it("流式回答途中清空：掐掉在途请求，迟到的那一块也不许把回答写回空屏幕", async () => {
    const enc = new TextEncoder();
    let release: () => void = () => {};
    const stalled = new Promise<void>((resolve) => {
      release = resolve;
    });
    const chunks = ["正在生成的回答", "迟到的后半段"];
    let next = 0;
    const body = {
      getReader: () => ({
        read: async () => {
          if (next === 1) await stalled; // 第二块停在用户点清空的那一瞬间
          const text = chunks[next];
          if (text === undefined) return { done: true, value: undefined };
          next += 1;
          return { done: false, value: enc.encode(text) };
        },
      }),
    };
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      void init;
      if (url === "/api/ai/conversations") {
        return { ok: true, status: 200, json: async () => ({ messages: [] }) } as Response;
      }
      if (url === "/api/ai/chat") {
        return {
          ok: true,
          status: 200,
          headers: { get: () => null },
          body,
        } as unknown as Response;
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(window, "confirm").mockImplementation(() => true);
    const { container } = render(<AiChat locale="zh" dict={dict} />);
    fireEvent.click(suggestedButtons(container)[0]);
    await screen.findByText("正在生成的回答");

    fireEvent.click(screen.getByRole("button", { name: dict.clear }));
    const chatInit = fetchMock.mock.calls.find(([u]) => u === "/api/ai/chat")?.[1];
    expect(chatInit?.signal?.aborted, "清空没有掐掉在途请求").toBe(true);
    expect(screen.queryByText("正在生成的回答")).toBeNull();

    // 迟到的一块到达：既不能复活半截回答，也不该弹一个「用户自己掐掉」的错误
    await act(async () => {
      release();
      await Promise.resolve();
      await Promise.resolve();
    });
    await waitFor(() => expect(screen.queryByText(dict.thinking)).toBeNull());
    expect(screen.queryByText(/正在生成的回答/)).toBeNull();
    expect(screen.queryByText(/迟到的后半段/), "清空之后迟到的那一块把回答写回来了").toBeNull();
    expect(screen.queryByText(dict.errorTimeout)).toBeNull();
    expect(screen.queryByText(dict.error)).toBeNull();
  });

  it("abort 掉的那条 read() 以 AbortError 结束：不留回答，也不弹错误框", async () => {
    const enc = new TextEncoder();
    let signal: AbortSignal | null | undefined;
    let firstOut = false;
    const body = {
      getReader: () => ({
        read: async () => {
          if (!firstOut) {
            firstOut = true;
            return { done: false, value: enc.encode("正在生成的回答") };
          }
          // 真实 fetch 的口径：signal 一被 abort，在途的 read() 就以 AbortError 收场
          return new Promise((_resolve, reject) => {
            const fail = () =>
              reject(new DOMException("The user aborted a request.", "AbortError"));
            if (signal?.aborted) fail();
            else signal?.addEventListener("abort", fail, { once: true });
          });
        },
      }),
    };
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/ai/conversations") {
        return { ok: true, status: 200, json: async () => ({ messages: [] }) } as Response;
      }
      if (url === "/api/ai/chat") {
        signal = init?.signal;
        return {
          ok: true,
          status: 200,
          headers: { get: () => null },
          body,
        } as unknown as Response;
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(window, "confirm").mockImplementation(() => true);
    const { container } = render(<AiChat locale="zh" dict={dict} />);
    fireEvent.click(suggestedButtons(container)[0]);
    await screen.findByText("正在生成的回答");

    fireEvent.click(screen.getByRole("button", { name: dict.clear }));
    await waitFor(() => expect(screen.queryByText(/正在生成的回答/)).toBeNull());
    // 错误框是给真失败准备的：用户自己掐掉的这一轮不该被说成「请求超时」或「出错了」
    expect(screen.queryByText(dict.errorTimeout)).toBeNull();
    expect(screen.queryByText(dict.error)).toBeNull();
  });

  it("复制回答后短暂显示已复制，再恢复按钮文案", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    await ask("可复制的回答");

    fireEvent.click(screen.getByRole("button", { name: dict.copy }));
    expect(writeText).toHaveBeenCalledWith("可复制的回答");
    expect(await screen.findByText(dict.copied)).toBeInTheDocument();
    await waitFor(
      () =>
        expect(
          screen.getByRole("button", { name: dict.copy }),
        ).toHaveTextContent(dict.copy),
      { timeout: 2000 },
    );
  });

  it("复制失败时显示失败文案，不静默吞错", async () => {
    const origExec = document.execCommand;
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    document.execCommand = vi.fn(
      () => false,
    ) as unknown as typeof document.execCommand;
    try {
      await ask("复制会失败的答案");
      fireEvent.click(screen.getByRole("button", { name: dict.copy }));
      expect(await screen.findByText(dict.copyFailed)).toBeInTheDocument();
      // 1.5s 后恢复按钮原始文案
      await waitFor(
        () =>
          expect(
            screen.getByRole("button", { name: dict.copy }),
          ).toHaveTextContent(dict.copy),
        { timeout: 2000 },
      );
    } finally {
      document.execCommand = origExec;
    }
  });

  it("异步剪贴板缺失时用 execCommand 兜底，仍算复制成功", async () => {
    const origExec = document.execCommand;
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
    document.execCommand = vi.fn(
      () => true,
    ) as unknown as typeof document.execCommand;
    try {
      await ask("没有异步剪贴板的答案");
      fireEvent.click(screen.getByRole("button", { name: dict.copy }));
      expect(await screen.findByText(dict.copied)).toBeInTheDocument();
    } finally {
      document.execCommand = origExec;
    }
  });

  it("英文回答操作使用英文快捷标签，并发送英文请求", async () => {
    const enDict = {
      ...dict,
      placeholder: "Ask any trading question",
      copy: "Copy",
      copied: "Copied",
      examplesLabel: "Try asking",
      followups: ["{t} in detail", "Use {t}", "Misunderstandings of {t}"],
    };
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      void init;
      if (url === "/api/ai/conversations" && !init)
        return {
          ok: true,
          status: 200,
          json: async () => ({ messages: [] }),
        } as Response;
      if (url === "/api/ai/chat")
        return {
          ok: true,
          status: 200,
          headers: { get: () => null },
          body: makeStreamBody("English answer"),
        } as unknown as Response;
      if (url === "/api/ai/conversations" && init?.method === "POST")
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true }),
        } as Response;
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<AiChat locale="en" dict={enDict} />);
    const rendered = [...container.querySelectorAll("button")].filter((b) =>
      SUGGESTED_QUESTIONS_EN.includes(b.textContent ?? ""),
    );
    fireEvent.click(rendered[0]);
    await screen.findByText("English answer");

    fireEvent.click(screen.getByRole("button", { name: "Simplify" }));
    expect(await screen.findByText("Simplify this")).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.filter(([url]) => url === "/api/ai/chat").length,
    ).toBeGreaterThanOrEqual(2);
  });

  it("输入接近上限时计数器显示红色，空白输入不能提交", async () => {
    vi.stubGlobal("fetch", mockFetch());
    render(<AiChat locale="zh" dict={dict} />);
    const input = screen.getByPlaceholderText(dict.placeholder);
    const submit = screen.getByRole("button", { name: "→" });

    expect(submit).toBeDisabled();
    fireEvent.change(input, { target: { value: "   " } });
    expect(screen.getByText("3/500")).toHaveClass("text-faint");
    expect(submit).toBeDisabled();
    fireEvent.change(input, { target: { value: "x".repeat(451) } });
    expect(screen.getByText("451/500")).toHaveClass("text-down");
    expect(submit).toBeEnabled();
  });

  it("点击简化/例子快捷操作会发送对应追问", async () => {
    let chatCount = 0;
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      void init;
      if (url === "/api/ai/conversations" && !init)
        return {
          ok: true,
          status: 200,
          json: async () => ({ messages: [] }),
        } as Response;
      if (url === "/api/ai/chat") {
        chatCount++;
        return {
          ok: true,
          status: 200,
          headers: { get: () => null },
          body: makeStreamBody(`快捷回答${chatCount}`),
        } as unknown as Response;
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<AiChat locale="zh" dict={dict} />);
    const rendered = [...container.querySelectorAll("button")].filter((b) =>
      SUGGESTED_QUESTIONS_ZH.includes(b.textContent ?? ""),
    );
    fireEvent.click(rendered[0]);
    await screen.findByText("快捷回答1");

    const simplifyButtons = screen.getAllByText("简化") as HTMLButtonElement[];
    fireEvent.click(simplifyButtons.at(-1)!);
    expect(await screen.findByText("简化解释")).toBeInTheDocument();
    const exampleButtons = screen.getAllByText("例子") as HTMLButtonElement[];
    fireEvent.click(exampleButtons.at(-1)!);
    expect(await screen.findByText("举个例子")).toBeInTheDocument();
    expect(chatCount).toBe(3);
  });

  it("续写被截断的回答：原文追加内容，并提交 continueFrom 上下文", async () => {
    let chatCount = 0;
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/ai/conversations" && !init) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ messages: [] }),
        } as Response;
      }
      if (url === "/api/ai/chat") {
        chatCount += 1;
        return {
          ok: true,
          status: 200,
          headers: { get: () => null },
          body: makeStreamBody(
            chatCount === 1 ? "第一段<!--TRUNCATED-->" : "，第二段",
          ),
        } as unknown as Response;
      }
      if (url === "/api/ai/conversations" && init?.method === "POST") {
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true }),
        } as Response;
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<AiChat locale="zh" dict={dict} />);
    const button = suggestedButtons(container)[0];
    fireEvent.click(button);
    await screen.findByText("第一段");

    fireEvent.click(
      screen.getByRole("button", { name: `${dict.continueLabel} →` }),
    );
    expect(await screen.findByText("第一段，第二段")).toBeInTheDocument();

    const chatCalls = fetchMock.mock.calls.filter(
      ([url]) => url === "/api/ai/chat",
    );
    const body = JSON.parse((chatCalls[1][1] as RequestInit).body as string);
    expect(body.continueFrom).toBe("第一段");
    expect(body.messages.at(-1)).toEqual({
      role: "assistant",
      content: "第一段",
    });
    expect(
      screen.queryByRole("button", { name: `${dict.continueLabel} →` }),
    ).not.toBeInTheDocument();
  });
});

describe("AiChat 初始化历史、自动提问与边界响应", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/zh/ai");
    vi.clearAllTimers();
  });

  afterEach(() => {
    window.history.replaceState({}, "", "/zh/ai");
    vi.useRealTimers();
  });

  function clickSuggestion(container: HTMLElement): string {
    const target = [...container.querySelectorAll("button")]
      .filter((b) => SUGGESTED_QUESTIONS_ZH.includes(b.textContent ?? ""))[0];
    const question = target.textContent as string;
    fireEvent.click(target);
    return question;
  }

  it("恢复云端历史时解析字符串形式的 sources/suggested，并把 ?q= 追加到历史之后发出", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/ai/conversations" && !init) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            messages: [
              { role: "user", content: "历史问题" },
              {
                role: "assistant",
                content: "历史回答",
                suggested: JSON.stringify([{ chapter: "futures", title: "推荐章节" }]),
              },
            ],
          }),
        } as Response;
      }
      if (url === "/api/ai/chat") {
        return {
          ok: true,
          status: 200,
          headers: {
            get: (key: string) =>
              key === "X-Context-Chapter" ? encodeURIComponent("期货基础") : null,
          },
          body: makeStreamBody("自动回答"),
        } as unknown as Response;
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    window.history.replaceState({}, "", "/zh/ai?q=自动提问&ctx=futures");
    vi.stubGlobal("fetch", fetchMock);

    render(<AiChat locale="zh" dict={dict} />);
    await screen.findByText("自动回答");
    expect(screen.queryByRole("link", { name: "📖 来源标题" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "📚 推荐章节" })).toHaveAttribute("href", "/zh/knowledge/futures");

    const chatCalls = fetchMock.mock.calls.filter(([url]) => url === "/api/ai/chat");
    expect(chatCalls).toHaveLength(1);
    const body = JSON.parse((chatCalls[0][1] as RequestInit).body as string);
    expect(body.contextChapter).toBe("futures");
    // 关键：自动提问必须接在恢复出来的历史后面，而不是把历史丢掉重新开一轮
    expect(body.messages).toEqual([
      { role: "user", content: "历史问题" },
      { role: "assistant", content: "历史回答" },
      { role: "user", content: "自动提问" },
    ]);
    expect(
      screen.getByText("📖 《期货基础》篇章已作为参考上下文带上"),
    ).toBeInTheDocument();
  });

  it("无云端历史且 URL 有 q 时自动发送该问题并携带上下文", async () => {
    window.history.replaceState({}, "", "/zh/ai?q=什么是杠杆&ctx=futures");
    const fetchMock = mockFetch("上下文回答", "期货基础");
    vi.stubGlobal("fetch", fetchMock);

    render(<AiChat locale="zh" dict={dict} />);
    await screen.findByText("上下文回答");

    expect(screen.getByText("什么是杠杆")).toBeInTheDocument();
    expect(
      screen.getByText("📖 《期货基础》篇章已作为参考上下文带上"),
    ).toBeInTheDocument();
    const chatCalls = fetchMock.mock.calls.filter((args) => args[0] === "/api/ai/chat");
    expect(chatCalls).toHaveLength(1);
    const body = JSON.parse((chatCalls[0][1] as RequestInit).body as string);
    expect(body.contextChapter).toBe("futures");
    expect(body.messages.at(-1)).toEqual({ role: "user", content: "什么是杠杆" });
  });

  it("自动提问后抹掉地址栏里的一次性参数，重新挂载不再问第二遍", async () => {
    window.history.replaceState({}, "", "/zh/ai?q=只该问一次&ctx=spot");
    const fetchMock = mockFetch("一次回答");
    vi.stubGlobal("fetch", fetchMock);

    const { unmount } = render(<AiChat locale="zh" dict={dict} />);
    await screen.findByText("一次回答");
    expect(window.location.search).toBe("");
    expect(window.location.pathname).toBe("/zh/ai");
    unmount();

    // 等价于用户按刷新：挂载只等历史拉取完成，参数已不在地址栏，就不该再发一次
    render(<AiChat locale="zh" dict={dict} />);
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.filter(
          ([url, init]) => url === "/api/ai/conversations" && !init,
        ).length,
      ).toBe(2),
    );
    expect(
      fetchMock.mock.calls.filter(([url]) => url === "/api/ai/chat"),
    ).toHaveLength(1);
  });

  it("拉取历史失败后仍可继续提问", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/ai/conversations" && !init) throw new Error("offline");
      if (url === "/api/ai/chat") {
        return {
          ok: true,
          status: 200,
          headers: { get: () => null },
          body: makeStreamBody("继续回答"),
        } as unknown as Response;
      }
      if (url === "/api/ai/conversations") {
        return { ok: true, status: 200, json: async () => ({ ok: true }) } as Response;
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<AiChat locale="zh" dict={dict} />);
    clickSuggestion(container);
    expect(await screen.findByText("继续回答")).toBeInTheDocument();
    expect(fetchMock.mock.calls.filter((args) => args[0] === "/api/ai/conversations" && !args[1])).toHaveLength(1);
  });

  it("非法配额不覆盖正常回答", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/ai/conversations") {
        return { ok: true, status: 200, json: async () => ({ messages: [] }) } as Response;
      }
      if (url === "/api/ai/chat") {
        return {
          ok: true,
          status: 200,
          headers: { get: (k: string) => (k.toLowerCase() === "x-quota-limit" ? "bad" : null) },
          body: makeStreamBody("有效回答"),
        } as unknown as Response;
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<AiChat locale="zh" dict={dict} />);
    clickSuggestion(container);
    expect(await screen.findByText("有效回答")).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(String.raw`${dict.quotaRemaining.replace("{n}", "")}`))).not.toBeInTheDocument();
  });

  it("非法 X-Sources 响应头触发兜底错误", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "/api/ai/conversations") {
          return { ok: true, status: 200, json: async () => ({ messages: [] }) } as Response;
        }
        if (url === "/api/ai/chat") {
          return {
            ok: true,
            status: 200,
            headers: { get: (k: string) => (k === "X-Sources" ? encodeURIComponent("{bad json") : null) },
            body: makeStreamBody("不会使用"),
          } as unknown as Response;
        }
        throw new Error(`unexpected fetch: ${url}`);
      })
    );
    const { container } = render(<AiChat locale="zh" dict={dict} />);
    clickSuggestion(container);
    expect(await screen.findByText(dict.error)).toBeInTheDocument();
    expect(screen.queryByText("不会使用")).not.toBeInTheDocument();
  });

  it("429 带 retry-after 时把分钟数补进配额提示", async () => {
    let resolveChat!: (r: Response) => void;
    const chatPromise = new Promise<Response>((res) => { resolveChat = res; });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "/api/ai/conversations") {
          return { ok: true, status: 200, json: async () => ({ messages: [] }) } as Response;
        }
        if (url === "/api/ai/chat") return chatPromise;
        throw new Error(`unexpected fetch: ${url}`);
      })
    );
    const { container } = render(<AiChat locale="zh" dict={dict} />);
    clickSuggestion(container);

    resolveChat({
      ok: false,
      status: 429,
      headers: { get: (k: string) => (k.toLowerCase() === "retry-after" ? "90" : null) },
      json: async () => ({}),
    } as unknown as Response);
    expect(await screen.findByText(`${dict.guestLimit} · 约 2 分钟后重试`)).toBeInTheDocument();
  });

  it("流式响应为空时展示兜底错误，且不会提交 assistant 存档", async () => {
    let saveCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url === "/api/ai/conversations" && !init) {
          return { ok: true, status: 200, json: async () => ({ messages: [] }) } as Response;
        }
        if (url === "/api/ai/chat") {
          return {
            ok: true,
            status: 200,
            headers: { get: () => null },
            body: {
              getReader: () => ({
                read: async () => ({ done: true, value: undefined }),
              }),
            },
          } as unknown as Response;
        }
        if (url === "/api/ai/conversations" && init?.method === "POST") {
          saveCalls += 1;
          return { ok: true, status: 200, json: async () => ({ ok: true }) } as Response;
        }
        throw new Error(`unexpected fetch: ${url}`);
      })
    );
    const { container } = render(<AiChat locale="zh" dict={dict} />);
    clickSuggestion(container);
    expect(await screen.findByText(dict.error)).toBeInTheDocument();
    expect(saveCalls).toBe(0);
  });

  it("点击推荐章节也会上报 suggested citation-click", async () => {
    const suggested = [{ chapter: "futures", title: "推荐标题" }];
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/ai/conversations" && !init) {
        return { ok: true, status: 200, json: async () => ({ messages: [] }) } as Response;
      }
      if (url === "/api/ai/chat") {
        return {
          ok: true,
          status: 200,
          headers: {
            get: (k: string) => (k === "X-Suggested" ? encodeURIComponent(JSON.stringify(suggested)) : null),
          },
          body: makeStreamBody("推荐回答"),
        } as unknown as Response;
      }
      if (url === "/api/ai/citation-click") {
        return { ok: true, status: 200, json: async () => ({ ok: true }) } as Response;
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<AiChat locale="zh" dict={dict} />);
    const question = clickSuggestion(container);
    await waitFor(() => expect(screen.getByRole("link", { name: "📚 推荐标题" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("link", { name: "📚 推荐标题" }));

    const citationCall = fetchMock.mock.calls.find(([url]) => url === "/api/ai/citation-click")?.[1] as RequestInit;
    expect(JSON.parse(citationCall.body as string)).toEqual({
      kind: "suggested",
      chapter: "futures",
      doc: undefined,
      question,
    });
  });

  /**
   * R16.172 的第二条路：请求根本没发出去（离线、DNS 挂）走的是 `fetch` 抛异常，
   * 与上面那条「服务端收了但判失败」是两种返回值，`.catch(() => null)` 把它们并成同一个 `!res?.ok`。
   * 这里原标题写的是「失败时仍记录本地反馈，避免用户反复点击」——那正是这个改动要拆掉的谎：
   * 没落库的评分在界面上留着「已反馈」，用户就再也没有机会把它送出去。
   */
  it("反馈请求抛异常时也不留下「已反馈」的样子", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/ai/conversations" && !init) {
        return { ok: true, status: 200, json: async () => ({ messages: [] }) } as Response;
      }
      if (url === "/api/ai/chat") {
        return {
          ok: true,
          status: 200,
          headers: { get: () => null },
          body: makeStreamBody("反馈失败回答"),
        } as unknown as Response;
      }
      if (url === "/api/ai/feedback") throw new Error("no stats");
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<AiChat locale="zh" dict={dict} />);
    clickSuggestion(container);
    await screen.findByText("反馈失败回答");

    const unhelpful = screen.getByRole("button", { name: dict.unhelpful });
    fireEvent.click(unhelpful);
    await screen.findByText(dict.feedbackFailed);
    expect(unhelpful).not.toHaveClass("font-medium");
    // 请求真的又发了一次：不留「再点一次」的入口，这条评分就永远送不出去
    fireEvent.click(unhelpful);
    await waitFor(() =>
      expect(fetchMock.mock.calls.filter(([url]) => url === "/api/ai/feedback")).toHaveLength(2),
    );
  });
});

describe("AiChat 续写与云端归档", () => {
  type Archive = { userMessage: string; assistantMessage: string; sources?: unknown };

  function stubFetch(opts: { history?: unknown[]; sources?: boolean } = {}) {
    const archives: Archive[] = [];
    const getHeader = (key: string, continueCall: boolean) => {
      if (!opts.sources || key !== "X-Sources" || continueCall) return null;
      return encodeURIComponent(JSON.stringify([{ chapter: "spot", doc: "basics" }]));
    };
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/ai/conversations" && init?.method === "POST") {
        archives.push(JSON.parse(String(init.body)) as Archive);
        return { ok: true, status: 200, json: async () => ({ ok: true }) } as Response;
      }
      if (url === "/api/ai/conversations") {
        return {
          ok: true,
          status: 200,
          json: async () => ({ messages: opts.history ?? [] }),
        } as Response;
      }
      if (url === "/api/ai/chat") {
        const body = JSON.parse(String(init?.body)) as { continueFrom?: string };
        const isContinue = Boolean(body.continueFrom);
        return {
          ok: true,
          status: 200,
          headers: { get: (key: string) => getHeader(key, isContinue) },
          body: makeStreamBody(
            body.continueFrom ? "后半段" : `前半段${TRUNCATED_MARKER}`,
          ),
        } as unknown as Response;
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    return archives;
  }

  function continueButton(): HTMLButtonElement | undefined {
    return [...document.querySelectorAll("button")].find((b) =>
      (b.textContent ?? "").includes(dict.continueLabel),
    ) as HTMLButtonElement | undefined;
  }

  it("续写的那一轮带着原问题入库，不写空问题", async () => {
    const archives = stubFetch();
    const { container } = render(<AiChat locale="zh" dict={dict} />);
    const target = [...container.querySelectorAll("button")].filter(
      (b) => SUGGESTED_QUESTIONS_ZH.includes(b.textContent ?? ""),
    )[0];
    const question = target.textContent as string;
    fireEvent.click(target);
    await screen.findByText("前半段");

    fireEvent.click(continueButton()!);
    await screen.findByText("前半段后半段");

    expect(archives).toHaveLength(2);
    // 存档带截断标记，恢复端才知道「这一轮还没说完」；续写那一份补的是完整答案
    expect(archives[0].assistantMessage).toBe(`前半段${TRUNCATED_MARKER}`);
    expect(archives[1].assistantMessage).toBe("前半段后半段");
    expect(archives[1].userMessage).toBe(question);
  });

  it("续写存档带上这一轮的来源，恢复时不会丢掉引用", async () => {
    const archives = stubFetch({ sources: true });
    const { container } = render(<AiChat locale="zh" dict={dict} />);
    fireEvent.click(
      [...container.querySelectorAll("button")].filter(
        (b) => SUGGESTED_QUESTIONS_ZH.includes(b.textContent ?? ""),
      )[0],
    );
    await screen.findByText("前半段");
    fireEvent.click(continueButton()!);
    await screen.findByText("前半段后半段");

    expect(archives[1].sources).toEqual([{ chapter: "spot", doc: "basics" }]);
  });

  it("刷新后恢复的截断回答仍然给出「继续生成」，页面上看不到截断标记", async () => {
    stubFetch({
      history: [
        { role: "user", content: "历史问题" },
        { role: "assistant", content: `前半段${TRUNCATED_MARKER}`, sources: null },
      ],
    });
    render(<AiChat locale="zh" dict={dict} />);

    const answer = await screen.findByText("前半段");
    expect(continueButton()).toBeDefined();
    expect(answer.textContent ?? screen.getByRole("button", { name: new RegExp(dict.clear) })).toBeTruthy();
    expect(document.body.textContent).not.toContain("TRUNCATED");
  });

  it("同一轮续写后的两份存档，恢复出来只留最新的那一份", async () => {
    stubFetch({
      history: [
        { role: "user", content: "同一个问题" },
        { role: "assistant", content: `半截答案${TRUNCATED_MARKER}`, sources: null },
        { role: "user", content: "同一个问题" },
        { role: "assistant", content: "完整答案", sources: null },
      ],
    });
    render(<AiChat locale="zh" dict={dict} />);

    await screen.findByText("完整答案");
    expect(screen.queryByText("半截答案")).toBeNull();
    expect(screen.getAllByText("同一个问题")).toHaveLength(1);
  });

  it("用户真的把同一个问题问两遍时不折叠，只有上一轮被截断才折叠", async () => {
    stubFetch({
      history: [
        { role: "user", content: "同一个问题" },
        { role: "assistant", content: "第一次的回答", sources: null },
        { role: "user", content: "同一个问题" },
        { role: "assistant", content: "第二次的回答", sources: null },
      ],
    });
    render(<AiChat locale="zh" dict={dict} />);

    await screen.findByText("第二次的回答");
    expect(screen.getByText("第一次的回答")).toBeDefined();
    expect(screen.getAllByText("同一个问题")).toHaveLength(2);
  });
});

/**
 * R16.203：`继续生成` 是往同一条 assistant 消息上追加的，一条被续写几轮的回答
 * 迟早会超过 `MAX_CHAT_CONTENT_CHARS`；而 `send` 把整个 `messages` 原文带上，
 * `parseChatBody` 对**每一条**都套这个上限，所以从那条回答之后，这个人的每一问
 * 都会被判成畸形载荷（400）。以前屏幕上留下的是路由那句英文 `Invalid payload`。
 *
 * 现在改成发送前就拦住，并且说清是哪一头超限、以及能点的那颗按钮叫什么。
 */
describe("AiChat 带不动的长对话在发送前就说清楚（R16.203）", () => {
  const real = getDict("zh").ai;

  /** 恢复一段「一问一答」的云端历史；返回节点供「有没有发出去」的断言用 */
  function restoreLongAnswerHistory(answerChars: number) {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/ai/conversations" && !init) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            messages: [
              { role: "user", content: "讲讲盈亏比" },
              { role: "assistant", content: "盈".repeat(answerChars), sources: null },
            ],
          }),
        } as Response;
      }
      if (url === "/api/ai/conversations") {
        return { ok: true, status: 200, json: async () => ({ ok: true }) } as Response;
      }
      if (url === "/api/ai/chat") {
        return {
          ok: true,
          status: 200,
          headers: { get: () => null },
          body: makeStreamBody("新的回答"),
        } as unknown as Response;
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    return { fetchMock, view: render(<AiChat locale="zh" dict={dict} />) };
  }

  async function askAfterRestoring(answerChars: number) {
    const { fetchMock, view } = restoreLongAnswerHistory(answerChars);
    // 恢复云端历史是异步的：等那条回答真的挂上屏幕
    await waitFor(() =>
      expect(view.container.textContent).toContain("盈亏比"),
    );
    const input = screen.getByPlaceholderText(dict.placeholder);
    fireEvent.change(input, { target: { value: "那移动止损呢" } });
    fireEvent.submit(view.container.querySelector("form") as HTMLFormElement);
    return fetchMock;
  }

  /**
   * 上面那两条把「屏幕上出现的那句」与「字典里的那句」对齐了，可是两边都来自同一个
   * `answerTooLongTpl`：把字典里的 `{n}` 换成手抄的 9000，期望值跟着变成 9000，两条照样绿
   * （变异探针实测）。这一条管住来源——数字与按钮名只能以占位符的形式住在字典里，
   * 值由 `chat-input.ts` 的常量和 `dict.clear` 代入。
   */
  it("两句里的数字与按钮名都只有一个出处：字典里留占位符，值由代码代入", () => {
    for (const locale of ["zh", "en"] as const) {
      const ai = getDict(locale).ai;
      for (const [key, tpl] of [
        ["threadTooLongTpl", ai.threadTooLongTpl],
        ["answerTooLongTpl", ai.answerTooLongTpl],
      ] as const) {
        expect(tpl, `${key}(${locale}) 里的数字要由 {n} 代入`).toContain("{n}");
        expect(tpl, `${key}(${locale}) 点名的按钮要由 {clear} 代入`).toContain("{clear}");
        expect(
          tpl.replace(/\{n\}|\{clear\}/g, ""),
          `${key}(${locale}) 自己写死了数字，常量改了文案不会跟着改`,
        ).not.toMatch(/\d/);
      }
    }
  });

  it("回答超过单条上限：这一问发不出去，屏幕上说的是这条回答太长", async () => {
    const fetchMock = await askAfterRestoring(MAX_CHAT_CONTENT_CHARS + 1);

    const expected = real.answerTooLongTpl
      .replace("{n}", String(MAX_CHAT_CONTENT_CHARS))
      .replace("{clear}", dict.clear);
    const shown = await screen.findByText(expected);
    // 屏幕上那个数字必须是常量本身，不是字典里抄来的第二个数
    expect(shown.textContent ?? "").toContain(String(MAX_CHAT_CONTENT_CHARS));
    // 句子点名的那颗按钮此刻真的在
    expect(screen.getByRole("button", { name: dict.clear })).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.filter(([url]) => url === "/api/ai/chat"),
      "明知服务端必拒，就不该再打这一趟",
    ).toHaveLength(0);
  });

  it("没超过上限时不拦：同样的一段历史照样问得出去", async () => {
    await askAfterRestoring(MAX_CHAT_CONTENT_CHARS - 200);

    expect(await screen.findByText("新的回答")).toBeInTheDocument();
    expect(
      screen.queryByText(
        real.answerTooLongTpl
          .replace("{n}", String(MAX_CHAT_CONTENT_CHARS))
          .replace("{clear}", dict.clear),
      ),
    ).toBeNull();
  });

  /**
   * 另一条上限是轮数：`MAX_CHAT_TURNS` 由 `collapseToTurns` 之前套在整包上，
   * 41 条消息（未超单条字数）也一定被服务端判死。这里造 41 条正常的问答，
   * 看屏幕上出现的是「轮数太多」那句，而不是又打一趟拿回 400。
   */
  it("轮数超过上限：说的是这段对话太长，这一问同样发不出去", async () => {
    const turns = Array.from({ length: MAX_CHAT_TURNS + 1 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `第 ${i} 条`,
      sources: null,
    }));
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/ai/conversations" && !init) {
        return { ok: true, status: 200, json: async () => ({ messages: turns }) } as Response;
      }
      if (url === "/api/ai/conversations") {
        return { ok: true, status: 200, json: async () => ({ ok: true }) } as Response;
      }
      if (url === "/api/ai/chat") {
        return {
          ok: true,
          status: 200,
          headers: { get: () => null },
          body: makeStreamBody("新的回答"),
        } as unknown as Response;
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<AiChat locale="zh" dict={dict} />);
    await waitFor(() => expect(container.textContent).toContain("第 0 条"));
    fireEvent.change(screen.getByPlaceholderText(dict.placeholder), {
      target: { value: "再问一句" },
    });
    fireEvent.submit(container.querySelector("form") as HTMLFormElement);

    const expected = real.threadTooLongTpl
      .replace("{n}", String(MAX_CHAT_TURNS))
      .replace("{clear}", dict.clear);
    const shown = await screen.findByText(expected);
    expect(shown.textContent ?? "").toContain(String(MAX_CHAT_TURNS));
    expect(screen.getByRole("button", { name: dict.clear })).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.filter(([url]) => url === "/api/ai/chat"),
      "轮数已经超限，这一趟服务端必拒",
    ).toHaveLength(0);
  });
});
