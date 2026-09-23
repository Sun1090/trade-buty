import { beforeEach, describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { MAX_CITATION_BODY_BYTES, PER_MINUTE_LIMIT, parseCitationClick, POST } from "./route";
import { resolveAuthUser } from "@/lib/supabase/auth-result";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  getUser: vi.fn(),
  insert: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
  getServerAuthUser: async () => resolveAuthUser(await mocks.getUser()),
}));
const { createSupabaseServerClient, getUser, insert } = mocks;

let ipCounter = 0;
/** 每个请求默认换一个 IP：限流表是模块级进程内状态，用例之间不能互相扣配额。 */
function request(raw: string, ip?: string): NextRequest {
  ipCounter += 1;
  return new NextRequest("http://localhost/api/ai/citation-click", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": ip ?? `198.51.100.${ipCounter % 250}`,
    },
    body: raw,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  createSupabaseServerClient.mockResolvedValue({
    auth: { getUser },
    from: () => ({ insert }),
  });
  getUser.mockResolvedValue({ data: { user: null }, error: null });
  insert.mockResolvedValue({ error: null });
});

describe("parseCitationClick", () => {
  it("合法 source 点击返回规范化字段", () => {
    const out = parseCitationClick({
      kind: "source",
      chapter: "spot",
      doc: "order-types",
      question: "什么是市价单？",
    });
    expect(out).toEqual({
      kind: "source",
      chapter: "spot",
      doc: "order-types",
      question: "什么是市价单？",
    });
  });

  it("suggested 点击无 doc 也合法", () => {
    expect(
      parseCitationClick({ kind: "suggested", chapter: "futures" }),
    ).toEqual({
      kind: "suggested",
      chapter: "futures",
      doc: undefined,
      question: undefined,
    });
  });

  it("非法 kind / 空 chapter / 非对象返回 null", () => {
    expect(parseCitationClick({ kind: "click", chapter: "spot" })).toBeNull();
    expect(parseCitationClick({ kind: "source", chapter: "  " })).toBeNull();
    expect(parseCitationClick(null)).toBeNull();
    expect(parseCitationClick("x")).toBeNull();
  });

  it("chapter 超长拒绝；doc/question 超长截断", () => {
    expect(
      parseCitationClick({ kind: "source", chapter: "a".repeat(101) }),
    ).toBeNull();
    const out = parseCitationClick({
      kind: "source",
      chapter: "spot",
      doc: "d".repeat(300),
      question: "q".repeat(600),
    });
    expect(out?.doc).toHaveLength(200);
    expect(out?.question).toHaveLength(500);
  });
});

describe("POST /api/ai/citation-click", () => {
  it("畸形 JSON 返回 400 且不写库", async () => {
    const res = await POST(request("{不是 JSON"));
    expect(res.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  // 匿名可上报端点：字段上限要解析完才生效，读流阶段的字节闸才挡得住超大 body
  it("超过请求体字节上限返回 413 且不写库", async () => {
    const res = await POST(
      request(
        JSON.stringify({
          kind: "source",
          chapter: "spot",
          question: "物".repeat(MAX_CITATION_BODY_BYTES),
        }),
      ),
    );
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: "Payload too large" });
    expect(insert).not.toHaveBeenCalled();
  });

  it("非法载荷返回 400", async () => {
    const res = await POST(
      request(JSON.stringify({ kind: "click", chapter: "spot" })),
    );
    expect(res.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it("合法匿名点击写入成功，user_id 为 null", async () => {
    const res = await POST(
      request(
        JSON.stringify({ kind: "source", chapter: "spot", doc: "order-types" }),
      ),
    );
    expect(res.status).toBe(200);
    expect(insert).toHaveBeenCalledWith({
      user_id: null,
      kind: "source",
      chapter: "spot",
      doc: "order-types",
      question: null,
    });
  });

  it("登录用户的引用点击带着自己的账户 id 入库（注销时才摘掉，见隐私页）", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-77" } }, error: null });
    const res = await POST(
      request(
        JSON.stringify({ kind: "source", chapter: "spot", doc: "order-types", question: "q" }),
      ),
    );
    expect(res.status).toBe(200);
    expect(insert).toHaveBeenCalledWith({
      user_id: "user-77",
      kind: "source",
      chapter: "spot",
      doc: "order-types",
      question: "q",
    });
  });

  it("数据库失败返回通用文案，不回传内部错误", async () => {
    insert.mockResolvedValue({
      error: { message: "permission denied for table ai_citation_clicks" },
    });
    const res = await POST(
      request(JSON.stringify({ kind: "source", chapter: "spot" })),
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Failed to record click");
    expect(JSON.stringify(body)).not.toContain("permission denied");
  });

  it("getUser 返回 error 时按匿名入库，不透传内部错误（点击不凭空消失）", async () => {
    getUser.mockResolvedValueOnce({ data: { user: null }, error: new Error("secret: trace expired") });
    const res = await POST(
      request(JSON.stringify({ kind: "source", chapter: "spot" })),
    );

    // RLS 允许 user_id is null 的匿名行；回 500 等于把一次真实点击丢掉，而且没人会重试
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
    expect(JSON.stringify(body)).not.toContain("secret");
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: null, chapter: "spot" }));
  });

  it("身份读取异常也按匿名入库，不回传内部错误", async () => {
    getUser.mockRejectedValue(new Error("auth unavailable"));
    const res = await POST(
      request(JSON.stringify({ kind: "source", chapter: "spot" })),
    );

    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: null }));
  });

  it("同一 NAT 出口下两个登录账号各有自己的配额", async () => {
    const body = JSON.stringify({ kind: "source", chapter: "spot" });
    const sharedIp = "192.0.2.7";
    getUser.mockResolvedValue({ data: { user: { id: "clicker-a" } }, error: null });
    let last: Awaited<ReturnType<typeof POST>> | undefined;
    for (let i = 0; i < PER_MINUTE_LIMIT + 1; i++) {
      last = await POST(request(body, sharedIp));
    }
    expect(last!.status).toBe(429);

    getUser.mockResolvedValue({ data: { user: { id: "clicker-b" } }, error: null });
    insert.mockClear();
    const other = await POST(request(body, sharedIp));
    expect(other.status).toBe(200);
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it("单 IP 超过每分钟配额返回 429 且不再写库，其他 IP 不受影响", async () => {
    const body = JSON.stringify({
      kind: "source",
      chapter: "spot",
      doc: "order-types",
    });
    const flooder = "203.0.113.77";
    let last: Awaited<ReturnType<typeof POST>> | undefined;
    for (let i = 0; i < PER_MINUTE_LIMIT + 1; i++) {
      last = await POST(request(body, flooder));
    }
    expect(last!.status).toBe(429);
    expect(Number(last!.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(insert).toHaveBeenCalledTimes(PER_MINUTE_LIMIT);

    insert.mockClear();
    const other = await POST(request(body, "203.0.113.78"));
    expect(other.status).toBe(200);
    expect(insert).toHaveBeenCalledTimes(1);
  });
});
