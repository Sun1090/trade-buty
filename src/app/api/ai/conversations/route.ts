import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";


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
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ messages: [] });
    }

    const { data, error } = await supabase
      .from("ai_conversations")
      .select("role, content, sources, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(50); // 最近 25 轮

    if (error) {
      console.error("[ai/conversations] select failed:", error.message);
      return NextResponse.json({ error: "Failed to load conversations" }, { status: 500 });
    }

    return NextResponse.json({ messages: data ?? [] });
  } catch (e) {
    console.error("[ai/conversations] unexpected failure:", e instanceof Error ? e.message : e);
    return NextResponse.json({ messages: [] });
  }
}

/** POST: 存一轮对话（user + assistant 两条） */
export async function POST(req: NextRequest) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const body = parseSaveBody(raw);
  if (!body) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
