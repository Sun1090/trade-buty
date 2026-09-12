import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { parseSaveBody, POST } from "./route";

const getUser = vi.fn();
const insert = vi.fn();
const from = vi.fn(() => ({ insert }));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ auth: { getUser }, from })),
}));

function request(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/ai/conversations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  insert.mockResolvedValue({ error: null });
});

describe("parseSaveBody", () => {
  it("规范化合法的来源数组", () => {
    expect(
      parseSaveBody({
        userMessage: "问题",
        assistantMessage: "回答",
        sources: [{ chapter: " spot ", doc: " order-types " }],
      }),
    ).toEqual({
      userMessage: "问题",
      assistantMessage: "回答",
      sources: [{ chapter: "spot", doc: "order-types" }],
    });
  });

  it("拒绝空消息、非数组来源和残缺来源", () => {
    expect(parseSaveBody({ userMessage: " ", assistantMessage: "回答" })).toBeNull();
    expect(parseSaveBody({ userMessage: "问题", assistantMessage: "回答", sources: "spot" })).toBeNull();
    expect(
      parseSaveBody({ userMessage: "问题", assistantMessage: "回答", sources: [{ chapter: "spot" }] }),
    ).toBeNull();
  });
});

describe("POST /api/ai/conversations", () => {
  it("把来源数组直接写入 jsonb，而不是 JSON 字符串", async () => {
    const sources = [{ chapter: "spot", doc: "order-types" }];
    const response = await POST(
      request({ userMessage: "什么是市价单？", assistantMessage: "按当前价格成交。", sources }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(insert).toHaveBeenCalledWith([
      { user_id: "user-1", role: "user", content: "什么是市价单？" },
      {
        user_id: "user-1",
        role: "assistant",
        content: "按当前价格成交。",
        sources,
      },
    ]);
    expect(typeof insert.mock.calls[0][0][1].sources).not.toBe("string");
  });

  it("没有来源时写入 null", async () => {
    const response = await POST(request({ userMessage: "问题", assistantMessage: "回答" }));

    expect(response.status).toBe(200);
    expect(insert.mock.calls[0][0][1].sources).toBeNull();
  });

  it("拒绝非法 JSON 和登录用户之外的请求", async () => {
    const invalid = new NextRequest("http://localhost/api/ai/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    });
    expect((await POST(invalid)).status).toBe(400);

    getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    expect((await POST(request({ userMessage: "问题", assistantMessage: "回答" }))).status).toBe(401);
    expect(insert).not.toHaveBeenCalled();
  });
});
