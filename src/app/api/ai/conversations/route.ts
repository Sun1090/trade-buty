import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, getServerAuthUser } from "@/lib/supabase/server";
import { createRateLimiter } from "@/lib/ai/rate-limit";
import { readJsonBody } from "@/lib/request-body";

/**
 * 一轮问答 = 两行写入（各可达 8KB / 20KB）。这条路由此前是 AI 系列里唯一没有配额的
 * 用户级写入端点：任何免费注册账号都能循环把 `ai_conversations` 撑大，而 RLS 只保证
 * 别人读不到，不限制你自己写多少。
 * authedLimit 与 `/api/ai/chat` 的登录配额（一个窗口 50 次）同量级并留一次重试余量；
 * guestLimit 0 是语义标注——游客没有可归属的会话，进路由前就已经 401。
 */
const conversationsLimiter = createRateLimiter({ guestLimit: 0, authedLimit: 60 });


export interface SaveBody {
  userMessage: string;
  assistantMessage: string;
  sources?: { chapter: string; doc: string }[];
}

/** 单轮正文与引用数量上限：避免客户端把任意大内容写进库 */
export const MAX_USER_MESSAGE_CHARS = 8_000;
export const MAX_ASSISTANT_MESSAGE_CHARS = 20_000;
export const MAX_SOURCES = 20;
const MAX_SLUG_CHARS = 100;

/**
 * 请求体字节上限：上面的字段上限要整包解析完才生效，读流阶段得单独设闸。
 * 两轮正文 + 引用行（每行两个 slug 再加键名开销），字符上限按 CJK 的 UTF-8 上界 ×3
 * 折算，最后留 1 KB JSON 结构余量。
 */
export const MAX_CONVERSATION_BODY_BYTES =
  (MAX_USER_MESSAGE_CHARS +
    MAX_ASSISTANT_MESSAGE_CHARS +
    MAX_SOURCES * (2 * MAX_SLUG_CHARS + 64)) *
    3 +
  1_024;

/** 解析并校验一轮对话；导出以便 Route Handler 回归测试覆盖。 */
export function parseSaveBody(value: unknown): SaveBody | null {
  if (typeof value !== "object" || value === null) return null;
  const body = value as Record<string, unknown>;
  if (typeof body.userMessage !== "string" || !body.userMessage.trim()) return null;
  if (typeof body.assistantMessage !== "string" || !body.assistantMessage.trim()) return null;
  if (body.userMessage.length > MAX_USER_MESSAGE_CHARS) return null;
  if (body.assistantMessage.length > MAX_ASSISTANT_MESSAGE_CHARS) return null;

  let sources: SaveBody["sources"];
  if (body.sources !== undefined) {
    if (!Array.isArray(body.sources)) return null;
    if (body.sources.length > MAX_SOURCES) return null;
    sources = [];
    for (const source of body.sources) {
      if (typeof source !== "object" || source === null) return null;
      const row = source as Record<string, unknown>;
      if (typeof row.chapter !== "string" || !row.chapter.trim()) return null;
      if (typeof row.doc !== "string" || !row.doc.trim()) return null;
      if (row.chapter.trim().length > MAX_SLUG_CHARS) return null;
      if (row.doc.trim().length > MAX_SLUG_CHARS) return null;
      sources.push({ chapter: row.chapter.trim(), doc: row.doc.trim() });
    }
  }

  return {
    userMessage: body.userMessage,
    assistantMessage: body.assistantMessage,
    ...(sources ? { sources } : {}),
  };
}

/** GET: 拉取登录用户最近对话（用于进入 AI 页时恢复历史） */
export async function GET() {
  try {
    let user;
    try {
      user = await getServerAuthUser();
    } catch {
      return NextResponse.json({ error: "Failed to load conversations" }, { status: 500 });
    }
    const supabase = await createSupabaseServerClient();
    if (!user) {
      return NextResponse.json({ messages: [] });
    }

    // 取「最近」50 条必须按时间倒序限窗，再翻回正序给客户端：
    // 升序 + limit(50) 拿到的是这个账号最早的五十条，老用户回到 AI 页永远看不到近况。
    const { data, error } = await supabase
      .from("ai_conversations")
      .select("role, content, sources, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50); // 最近 25 轮

    if (error) {
      console.error("[ai/conversations] select failed:", error.message);
      return NextResponse.json({ error: "Failed to load conversations" }, { status: 500 });
    }

    return NextResponse.json({ messages: (data ?? []).reverse() });
  } catch (e) {
    console.error("[ai/conversations] unexpected failure:", e instanceof Error ? e.message : e);
    return NextResponse.json({ messages: [] });
  }
}

/** POST: 存一轮对话（user + assistant 两条） */
export async function POST(req: NextRequest) {
  // 鉴权与限流放在解析 body 之前：畸形/超大 payload 也计入配额，
  // 不给「先解析再限流」留出绕过窗口（与 /api/ai/chat 同一口径）。
  let user;
  try {
    user = await getServerAuthUser();
  } catch {
    return NextResponse.json({ error: "Failed to save conversation" }, { status: 500 });
  }
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const decision = conversationsLimiter.check(user.id, true);
  if (!decision.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfter: decision.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(decision.retryAfterSec) } },
    );
  }

  const read = await readJsonBody(req, MAX_CONVERSATION_BODY_BYTES);
  if (!read.ok) {
    if (read.reason === "too-large") {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const body = parseSaveBody(read.value);
  if (!body) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    const supabase = await createSupabaseServerClient();

    // 批量插入两条
    const { error } = await supabase.from("ai_conversations").insert([
      { user_id: user.id, role: "user", content: body.userMessage },
      {
        user_id: user.id,
        role: "assistant",
        content: body.assistantMessage,
        // jsonb 列交给 Supabase 序列化；再次 JSON.stringify 会写入 JSON 字符串。
        sources: body.sources ?? null,
      },
    ]);

    if (error) {
      console.error("[ai/conversations] insert failed:", error.message);
      return NextResponse.json({ error: "Failed to save conversation" }, { status: 500 });
    }
  } catch (e) {
    console.error("[ai/conversations] unexpected failure:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Failed to save conversation" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/**
 * 清空是破坏性操作，但也是低容量操作：单条删除语句按 user_id 走索引，给一个与写入
 * 不同量级的独立配额，避免「清空」把额度算进正常存对话的那份预算里。
 */
const clearLimiter = createRateLimiter({ guestLimit: 0, authedLimit: 10 });

/**
 * DELETE: 删除登录用户名下的全部对话。界面上的「清空对话」按钮承诺的就是这件事——
 * 只做本地 `setMessages([])` 的话，下次进页 GET 又把最近 50 条拉回来，等于没清。
 */
export async function DELETE() {
  let user;
  try {
    user = await getServerAuthUser();
  } catch {
    return NextResponse.json({ error: "Failed to clear conversations" }, { status: 500 });
  }
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const decision = clearLimiter.check(user.id, true);
  if (!decision.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfter: decision.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(decision.retryAfterSec) } },
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    // 必须带 user_id 过滤：服务端客户端不受 RLS 约束，漏掉这个条件就是删全站。
    const { error } = await supabase
      .from("ai_conversations")
      .delete()
      .eq("user_id", user.id);

    if (error) {
      console.error("[ai/conversations] delete failed:", error.message);
      return NextResponse.json({ error: "Failed to clear conversations" }, { status: 500 });
    }
  } catch (e) {
    console.error("[ai/conversations] unexpected failure:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Failed to clear conversations" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
