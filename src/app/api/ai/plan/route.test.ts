import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { parsePlanBody, POST } from "./route";
import { resolveAuthUser } from "@/lib/supabase/auth-result";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  getUser: vi.fn(),
  chat: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
  getServerAuthUser: async () => resolveAuthUser(await mocks.getUser()),
}));
vi.mock("@/lib/ai/client", () => ({ chat: mocks.chat }));
const { createSupabaseServerClient, getUser, chat } = mocks;

function request(body: unknown, raw = false): NextRequest {
  return new NextRequest("http://localhost/api/ai/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: raw ? String(body) : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  createSupabaseServerClient.mockResolvedValue({ auth: { getUser } });
  chat.mockResolvedValue('{"plan":"先回顾已完成章节"}');
});

describe("parsePlanBody (R7.12)", () => {
  it("接受合法请求并规范化空白", () => {
    expect(
      parsePlanBody({
        doneChapters: [" getting-started ", "spot"],
        wrongChapters: ["futures"],
        currentChapter: " technical-analysis ",
      }),
    ).toEqual({
      doneChapters: ["getting-started", "spot"],
      wrongChapters: ["futures"],
      currentChapter: "technical-analysis",
    });
  });

  it("缺省章节字段时回落为空数组/空字符串", () => {
    expect(parsePlanBody({})).toEqual({
      doneChapters: [],
      wrongChapters: [],
      currentChapter: "",
    });
  });

  it("拒绝非数组、非字符串元素与超长 slug", () => {
    expect(parsePlanBody(null)).toBeNull();
    expect(parsePlanBody({ doneChapters: "spot" })).toBeNull();
    expect(parsePlanBody({ wrongChapters: [1] })).toBeNull();
    expect(parsePlanBody({ doneChapters: ["x".repeat(65)] })).toBeNull();
    expect(parsePlanBody({ currentChapter: 5 })).toBeNull();
  });

  it("限制拼进 prompt 的章节数量", () => {
    const many = Array.from({ length: 65 }, (_, i) => `c${i}`);
    expect(parsePlanBody({ doneChapters: many })).toBeNull();
    expect(parsePlanBody({ doneChapters: many.slice(0, 64) })).not.toBeNull();
  });
});


describe("POST /api/ai/plan auth failure boundary", () => {
  it("getUser 返回 error 时返回通用 502，不调模型且不透传内部错误", async () => {
    getUser.mockResolvedValueOnce({ data: { user: null }, error: new Error("secret: trace expired") });

    const res = await POST(request({ doneChapters: [], wrongChapters: [], currentChapter: "" }));

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body).toEqual({ error: "AI 服务暂时不可用，请稍后再试。" });
    expect(JSON.stringify(body)).not.toContain("secret");
    expect(chat).not.toHaveBeenCalled();
  });
});

describe("POST /api/ai/plan 限流（R7.12）", () => {
  it("未登录返回 401，不调模型", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    const res = await POST(request({ doneChapters: [] }));
    expect(res.status).toBe(401);
    expect(chat).not.toHaveBeenCalled();
  });

  it("合法请求返回 plan", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: "plan-user" } },
      error: null,
    });
    const res = await POST(
      request({
        doneChapters: ["spot"],
        wrongChapters: [],
        currentChapter: "spot",
      }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).plan).toBe("先回顾已完成章节");
  });

  it("超过每用户配额返回 429 且带 Retry-After", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: "plan-rl-user" } },
      error: null,
    });
    let last;
    for (let i = 0; i < 31; i++) {
      last = await POST(
        request({ doneChapters: [], wrongChapters: [], currentChapter: "" }),
      );
      if (last.status === 429) break;
    }
    expect(last!.status).toBe(429);
    expect(Number(last!.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect((await last!.json()).error).toBe("Rate limit exceeded");
  });

  it("畸形 JSON 返回 400，不调模型", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: "plan-json-user" } },
      error: null,
    });
    const res = await POST(request("{不是 JSON", true));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Invalid JSON");
    expect(chat).not.toHaveBeenCalled();
  });

  it("模型返回空计划时返回 502", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: "plan-empty-user" } },
      error: null,
    });
    chat.mockResolvedValue("");

    const res = await POST(
      request({ doneChapters: [], wrongChapters: [], currentChapter: "" }),
    );

    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("AI 服务暂时不可用，请稍后再试。");
  });

  it("模型调用失败时返回通用 502", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: "plan-chat-fail-user" } },
      error: null,
    });
    chat.mockRejectedValue(new Error("upstream unavailable"));

    const res = await POST(
      request({ doneChapters: [], wrongChapters: [], currentChapter: "" }),
    );

    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("AI 服务暂时不可用，请稍后再试。");
  });
});
