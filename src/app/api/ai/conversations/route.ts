import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "edge";

interface SaveBody {
  userMessage: string;
  assistantMessage: string;
  sources?: { chapter: string; doc: string }[];
}

/** GET: 拉取登录用户最近对话（用于进入 AI 页时恢复历史） */
export async function GET(req: NextRequest) {
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

  const body = (await req.json()) as SaveBody;
  if (!body.userMessage || !body.assistantMessage) {
    return NextResponse.json({ error: "Missing messages" }, { status: 400 });
  }

  const sourcesJson = body.sources ? JSON.stringify(body.sources) : null;

  // 批量插入两条
  const { error } = await supabase.from("ai_conversations").insert([
    { user_id: user.id, role: "user", content: body.userMessage },
    {
      user_id: user.id,
      role: "assistant",
      content: body.assistantMessage,
      sources: sourcesJson,
    },
  ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
