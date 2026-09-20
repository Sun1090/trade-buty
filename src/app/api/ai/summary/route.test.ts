import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { parseSummaryBody, POST } from "./route";

const getUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ auth: { getUser } })),
  getServerAuthUser: async () => {
    const { data: { user }, error } = await getUser();
    if (error) throw error;
    return user;
  },
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


describe("POST /api/ai/summary auth failure boundary", () => {
  it("getUser 返回 error 时返回通用 502，不调 RAG/模型且不透传内部错误", async () => {
    getUser.mockResolvedValueOnce({ data: { user: null }, error: new Error("secret: trace expired") });

    const res = await POST(request({ chapter: "spot" }, { "x-forwarded-for": "7.7.7.7" }));

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body).toEqual({ error: "AI 服务暂时不可用，请稍后再试。" });
    expect(JSON.stringify(body)).not.toContain("secret");
    expect(retrieve).not.toHaveBeenCalled();
    expect(chat).not.toHaveBeenCalled();
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
    expect(await res.json()).toEqual({ error: "AI 服务暂时不可用，请稍后再试。" });
    expect(errorSpy).toHaveBeenCalledWith(
      "[ai/summary] generation failed:",
      "model timeout",
    );
    errorSpy.mockRestore();
  });
});
