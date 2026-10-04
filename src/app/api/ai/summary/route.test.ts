import { SERVER_ERRORS } from "@/lib/ai/server-errors";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { MAX_SUMMARY_BODY_BYTES, parseSummaryBody, POST } from "./route";
import { resolveAuthUser } from "@/lib/supabase/auth-result";

const getUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ auth: { getUser } })),
  getServerAuthUser: async () => resolveAuthUser(await getUser()),
}));
const { chat } = vi.hoisted(() => ({ chat: vi.fn() }));
vi.mock("@/lib/ai/client", () => ({ chat }));
const { retrieve } = vi.hoisted(() => ({ retrieve: vi.fn() }));
vi.mock("@/lib/ai/rag", () => ({ retrieve }));

function request(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost/api/ai/summary", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: null }, error: null });
  chat.mockResolvedValue('{"summary":"本章导读"}');
  retrieve.mockResolvedValue([]);
});

describe("parseSummaryBody (R7.12)", () => {
  it("接受合法请求，标题缺省时回落为章节 slug", () => {
    expect(parseSummaryBody({ chapter: "spot" })).toEqual({
      chapter: "spot",
      title: "spot",
      locale: "zh",
    });
    expect(parseSummaryBody({ chapter: "spot", title: " 现货 ", locale: "en" })).toEqual({
      chapter: "spot",
      title: "现货",
      locale: "en",
    });
  });

  it("拒绝缺失/空白 chapter 与超长字段", () => {
    expect(parseSummaryBody({})).toBeNull();
    expect(parseSummaryBody({ chapter: "   " })).toBeNull();
    expect(parseSummaryBody({ chapter: "x".repeat(65) })).toBeNull();
    expect(parseSummaryBody({ chapter: "spot", title: "x".repeat(201) })).toBeNull();
    expect(parseSummaryBody(null)).toBeNull();
  });

  it("非白名单 locale 一律回落 zh", () => {
    expect(parseSummaryBody({ chapter: "spot", locale: "fr" })?.locale).toBe("zh");
  });
});


/**
 * R16.291：与 `chat` 同形——鉴权只用来挑限流桶，游客本来就能生成章节摘要，
 * 所以身份不可信时降级为按 IP 分桶的游客身份，而不是回 502。
 * 这一族此前只钉「有 502」，把「查不到身份」与「上游抽风」记成同一件事。
 */
describe("POST /api/ai/summary auth failure boundary（R16.291）", () => {
  const untrusted = () =>
    getUser.mockResolvedValueOnce({ data: { user: null }, error: new Error("secret: trace expired") });

  it("身份不可信时仍能出摘要——游客路径不受影响", async () => {
    untrusted();

    const res = await POST(request({ chapter: "spot" }, { "x-forwarded-for": "7.7.7.7" }));

    expect(res.status, "鉴权不可用不该掐断游客本来用得了的功能线").toBe(200);
    expect(chat, "降级之后模型仍然要被调到").toHaveBeenCalled();
  });

  it("降级不是放行：限流照常生效", async () => {
    untrusted();

    const res = await POST(request({ chapter: "spot" }, { "x-forwarded-for": "7.7.7.7" }));

    expect(res.status).toBe(200);
    expect(chat).toHaveBeenCalled();
  });

  it("服务端日志记下这次降级，且不回显内部错误细节", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    untrusted();

    await POST(request({ chapter: "spot" }, { "x-forwarded-for": "7.7.7.7" })).then((r) => r.text());

    const logged = errorSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(logged, "降级没有留下可观测的记录").toContain("[ai/summary] auth unavailable");
    expect(logged, "日志里不该回显上游错误细节").not.toContain("secret");
    errorSpy.mockRestore();
  });

  it("反向对照：身份可信时走原来的路，降级没被写成常态", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await POST(request({ chapter: "spot" }, { "x-forwarded-for": "7.7.7.7" }));

    expect(res.status).toBe(200);
    expect(errorSpy.mock.calls.map((c) => c.join(" ")).join("\n"), "没出错也打了降级日志").not.toContain(
      "auth unavailable",
    );
    errorSpy.mockRestore();
  });
});

describe("POST /api/ai/summary 限流（R7.12）", () => {
  it("游客合法请求返回 summary", async () => {
    const res = await POST(request({ chapter: "spot" }, { "x-forwarded-for": "9.9.9.9" }));
    expect(res.status).toBe(200);
    expect((await res.json()).summary).toBe("本章导读");
  });

  it("游客超过配额返回 429", async () => {
    let last;
    for (let i = 0; i < 21; i++) {
      last = await POST(request({ chapter: "spot" }, { "x-forwarded-for": "8.8.8.8" }));
      if (last.status === 429) break;
    }
    expect(last!.status).toBe(429);
    expect(Number(last!.headers.get("Retry-After"))).toBeGreaterThan(0);
  });
});

describe("POST /api/ai/summary request and AI failure boundaries", () => {
  it("invalid JSON returns 400 before parsing the payload or calling retrieval/model", async () => {
    const raw = new NextRequest("http://localhost/api/ai/summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not-json",
    });

    const res = await POST(raw);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid JSON" });
    expect(retrieve).not.toHaveBeenCalled();
    expect(chat).not.toHaveBeenCalled();
  });

  it("invalid payload returns 400 and does not call retrieval or model", async () => {
    const res = await POST(request({ chapter: "   " }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid payload" });
    expect(retrieve).not.toHaveBeenCalled();
    expect(chat).not.toHaveBeenCalled();
  });

  // 字段上限要解析完才生效，读流阶段的字节闸才挡得住匿名超大 body
  it("超过请求体字节上限返回 413，不调检索与模型", async () => {
    const raw = new NextRequest("http://localhost/api/ai/summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chapter: "spot", title: "物".repeat(MAX_SUMMARY_BODY_BYTES) }),
    });

    const res = await POST(raw);

    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: "Payload too large" });
    expect(retrieve).not.toHaveBeenCalled();
    expect(chat).not.toHaveBeenCalled();
  });

  it("keeps generating a clean local summary when retrieval fails", async () => {
    retrieve.mockRejectedValueOnce(new Error("pgvector unavailable"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await POST(request({ chapter: "spot", title: "Spot market" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ summary: "本章导读" });
    expect(retrieve).toHaveBeenCalledWith("Spot market", "zh", 6, 0.3, "spot");
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("falls back to raw model text when the model returns non-JSON/plain prose", async () => {
    chat.mockResolvedValueOnce("  现货市场先讲合约工具，再讲风险。 ");

    const res = await POST(request({ chapter: "spot", locale: "zh" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ summary: "现货市场先讲合约工具，再讲风险。" });
  });

  it("caps raw model fallback summaries to the configured character limit", async () => {
    const raw = `原文摘要 ${"x".repeat(1000)}`;
    chat.mockResolvedValueOnce(raw);

    const res = await POST(request({ chapter: "spot" }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.summary).toBe(raw.trim().slice(0, 800));
  });

  it("returns a stable 502 when model generation fails", async () => {
    chat.mockRejectedValueOnce(new Error("model timeout"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await POST(request({ chapter: "spot" }));

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: SERVER_ERRORS.upstreamUnavailable });
    expect(errorSpy).toHaveBeenCalledWith(
      "[ai/summary] generation failed:",
      "model timeout",
    );
    errorSpy.mockRestore();
  });
});
