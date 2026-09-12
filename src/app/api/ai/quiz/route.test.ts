import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const getUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ auth: { getUser } })),
}));
const { chat } = vi.hoisted(() => ({ chat: vi.fn() }));
vi.mock("@/lib/ai/client", () => ({ chat }));
const { retrieve } = vi.hoisted(() => ({ retrieve: vi.fn() }));
vi.mock("@/lib/ai/rag", () => ({ retrieve }));

function request(body: unknown, raw?: string): NextRequest {
  return new NextRequest("http://localhost/api/ai/quiz", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: raw ?? JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  retrieve.mockResolvedValue([]);
});

describe("POST /api/ai/quiz 输入校验（R7.12）", () => {
  it("未登录返回 401", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    const res = await POST(request({ items: [{ chapterNum: "01", questionIdx: 0 }] }));
    expect(res.status).toBe(401);
    expect(chat).not.toHaveBeenCalled();
  });

  it("非 JSON / 非对象请求体返回 400", async () => {
    expect((await POST(request(null, "{坏 JSON"))).status).toBe(400);
    expect((await POST(request("字符串"))).status).toBe(400);
    expect(chat).not.toHaveBeenCalled();
  });

  it("items 非数组或为空返回 400", async () => {
    expect((await POST(request({}))).status).toBe(400);
    expect((await POST(request({ items: [] }))).status).toBe(400);
    expect((await POST(request({ items: "spot" }))).status).toBe(400);
  });

  it("items 元素形状非法时返回 400，不调模型", async () => {
    const bad = [
      [{ chapterNum: "01", questionIdx: -1 }],
      [{ chapterNum: "01", questionIdx: 1.5 }],
      [{ chapterNum: "abc", questionIdx: 0 }],
      [{ chapterNum: 1, questionIdx: 0 }],
      [null],
    ];
    for (const items of bad) {
      const res = await POST(request({ items }));
      expect(res.status).toBe(400);
    }
    expect(chat).not.toHaveBeenCalled();
  });

  it("章节模式：非法 slug 返回 400，未知章节返回 400", async () => {
    expect((await POST(request({ chapter: "x".repeat(65) }))).status).toBe(400);
    expect((await POST(request({ chapter: 123 }))).status).toBe(400);
    const unknown = await POST(request({ chapter: "not-a-real-chapter" }));
    expect(unknown.status).toBe(400);
    expect(chat).not.toHaveBeenCalled();
  });

  it("变体模式：题库里不存在的篇章/题号返回 400，不调模型", async () => {
    const res = await POST(request({ items: [{ chapterNum: "999", questionIdx: 0 }] }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("No matching questions");
    expect(chat).not.toHaveBeenCalled();
  });
});

describe("POST /api/ai/quiz 限流（R7.12）", () => {
  it("超过每用户配额返回 429", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "quiz-rl-user" } }, error: null });
    let last;
    for (let i = 0; i < 41; i++) {
      last = await POST(request({ items: [{ chapterNum: "01", questionIdx: 0 }] }));
      if (last.status === 429) break;
    }
    expect(last!.status).toBe(429);
    expect(Number(last!.headers.get("Retry-After"))).toBeGreaterThan(0);
  });
});
