import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface FeedbackBody {
  rating: "helpful" | "unhelpful";
  question: string;
  answer: string;
}

/** 反馈文本长度上限：匿名也能写库，必须有界，避免单请求塞入任意大内容 */
export const MAX_QUESTION_CHARS = 2_000;
export const MAX_ANSWER_CHARS = 8_000;

/** 校验反馈请求体；非法返回 null（调用方回 400）。导出便于单测。 */
export function parseFeedbackBody(value: unknown): FeedbackBody | null {
  if (typeof value !== "object" || value === null) return null;
  const body = value as Record<string, unknown>;
  if (body.rating !== "helpful" && body.rating !== "unhelpful") return null;
  if (typeof body.question !== "string" || typeof body.answer !== "string") return null;
  if (!body.question.trim() || !body.answer.trim()) return null;
  if (body.question.length > MAX_QUESTION_CHARS) return null;
  if (body.answer.length > MAX_ANSWER_CHARS) return null;
  return { rating: body.rating, question: body.question, answer: body.answer };
}

/** POST: 存 AI 回答反馈（登录用户署名，游客匿名） */
export async function POST(req: NextRequest) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const body = parseFeedbackBody(raw);
  if (!body) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from("ai_feedback").insert({
      user_id: user?.id ?? null, // 游客也可反馈（匿名）
      rating: body.rating,
      question: body.question,
      answer: body.answer,
    });

    if (error) {
      console.error("[ai/feedback] insert failed:", error.message);
      return NextResponse.json({ error: "Failed to save feedback" }, { status: 500 });
    }
  } catch (e) {
    console.error("[ai/feedback] unexpected failure:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Failed to save feedback" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
