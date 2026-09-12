import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { parseSummaryBody, POST } from "./route";

const getUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ auth: { getUser } })),
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
