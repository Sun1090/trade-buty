import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  MAX_ANSWER_CHARS,
  MAX_FEEDBACK_BODY_BYTES,
  MAX_QUESTION_CHARS,
  PER_MINUTE_LIMIT,
  parseFeedbackBody,
  POST,
} from "./route";
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
  return new NextRequest("http://localhost/api/ai/feedback", {
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

describe("parseFeedbackBody (R7.12)", () => {
  it("接受合法反馈并保留游客匿名", () => {
    expect(
      parseFeedbackBody({ rating: "helpful", question: "q", answer: "a" }),
    ).toEqual({
      rating: "helpful",
      question: "q",
      answer: "a",
    });
  });

  it("拒绝非法 rating / 空文本 / 非字符串", () => {
    expect(
      parseFeedbackBody({ rating: "meh", question: "q", answer: "a" }),
    ).toBeNull();
    expect(
      parseFeedbackBody({ rating: "helpful", question: " ", answer: "a" }),
    ).toBeNull();
    expect(
      parseFeedbackBody({ rating: "helpful", question: "q", answer: "" }),
    ).toBeNull();
    expect(
      parseFeedbackBody({ rating: "helpful", question: 1, answer: "a" }),
    ).toBeNull();
    expect(parseFeedbackBody(null)).toBeNull();
  });

  it("拒绝超长 question / answer", () => {
    expect(
      parseFeedbackBody({
        rating: "helpful",
        question: "x".repeat(MAX_QUESTION_CHARS + 1),
        answer: "a",
      }),
    ).toBeNull();
    expect(
      parseFeedbackBody({
        rating: "helpful",
        question: "q",
        answer: "x".repeat(MAX_ANSWER_CHARS + 1),
      }),
    ).toBeNull();
  });
});

describe("POST /api/ai/feedback", () => {
  it("畸形 JSON 返回 400", async () => {
    const res = await POST(request("{不是 JSON"));
    expect(res.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  // 匿名可写端点：字段上限要解析完才生效，所以读流阶段的字节闸是唯一挡住超大 body 的东西
  it("超过请求体字节上限返回 413，不写库也不透传内容", async () => {
    const res = await POST(
      request(
        JSON.stringify({
          rating: "helpful",
          question: "q",
          answer: "物".repeat(MAX_FEEDBACK_BODY_BYTES),
        }),
      ),
    );
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: "Payload too large" });
    expect(insert).not.toHaveBeenCalled();
  });

  it("非法载荷返回 400", async () => {
    const res = await POST(
      request(JSON.stringify({ rating: "meh", question: "q", answer: "a" })),
    );
    expect(res.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it("合法游客反馈写入成功", async () => {
    const res = await POST(
      request(
        JSON.stringify({ rating: "helpful", question: "q", answer: "a" }),
      ),
    );
    expect(res.status).toBe(200);
    expect(insert).toHaveBeenCalledWith({
      user_id: null,
      rating: "helpful",
      question: "q",
      answer: "a",
    });
  });

  it("登录用户的评分带着自己的账户 id 入库（隐私页「登录后会带上账户标识」说的就是这一行）", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-77" } }, error: null });
    const res = await POST(
      request(JSON.stringify({ rating: "helpful", question: "q", answer: "a" })),
    );
    expect(res.status).toBe(200);
    expect(insert).toHaveBeenCalledWith({
      user_id: "user-77",
      rating: "helpful",
      question: "q",
      answer: "a",
    });
  });

  it("数据库失败返回通用文案，不回传内部错误", async () => {
    insert.mockResolvedValue({
      error: { message: "relation ai_feedback does not exist" },
    });
    const res = await POST(
      request(
        JSON.stringify({ rating: "helpful", question: "q", answer: "a" }),
      ),
    );
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Failed to save feedback");
  });

  it("getUser 返回 error 时按匿名入库，不透传内部错误（反馈不凭空消失）", async () => {
    getUser.mockResolvedValueOnce({ data: { user: null }, error: new Error("secret: trace expired") });
    const res = await POST(
      request(JSON.stringify({ rating: "helpful", question: "问题", answer: "回答" })),
    );

    // RLS 允许 user_id is null 的匿名行，而前端是 fire-and-forget：
    // 回 500 就等于把一次真人反馈直接丢掉。
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
    expect(JSON.stringify(body)).not.toContain("secret");
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: null, question: "问题" }),
    );
  });

  it("身份读取异常也按匿名入库，不回传内部错误", async () => {
    getUser.mockRejectedValue(new Error("auth token expired"));
    const res = await POST(
      request(
        JSON.stringify({ rating: "helpful", question: "q", answer: "a" }),
      ),
    );

    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: null }));
  });

  it("同一 NAT 出口下两个登录账号各有自己的配额", async () => {
    const body = JSON.stringify({ rating: "unhelpful", question: "q", answer: "a" });
    const sharedIp = "198.51.100.7";
    getUser.mockResolvedValue({ data: { user: { id: "user-a" } }, error: null });
    let last: Awaited<ReturnType<typeof POST>> | undefined;
    for (let i = 0; i < PER_MINUTE_LIMIT + 1; i++) {
      last = await POST(request(body, sharedIp));
    }
    expect(last!.status).toBe(429);

    // 同 IP 的另一个账号不能被前一个账号的灌量一起锁死
    getUser.mockResolvedValue({ data: { user: { id: "user-b" } }, error: null });
    insert.mockClear();
    const other = await POST(request(body, sharedIp));
    expect(other.status).toBe(200);
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it("单 IP 超过每分钟配额返回 429 且不再写库，其他 IP 不受影响", async () => {
    const body = JSON.stringify({
      rating: "helpful",
      question: "q",
      answer: "a",
    });
    const flooder = "203.0.113.99";
    let last: Awaited<ReturnType<typeof POST>> | undefined;
    for (let i = 0; i < PER_MINUTE_LIMIT + 1; i++) {
      last = await POST(request(body, flooder));
    }
    expect(last!.status).toBe(429);
    expect(Number(last!.headers.get("Retry-After"))).toBeGreaterThan(0);
    // 超限那次没有落库
    expect(insert).toHaveBeenCalledTimes(PER_MINUTE_LIMIT);

    // 同实例内另一个 IP 仍有自己的配额（限流按 IP 分桶，不是全局计数器）
    insert.mockClear();
    const other = await POST(request(body, "203.0.113.100"));
    expect(other.status).toBe(200);
    expect(insert).toHaveBeenCalledTimes(1);
  });
});
