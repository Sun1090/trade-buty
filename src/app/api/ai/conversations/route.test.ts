import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  MAX_ASSISTANT_MESSAGE_CHARS,
  MAX_SOURCES,
  MAX_USER_MESSAGE_CHARS,
  parseSaveBody,
  GET,
  POST,
} from "./route";

const db = vi.hoisted(() => {
  const getUser = vi.fn();
  const insert = vi.fn();
  const limit = vi.fn();
  const order = vi.fn(() => ({ limit }));
  const eq = vi.fn(() => ({ order }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ insert, select }));
  const createSupabaseServerClient = vi.fn(async () => ({ auth: { getUser }, from }));
  return { getUser, insert, limit, order, eq, select, from, createSupabaseServerClient };
});

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: db.createSupabaseServerClient,
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
  db.createSupabaseServerClient.mockImplementation(async () => ({
    auth: { getUser: db.getUser },
    from: db.from,
  }));
  db.getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  db.insert.mockResolvedValue({ error: null });
  db.limit.mockResolvedValue({ data: [], error: null });
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

  it("拒绝超长正文与超量来源（R7.12）", () => {
    expect(
      parseSaveBody({ userMessage: "x".repeat(MAX_USER_MESSAGE_CHARS + 1), assistantMessage: "回答" }),
    ).toBeNull();
    expect(
      parseSaveBody({ userMessage: "问题", assistantMessage: "x".repeat(MAX_ASSISTANT_MESSAGE_CHARS + 1) }),
    ).toBeNull();
    const many = Array.from({ length: MAX_SOURCES + 1 }, () => ({ chapter: "spot", doc: "order" }));
    expect(parseSaveBody({ userMessage: "问题", assistantMessage: "回答", sources: many })).toBeNull();
    expect(
      parseSaveBody({
        userMessage: "问题",
        assistantMessage: "回答",
        sources: [{ chapter: "x".repeat(101), doc: "order" }],
      }),
    ).toBeNull();
  });

  it("拒绝空消息、非数组来源和残缺来源", () => {
    expect(parseSaveBody({ userMessage: " ", assistantMessage: "回答" })).toBeNull();
    expect(parseSaveBody({ userMessage: "问题", assistantMessage: "回答", sources: "spot" })).toBeNull();
    expect(
      parseSaveBody({ userMessage: "问题", assistantMessage: "回答", sources: [{ chapter: "spot" }] }),
    ).toBeNull();
  });

  it("非对象与 null 入参直接判非法", () => {
    expect(parseSaveBody(null)).toBeNull();
    expect(parseSaveBody("nope")).toBeNull();
    expect(parseSaveBody({ userMessage: 1, assistantMessage: "回答" })).toBeNull();
    expect(parseSaveBody({ userMessage: "问题", assistantMessage: 2 })).toBeNull();
  });
});

describe("GET /api/ai/conversations", () => {
  it("未登录返回空列表而不是报错（首访用户不该看到错误）", async () => {
    db.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ messages: [] });
    expect(db.select).not.toHaveBeenCalled();
  });

  it("按时间升序取最近 50 条返回给客户端", async () => {
    const rows = [
      { role: "user", content: "hi", sources: null, created_at: "2026-01-01T00:00:00Z" },
      { role: "assistant", content: "yo", sources: [{ chapter: "spot", doc: "order" }], created_at: "2026-01-01T00:00:01Z" },
    ];
    db.limit.mockResolvedValueOnce({ data: rows, error: null });

    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ messages: rows });
    // 只取自己的会话，且按时间正序 + 限额
    expect(db.from).toHaveBeenCalledWith("ai_conversations");
    expect(db.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(db.order).toHaveBeenCalledWith("created_at", { ascending: true });
    expect(db.limit).toHaveBeenCalledWith(50);
  });

  it("无数据时返回空数组而不是 null（客户端 data.messages?.length 才不会炸）", async () => {
    db.limit.mockResolvedValueOnce({ data: null, error: null });
    const res = await GET();
    expect(await res.json()).toEqual({ messages: [] });
  });

  it("查询失败返回 500", async () => {
    db.limit.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    const res = await GET();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Failed to load conversations" });
  });

  it("Supabase 客户端本身抛错时降级为空历史（不阻断聊天页）", async () => {
    db.createSupabaseServerClient.mockRejectedValueOnce(new Error("no env"));
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ messages: [] });
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
    expect(db.insert).toHaveBeenCalledWith([
      { user_id: "user-1", role: "user", content: "什么是市价单？" },
      {
        user_id: "user-1",
        role: "assistant",
        content: "按当前价格成交。",
        sources,
      },
    ]);
    expect(typeof db.insert.mock.calls[0][0][1].sources).not.toBe("string");
  });

  it("没有来源时写入 null", async () => {
    const response = await POST(request({ userMessage: "问题", assistantMessage: "回答" }));

    expect(response.status).toBe(200);
    expect(db.insert.mock.calls[0][0][1].sources).toBeNull();
  });

  it("拒绝非法 JSON 和登录用户之外的请求", async () => {
    const invalid = new NextRequest("http://localhost/api/ai/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    });
    expect((await POST(invalid)).status).toBe(400);

    db.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    expect((await POST(request({ userMessage: "问题", assistantMessage: "回答" }))).status).toBe(401);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("非法载荷（形状不符）返回 400 且不写库", async () => {
    const res = await POST(request({ userMessage: "", assistantMessage: "回答" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid payload" });
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("insert 报错返回 500", async () => {
    db.insert.mockResolvedValueOnce({ error: { message: "boom" } });
    const res = await POST(request({ userMessage: "问题", assistantMessage: "回答" }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Failed to save conversation" });
  });

  it("认证阶段抛错也被兜住返回 500", async () => {
    db.getUser.mockRejectedValueOnce(new Error("bad jwt"));
    const res = await POST(request({ userMessage: "问题", assistantMessage: "回答" }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Failed to save conversation" });
  });
});
