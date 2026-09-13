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
      [{ chapterNum: "getting-started", questionIdx: -1 }],
      [{ chapterNum: "getting-started", questionIdx: 1.5 }],
      // 篇章 slug 形状非法：路径穿越字符、大写、超长、首尾连字符
      [{ chapterNum: "../etc/passwd", questionIdx: 0 }],
      [{ chapterNum: "Getting-Started", questionIdx: 0 }],
      [{ chapterNum: "x".repeat(65), questionIdx: 0 }],
      [{ chapterNum: "-leading", questionIdx: 0 }],
      [{ chapterNum: 1, questionIdx: 0 }],
      [null],
    ];
    for (const items of bad) {
      const res = await POST(request({ items }));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("Invalid payload");
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

  it("变体模式：形状合法但题库里没有的篇章/题号返回 400，不调模型", async () => {
    // 回归：曾经用 /^\d{1,3}$/ 校验 chapterNum，而 QUIZZES 的键其实是英文 slug，
    // 于是真实客户端（错题本）传来的 slug 一律被判非法 400。这里锁定住两种情形。
    const unknownChapter = await POST(request({ items: [{ chapterNum: "999", questionIdx: 0 }] }));
    expect(unknownChapter.status).toBe(400);
    expect((await unknownChapter.json()).error).toBe("No matching questions");

    const outOfRange = await POST(request({ items: [{ chapterNum: "getting-started", questionIdx: 999 }] }));
    expect(outOfRange.status).toBe(400);
    expect((await outOfRange.json()).error).toBe("No matching questions");
    expect(chat).not.toHaveBeenCalled();
  });

  it("变体模式：真实篇章 slug 能取到原题并调用模型（回归保护）", async () => {
    retrieve.mockResolvedValue([
      { chapter: "getting-started", doc: "first-trade", chunk: "止损纪律与仓位管理", similarity: 0.9 },
    ]);
    chat.mockResolvedValue(
      JSON.stringify({
        questions: [
          {
            question: "止损纪律的核心作用是什么？",
            options: ["限定单笔亏损上限", "保证每次盈利", "提高胜率上限", "消除滑点影响"],
            answer: 0,
            explain: "止损纪律把单笔亏损限定在可承受范围内，避免一次失误击穿账户。",
            source: { none: true },
          },
        ],
      }),
    );

    const res = await POST(request({ items: [{ chapterNum: "getting-started", questionIdx: 0 }] }));
    expect(res.status).toBe(200);
    expect(chat).toHaveBeenCalledTimes(1);
    const body = await res.json();
    expect(body.questions).toHaveLength(1);
    expect(body.questions[0].question).toContain("止损");
    // 原题内容确实进了 prompt（错题变体的输入）
    const sent = chat.mock.calls[0][0].messages as { content: string }[];
    expect(sent.some((m) => m.content.includes("K 线图中"))).toBe(true);
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
