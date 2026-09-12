import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";


interface SaveBody {
  userMessage: string;
  assistantMessage: string;
  sources?: { chapter: string; doc: string }[];
}

/** 解析并校验一轮对话；导出以便 Route Handler 回归测试覆盖。 */
export function parseSaveBody(value: unknown): SaveBody | null {
  if (typeof value !== "object" || value === null) return null;
  const body = value as Record<string, unknown>;
  if (typeof body.userMessage !== "string" || !body.userMessage.trim()) return null;
  if (typeof body.assistantMessage !== "string" || !body.assistantMessage.trim()) return null;

  let sources: SaveBody["sources"];
  if (body.sources !== undefined) {
    if (!Array.isArray(body.sources)) return null;
    sources = [];
    for (const source of body.sources) {
      if (typeof source !== "object" || source === null) return null;
      const row = source as Record<string, unknown>;
      if (typeof row.chapter !== "string" || !row.chapter.trim()) return null;
      if (typeof row.doc !== "string" || !row.doc.trim()) return null;
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
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ messages: data ?? [] });
  } catch (e) {
    return NextResponse.json({ messages: [], error: e instanceof Error ? e.message : "unknown" });
  }
}

/** POST: 存一轮对话（user + assistant 两条） */
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
