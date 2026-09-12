import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { MAX_ANSWER_CHARS, MAX_QUESTION_CHARS, parseFeedbackBody, POST } from "./route";

const getUser = vi.fn();
const insert = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ auth: { getUser }, from: () => ({ insert }) })),
}));

function request(raw: string): NextRequest {
  return new NextRequest("http://localhost/api/ai/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: raw,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: null }, error: null });
  insert.mockResolvedValue({ error: null });
});

describe("parseFeedbackBody (R7.12)", () => {
  it("接受合法反馈并保留游客匿名", () => {
    expect(parseFeedbackBody({ rating: "helpful", question: "q", answer: "a" })).toEqual({
      rating: "helpful",
      question: "q",
      answer: "a",
    });
  });

  it("拒绝非法 rating / 空文本 / 非字符串", () => {
    expect(parseFeedbackBody({ rating: "meh", question: "q", answer: "a" })).toBeNull();
    expect(parseFeedbackBody({ rating: "helpful", question: " ", answer: "a" })).toBeNull();
    expect(parseFeedbackBody({ rating: "helpful", question: "q", answer: "" })).toBeNull();
    expect(parseFeedbackBody({ rating: "helpful", question: 1, answer: "a" })).toBeNull();
    expect(parseFeedbackBody(null)).toBeNull();
  });

  it("拒绝超长 question / answer", () => {
    expect(
      parseFeedbackBody({ rating: "helpful", question: "x".repeat(MAX_QUESTION_CHARS + 1), answer: "a" }),
    ).toBeNull();
    expect(
      parseFeedbackBody({ rating: "helpful", question: "q", answer: "x".repeat(MAX_ANSWER_CHARS + 1) }),
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
    const res = await POST(request(JSON.stringify({ rating: "meh", question: "q", answer: "a" })));
    expect(res.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it("合法游客反馈写入成功", async () => {
    const res = await POST(request(JSON.stringify({ rating: "helpful", question: "q", answer: "a" })));
    expect(res.status).toBe(200);
    expect(insert).toHaveBeenCalledWith({
      user_id: null,
      rating: "helpful",
      question: "q",
      answer: "a",
    });
  });

  it("数据库失败返回通用文案，不回传内部错误", async () => {
    insert.mockResolvedValue({ error: { message: "relation ai_feedback does not exist" } });
    const res = await POST(request(JSON.stringify({ rating: "helpful", question: "q", answer: "a" })));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Failed to save feedback");
  });
});
