import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "edge";

interface FeedbackBody {
  rating: "helpful" | "unhelpful";
  question: string;
  answer: string;
}

/** POST: 存 AI 回答反馈（登录用户） */
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const body = (await req.json()) as FeedbackBody;
  if (body.rating !== "helpful" && body.rating !== "unhelpful") {
    return NextResponse.json({ error: "Invalid rating" }, { status: 400 });
  }
  if (!body.question || !body.answer) {
    return NextResponse.json({ error: "Missing question/answer" }, { status: 400 });
  }

  const { error } = await supabase.from("ai_feedback").insert({
    user_id: user?.id ?? null, // 游客也可反馈（匿名）
    rating: body.rating,
    question: body.question,
    answer: body.answer,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
