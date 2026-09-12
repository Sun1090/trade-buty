import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { chat, streamChat, embed } from "./client";

type FetchFn = (url: string, init?: RequestInit) => Promise<unknown>;

/** 构造一个真正的 ReadableStream 响应体，按给定 chunk 顺序吐出 */
function streamBody(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let i = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(encoder.encode(chunks[i++]));
      } else {
        controller.close();
      }
    },
  });
}

function okStream(chunks: string[]) {
  return { ok: true, status: 200, body: streamBody(chunks) };
}

async function drain(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) out += decoder.decode(value);
  }
  return out;
}

/** 从 fetch 调用的 body 里取模型名 */
function modelOf(init?: RequestInit): string {
  return JSON.parse(String(init?.body)).model;
}

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const k of ["AI_MODEL", "AI_EMBEDDING_URL", "AI_EMBEDDING_MODEL", "AI_EMBEDDING_KEY"]) {
    if (ORIGINAL_ENV[k] === undefined) delete process.env[k];
    else process.env[k] = ORIGINAL_ENV[k];
  }
});

describe("streamChat（模型 fallback + SSE 解析）", () => {
  it("首个模型成功时直接返回文本流", async () => {
    const fetchMock = vi.fn<FetchFn>(async () =>
      okStream(['data: {"choices":[{"delta":{"content":"你好"}}]}\n\n', "data: [DONE]\n\n"]),
    );
    vi.stubGlobal("fetch", fetchMock);

    const stream = await streamChat({ messages: [{ role: "user", content: "hi" }] });
    expect(await drain(stream)).toBe("你好");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("首个模型失败（可重试状态）后降级到下一个模型", async () => {
    const fetchMock = vi.fn<FetchFn>()
      .mockResolvedValueOnce({ ok: false, status: 400, text: async () => "bad request" })
      .mockResolvedValueOnce(okStream(['data: {"choices":[{"delta":{"content":"ok"}}]}\n\n', "data: [DONE]\n\n"]));
    vi.stubGlobal("fetch", fetchMock);

    const stream = await streamChat({ messages: [{ role: "user", content: "hi" }] });
    expect(await drain(stream)).toBe("ok");
    expect(modelOf(fetchMock.mock.calls[0][1])).toBe("glm-5.2");
    expect(modelOf(fetchMock.mock.calls[1][1])).toBe("deepseek-v4-flash");
  });

  it("跳过 reasoning_content，只发送正式 content", async () => {
    const fetchMock = vi.fn<FetchFn>(async () =>
      okStream([
        'data: {"choices":[{"delta":{"reasoning_content":"内部思考"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"答案"}}]}\n\n',
        "data: [DONE]\n\n",
      ]),
    );
    vi.stubGlobal("fetch", fetchMock);

    const stream = await streamChat({ messages: [{ role: "user", content: "hi" }] });
    expect(await drain(stream)).toBe("答案");
  });

  it("跨 chunk 的 SSE 行能正确拼回并解析", async () => {
    const fetchMock = vi.fn<FetchFn>(async () =>
      okStream(['data: {"choices":[{"delta":{"con', 'tent":"拼回"}}]}\n\n', "data: [DONE]\n\n"]),
    );
    vi.stubGlobal("fetch", fetchMock);

    const stream = await streamChat({ messages: [{ role: "user", content: "hi" }] });
    expect(await drain(stream)).toBe("拼回");
  });

  it("结束时把 finish_reason 回调给 onFinish", async () => {
    const onFinish = vi.fn();
    const fetchMock = vi.fn<FetchFn>(async () =>
      okStream([
        'data: {"choices":[{"delta":{"content":"x"},"finish_reason":"length"}]}\n\n',
        "data: [DONE]\n\n",
      ]),
    );
    vi.stubGlobal("fetch", fetchMock);

    const stream = await streamChat({
      messages: [{ role: "user", content: "hi" }],
      onFinish,
    });
    await drain(stream);
    expect(onFinish).toHaveBeenCalledWith("length");
  });

  it("全部模型失败时抛出最后一个错误", async () => {
    const fetchMock = vi.fn<FetchFn>(async () => ({ ok: false, status: 400, text: async () => "nope" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      streamChat({ messages: [{ role: "user", content: "hi" }] }),
    ).rejects.toThrow(/glm-5.2|deepseek|sensenova|AI/);
    // 三个模型各尝试一次
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("AI_MODEL 已在默认链中时不产生重复尝试", async () => {
    process.env.AI_MODEL = "glm-5.2";
    const fetchMock = vi.fn<FetchFn>(async () => ({ ok: false, status: 400, text: async () => "nope" }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      streamChat({ messages: [{ role: "user", content: "hi" }] }),
    ).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("AI_MODEL 为自定义模型时排在链首", async () => {
    process.env.AI_MODEL = "my-custom-model";
    const fetchMock = vi.fn<FetchFn>(async () => ({ ok: false, status: 400, text: async () => "nope" }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      streamChat({ messages: [{ role: "user", content: "hi" }] }),
    ).rejects.toThrow();
    expect(modelOf(fetchMock.mock.calls[0][1])).toBe("my-custom-model");
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});

describe("chat（非流式 fallback）", () => {
  it("返回首个成功模型的内容", async () => {
    const fetchMock = vi.fn<FetchFn>(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: "完整回答" } }] }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const out = await chat({ messages: [{ role: "user", content: "hi" }] });
    expect(out).toBe("完整回答");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("首个模型 400 后降级到下一个模型", async () => {
    const fetchMock = vi.fn<FetchFn>()
      .mockResolvedValueOnce({ ok: false, status: 400, text: async () => "bad" })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: "fallback" } }] }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const out = await chat({ messages: [{ role: "user", content: "hi" }] });
    expect(out).toBe("fallback");
    expect(modelOf(fetchMock.mock.calls[1][1])).toBe("deepseek-v4-flash");
  });

  it("返回空内容时继续降级", async () => {
    const fetchMock = vi.fn<FetchFn>()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ choices: [] }) })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: "第二个" } }] }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const out = await chat({ messages: [{ role: "user", content: "hi" }] });
    expect(out).toBe("第二个");
  });

  it("全部模型无内容时抛错", async () => {
    const fetchMock = vi.fn<FetchFn>(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ choices: [] }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(chat({ messages: [{ role: "user", content: "hi" }] })).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe("embed（向量化）", () => {
  it("返回 embedding 数组", async () => {
    const fetchMock = vi.fn<FetchFn>(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ embedding: [0.1, 0.2, 0.3] }] }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(embed("文本")).resolves.toEqual([0.1, 0.2, 0.3]);
  });

  it("embedding 端点/模型/密钥可用独立 env 覆盖", async () => {
    process.env.AI_EMBEDDING_URL = "https://embed.example/v1";
    process.env.AI_EMBEDDING_MODEL = "bge-m3";
    process.env.AI_EMBEDDING_KEY = "secret-key";
    const fetchMock = vi.fn<FetchFn>(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ embedding: [1] }] }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    await embed("文本");
    const url = fetchMock.mock.calls[0][0];
    const init = fetchMock.mock.calls[0][1]!;
    expect(url).toBe("https://embed.example/v1/embeddings");
    expect(JSON.parse(String(init.body)).model).toBe("bge-m3");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer secret-key");
  });

  it("非 2xx 时抛错", async () => {
    vi.stubGlobal("fetch", vi.fn<FetchFn>(async () => ({ ok: false, status: 500, text: async () => "boom" })));
    await expect(embed("文本")).rejects.toThrow(/Embedding API 500/);
  });

  it("响应缺少 embedding 时返回空数组", async () => {
    vi.stubGlobal("fetch", vi.fn<FetchFn>(async () => ({ ok: true, status: 200, json: async () => ({}) })));
    await expect(embed("文本")).resolves.toEqual([]);
  });
});
