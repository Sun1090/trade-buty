import { SERVER_ERRORS } from "@/lib/ai/server-errors";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { MAX_PLAN_BODY_BYTES, parsePlanBody, POST } from "./route";
import { resolveAuthUser } from "@/lib/supabase/auth-result";
import { getChapterTitle } from "@/lib/ai/chapters";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  getUser: vi.fn(),
  chat: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
  getServerAuthUser: async () => resolveAuthUser(await mocks.getUser()),
}));
vi.mock("@/lib/ai/client", () => ({ chat: mocks.chat }));
const { createSupabaseServerClient, getUser, chat } = mocks;

function request(body: unknown, raw = false): NextRequest {
  return new NextRequest("http://localhost/api/ai/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: raw ? String(body) : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  createSupabaseServerClient.mockResolvedValue({ auth: { getUser } });
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
      locale: "zh",
    });
  });

  it("缺省章节字段时回落为空数组/空字符串", () => {
    expect(parsePlanBody({})).toEqual({
      doneChapters: [],
      wrongChapters: [],
      currentChapter: "",
      locale: "zh",
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

  it("locale 只认两个真实值，缺省按 zh", () => {
    // 这条只判 locale 那一个字段，但 `parsePlanBody` 的返回类型可空——
    // 用「先断言非 null」的形状取，免得 `?.` 把「整个 body 被拒」也读成 zh。
    const localeOf = (value: unknown) => {
      const parsed = parsePlanBody(value);
      expect(parsed, `这一份 body 不该被拒：${JSON.stringify(value)}`).not.toBeNull();
      return parsed!.locale;
    };
    expect(localeOf({ doneChapters: [], wrongChapters: [], locale: "en" })).toBe("en");
    expect(localeOf({ doneChapters: [], wrongChapters: [], locale: "zh" })).toBe("zh");
    expect(localeOf({ doneChapters: [] })).toBe("zh");
    expect(localeOf({ doneChapters: [], locale: "fr" })).toBe("zh");
    expect(localeOf({ doneChapters: [], locale: 5 })).toBe("zh");
  });
});

/**
 * 送进 prompt 的篇章必须是**篇章名**而不是 slug。
 * `/api/ai/chat` 与 `/api/ai/quiz` 都先经 `getChapterTitle()`（站内唯一的主人）再把篇章
 * 拼进提示词，只有 `/api/ai/plan` 把英文 slug 直接写进中文句子——「我当前学习的篇章：spot」。
 * 判据不写死「现货基础」这种字面：名字从 `getChapterTitle()` 现取，换的是同一份映射。
 */
describe("POST /api/ai/plan 把篇章名送进 prompt，不是 slug", () => {
  async function promptFor(body: Record<string, unknown>) {
    chat.mockResolvedValue('{"plan":"先回顾已完成章节"}');
    getUser.mockResolvedValue({ data: { user: { id: "plan-title-user" } }, error: null });
    const res = await POST(request(body));
    expect(res.status).toBe(200);
    const call = chat.mock.calls.at(-1)?.[0] as { messages: { role: string; content: string }[] };
    return call.messages.map((m) => m.content).join("\n");
  }

  it("中文界面：三处都印篇章名，slug 一次都不许出现", async () => {
    const prompt = await promptFor({
      doneChapters: ["getting-started"],
      wrongChapters: ["futures"],
      currentChapter: "spot",
      locale: "zh",
    });
    for (const [slug, kind] of [["getting-started", "已完成"], ["futures", "错题"], ["spot", "当前"]]) {
      const title = getChapterTitle("zh", slug);
      expect(title, `kb-titles 里查不到 ${slug} 的中文名，靶子变了`).not.toBeNull();
      expect(prompt, `${kind}那处应该印《${title}》`).toContain(title!);
      // slug 本身不许单独成词出现（它可能作为别的串的子串，故按词边界判）
      expect(prompt, `${kind}那处仍印着裸 slug ${slug}`).not.toMatch(
        new RegExp(`(^|[^\w-])${slug}([^\w-]|$)`),
      );
    }
  });

  it("英文界面：取 en 那一侧的名字", async () => {
    const prompt = await promptFor({
      doneChapters: ["spot"],
      wrongChapters: [],
      currentChapter: "futures",
      locale: "en",
    });
    expect(prompt).toContain(getChapterTitle("en", "spot")!);
    expect(prompt).toContain(getChapterTitle("en", "futures")!);
  });

  it("对照：查不到名字的 slug 退回 slug 本身，不把用户进度丢掉", async () => {
    const prompt = await promptFor({
      doneChapters: ["no-such-chapter"],
      wrongChapters: [],
      currentChapter: "",
      locale: "zh",
    });
    expect(getChapterTitle("zh", "no-such-chapter")).toBeNull();
    expect(prompt).toContain("no-such-chapter");
  });

  it("对照：一条都没有时三处都写「无」", async () => {
    const prompt = await promptFor({ doneChapters: [], wrongChapters: [], currentChapter: "", locale: "zh" });
    expect(prompt.match(/无/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
  });
});


describe("POST /api/ai/plan auth failure boundary", () => {
  it("getUser 返回 error 时返回通用 502，不调模型且不透传内部错误", async () => {
    getUser.mockResolvedValueOnce({ data: { user: null }, error: new Error("secret: trace expired") });

    const res = await POST(request({ doneChapters: [], wrongChapters: [], currentChapter: "" }));

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body).toEqual({ error: SERVER_ERRORS.authUnavailable });
    expect(JSON.stringify(body)).not.toContain("secret");
    expect(chat).not.toHaveBeenCalled();
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
    getUser.mockResolvedValue({
      data: { user: { id: "plan-user" } },
      error: null,
    });
    const res = await POST(
      request({
        doneChapters: ["spot"],
        wrongChapters: [],
        currentChapter: "spot",
      }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).plan).toBe("先回顾已完成章节");
  });

  it("超过每用户配额返回 429 且带 Retry-After", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: "plan-rl-user" } },
      error: null,
    });
    let last;
    for (let i = 0; i < 31; i++) {
      last = await POST(
        request({ doneChapters: [], wrongChapters: [], currentChapter: "" }),
      );
      if (last.status === 429) break;
    }
    expect(last!.status).toBe(429);
    expect(Number(last!.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect((await last!.json()).error).toBe("Rate limit exceeded");
  });

  it("畸形 JSON 返回 400，不调模型", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: "plan-json-user" } },
      error: null,
    });
    const res = await POST(request("{不是 JSON", true));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Invalid JSON");
    expect(chat).not.toHaveBeenCalled();
  });

  // 字段上限要整包解析完才生效，读流阶段的字节闸才挡得住超大 body
  it("超过请求体字节上限返回 413，不调模型", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: "plan-large-user" } },
      error: null,
    });
    const res = await POST(
      request(JSON.stringify({ doneChapters: ["物".repeat(MAX_PLAN_BODY_BYTES)] }), true),
    );

    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: "Payload too large" });
    expect(chat).not.toHaveBeenCalled();
  });

  it("模型返回空计划时返回 502", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: "plan-empty-user" } },
      error: null,
    });
    chat.mockResolvedValue("");

    const res = await POST(
      request({ doneChapters: [], wrongChapters: [], currentChapter: "" }),
    );

    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe(SERVER_ERRORS.upstreamUnavailable);
  });

  it("模型调用失败时返回通用 502", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: "plan-chat-fail-user" } },
      error: null,
    });
    chat.mockRejectedValue(new Error("upstream unavailable"));

    const res = await POST(
      request({ doneChapters: [], wrongChapters: [], currentChapter: "" }),
    );

    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe(SERVER_ERRORS.upstreamUnavailable);
  });
});
