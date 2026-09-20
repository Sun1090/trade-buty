import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  MAX_ANSWER_CHARS,
  MAX_QUESTION_CHARS,
  PER_MINUTE_LIMIT,
  parseFeedbackBody,
  POST,
} from "./route";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  getUser: vi.fn(),
  insert: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
  getServerAuthUser: async () => {
    const { data: { user }, error } = await mocks.getUser();
    if (error) throw error;
    return user;
  },
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

  it("getUser 返回 error 时返回通用失败文案，不写库且不透传内部错误", async () => {
    getUser.mockResolvedValueOnce({ data: { user: null }, error: new Error("secret: trace expired") });
    const res = await POST(
      request(JSON.stringify({ rating: "helpful", question: "问题", answer: "回答" })),
    );

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: "Failed to save feedback" });
    expect(JSON.stringify(body)).not.toContain("secret");
    expect(insert).not.toHaveBeenCalled();
  });

  it("身份读取异常也返回通用失败文案，不回传内部错误", async () => {
    getUser.mockRejectedValue(new Error("auth token expired"));
    const res = await POST(
      request(
        JSON.stringify({ rating: "helpful", question: "q", answer: "a" }),
      ),
    );

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Failed to save feedback");
    expect(JSON.stringify(body)).not.toContain("auth token expired");
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
