import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AuthSessionMissingError } from "@supabase/supabase-js";
import {
  MAX_ASSISTANT_MESSAGE_CHARS,
  MAX_CONVERSATION_BODY_BYTES,
  MAX_SOURCES,
  MAX_USER_MESSAGE_CHARS,
  parseSaveBody,
  GET,
  POST,
  DELETE,
} from "./route";
import { resolveAuthUser } from "@/lib/supabase/auth-result";

const db = vi.hoisted(() => {
  const getUser = vi.fn();
  const insert = vi.fn();
  const limit = vi.fn();
  const order = vi.fn(() => ({ limit }));
  const eq = vi.fn(() => ({ order }));
  const select = vi.fn(() => ({ eq }));
  // 删除链是 `from().delete().eq(user_id)`；与 select 链共用同一个 eq 会把两种断言搅在一起
  const delEq = vi.fn(async (): Promise<{ error: { message: string } | null }> => ({ error: null }));
  const del = vi.fn(() => ({ eq: delEq }));
  const from = vi.fn(() => ({ insert, select, delete: del }));
  const createSupabaseServerClient = vi.fn(async () => ({ auth: { getUser }, from }));
  return {
    getUser,
    insert,
    limit,
    order,
    eq,
    select,
    del,
    delEq,
    from,
    createSupabaseServerClient,
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: db.createSupabaseServerClient,
  getServerAuthUser: async () => resolveAuthUser(await db.getUser()),
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

  it("无会话 cookie 的真实游客形状返回空列表，不是 500", async () => {
    db.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: new AuthSessionMissingError(),
    });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ messages: [] });
    expect(db.select).not.toHaveBeenCalled();
  });

  it("getUser 返回 error 时加载历史返回通用失败，不读库且不透传内部错误", async () => {
    db.getUser.mockResolvedValueOnce({ data: { user: null }, error: new Error("secret: trace expired") });

    const res = await GET();

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: "Failed to load conversations" });
    expect(JSON.stringify(body)).not.toContain("secret");
    expect(db.select).not.toHaveBeenCalled();
  });

  it("取最近 50 条（倒序限窗）后再翻成正序返回给客户端", async () => {
    // 云端按倒序返回：最新在前
    const newestFirst = [
      { role: "assistant", content: "yo", sources: [{ chapter: "spot", doc: "order" }], created_at: "2026-01-01T00:00:01Z" },
      { role: "user", content: "hi", sources: null, created_at: "2026-01-01T00:00:00Z" },
    ];
    db.limit.mockResolvedValueOnce({ data: newestFirst, error: null });

    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      messages: [
        { role: "user", content: "hi", sources: null, created_at: "2026-01-01T00:00:00Z" },
        { role: "assistant", content: "yo", sources: [{ chapter: "spot", doc: "order" }], created_at: "2026-01-01T00:00:01Z" },
      ],
    });
    // 升序 + limit 会拿到这个账号最早的五十条，老用户永远看不到近况
    expect(db.from).toHaveBeenCalledWith("ai_conversations");
    expect(db.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(db.order).toHaveBeenCalledWith("created_at", { ascending: false });
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
  // 字段上限要整包解析完才生效，读流阶段的字节闸才挡得住登录账号灌超大 body
  it("超过请求体字节上限返回 413，不写库", async () => {
    const response = await POST(
      request({
        userMessage: "物".repeat(MAX_CONVERSATION_BODY_BYTES),
        assistantMessage: "回答",
      }),
    );

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: "Payload too large" });
    expect(db.insert).not.toHaveBeenCalled();
  });

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

  it("游客的畸形请求先被 401 挡下，不进入 body 解析", async () => {
    db.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    const garbage = new NextRequest("http://localhost/api/ai/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    });
    const res = await POST(garbage);
    expect(res.status).toBe(401);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("同一账号超过每小时配额后 429，并带 Retry-After", async () => {
    // 独立 user id：模块级限流器在同一文件的其它用例里不被干扰
    db.getUser.mockResolvedValue({ data: { user: { id: "user-flood" } }, error: null });
    let lastStatus = 0;
    for (let i = 0; i < 61; i++) {
      const res = await POST(request({ userMessage: "问题", assistantMessage: "回答" }));
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
    expect(await (await POST(request({ userMessage: "问题", assistantMessage: "回答" }))).json()).toMatchObject({
      error: "Rate limit exceeded",
    });
    // 60 次是配额内，配额外的请求一律不写库
    expect(db.insert).toHaveBeenCalledTimes(60);
  });
});

describe("DELETE /api/ai/conversations", () => {
  it("登录用户清空：删除必须带 user_id 过滤", async () => {
    const response = await DELETE();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(db.del).toHaveBeenCalledTimes(1);
    // 服务端客户端不受 RLS 约束：这个条件就是「只删自己的」唯一的闸
    expect(db.delEq).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("游客 401，一条都不删", async () => {
    db.getUser.mockResolvedValue({ data: { user: null }, error: null });

    const response = await DELETE();

    expect(response.status).toBe(401);
    expect(db.del).not.toHaveBeenCalled();
  });

  it("鉴权本身出错时 500，且不碰库、不透传内部错误", async () => {
    db.getUser.mockResolvedValueOnce({ data: { user: null }, error: new Error("secret: trace expired") });

    const response = await DELETE();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Failed to clear conversations" });
    expect(db.del).not.toHaveBeenCalled();
  });

  it("删除失败返回 500，不透传数据库内部信息", async () => {
    db.delEq.mockResolvedValue({ error: { message: "duplicate key value violates unique constraint ai_conversations_pkey" } });

    const response = await DELETE();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Failed to clear conversations" });
  });

  it("同一账号超过清空配额后 429，并带 Retry-After", async () => {
    // 独立 user id：模块级限流器在同一文件的其它用例里不被干扰
    db.getUser.mockResolvedValue({ data: { user: { id: "user-clear-flood" } }, error: null });
    let lastStatus = 0;
    for (let i = 0; i < 11; i++) {
      const res = await DELETE();
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
    // 10 次是配额内，配额外的请求一律不碰库
    expect(db.del).toHaveBeenCalledTimes(10);
  });
});
