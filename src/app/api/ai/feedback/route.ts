import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, getServerAuthUser } from "@/lib/supabase/server";
import { clientIp, createRateLimiter } from "@/lib/ai/rate-limit";
import { readJsonBody } from "@/lib/request-body";

export interface FeedbackBody {
  rating: "helpful" | "unhelpful";
  question: string;
  answer: string;
}

/** 反馈文本长度上限：匿名也能写库，必须有界，避免单请求塞入任意大内容 */
export const MAX_QUESTION_CHARS = 2_000;
export const MAX_ANSWER_CHARS = 8_000;
/**
 * 请求体字节上限：字段上限只在**解析之后**才生效，缓冲本身还得单独设闸。
 * 两个字段各自的字符上限按 CJK 的 UTF-8 上界 ×3 折算，再加 1 KB JSON 结构开销。
 */
export const MAX_FEEDBACK_BODY_BYTES =
  (MAX_QUESTION_CHARS + MAX_ANSWER_CHARS) * 3 + 1_024;

// R7.12：端点是「匿名可写库」的——RLS 放行 `user_id is null` 的插入，
// 因此应用层是唯一的闸门。没有配额时，伪造请求即可无上限往 ai_feedback
// 堆行（单条约 10KB），既是存储成本也是导出/巡检噪声。
// 与 /api/error-reports 同一套进程内限流：只做基础滥用防护，不追求分布式精确。
const WINDOW_MS = 60_000;
/** 每 IP 每分钟上限：真人反馈最多几次，20 次足够宽松 */
export const PER_MINUTE_LIMIT = 20;
const feedbackLimiter = createRateLimiter({
  guestLimit: PER_MINUTE_LIMIT,
  authedLimit: PER_MINUTE_LIMIT,
  windowMs: WINDOW_MS,
});

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
  // 先定身份再限流：配额按账号分桶，游客才退回 IP。
  // 都按 IP 分桶时，同一 NAT/校园网出口的多个账号共用一桶，一个人的脚本会把整栋楼
  // 的真人反馈一起 429 掉（与 /api/ai/chat 上同一个坑，见 0e752af）。
  let user: { id: string } | null = null;
  try {
    user = await getServerAuthUser();
  } catch (e) {
    // 身份不可确定 ≠ 写入该失败：RLS 允许 user_id is null 的匿名行，而调用方是
    // fire-and-forget，回 500 就等于把一次真人反馈凭空丢掉。
    console.warn(
      "[ai/feedback] 身份解析失败，按匿名反馈入库：",
      e instanceof Error ? e.message : e,
    );
  }
  const decision = feedbackLimiter.check(user?.id ?? clientIp(req), !!user);
  if (!decision.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(decision.retryAfterSec) } },
    );
  }

  const parsed = await readJsonBody(req, MAX_FEEDBACK_BODY_BYTES);
  if (!parsed.ok) {
    if (parsed.reason === "too-large") {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const body = parseFeedbackBody(parsed.value);
  if (!body) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    const supabase = await createSupabaseServerClient();

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
