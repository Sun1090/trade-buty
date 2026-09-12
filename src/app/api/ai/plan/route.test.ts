import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { parsePlanBody, POST } from "./route";

const getUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ auth: { getUser } })),
}));
const { chat } = vi.hoisted(() => ({ chat: vi.fn() }));
vi.mock("@/lib/ai/client", () => ({ chat }));

function request(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/ai/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
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

describe("POST /api/ai/plan 限流（R7.12）", () => {
  it("未登录返回 401，不调模型", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    const res = await POST(request({ doneChapters: [] }));
    expect(res.status).toBe(401);
    expect(chat).not.toHaveBeenCalled();
  });

  it("合法请求返回 plan", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "plan-user" } }, error: null });
    const res = await POST(request({ doneChapters: ["spot"], wrongChapters: [], currentChapter: "spot" }));
    expect(res.status).toBe(200);
    expect((await res.json()).plan).toBe("先回顾已完成章节");
  });

  it("超过每用户配额返回 429 且带 Retry-After", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "plan-rl-user" } }, error: null });
    let last;
    for (let i = 0; i < 31; i++) {
      last = await POST(request({ doneChapters: [], wrongChapters: [], currentChapter: "" }));
      if (last.status === 429) break;
    }
    expect(last!.status).toBe(429);
    expect(Number(last!.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect((await last!.json()).error).toBe("Rate limit exceeded");
  });
});
