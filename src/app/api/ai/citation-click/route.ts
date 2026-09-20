import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, getServerAuthUser } from "@/lib/supabase/server";
import { clientIp, createRateLimiter } from "@/lib/ai/rate-limit";


// R7.12：与 /api/ai/feedback 同理——RLS 放行匿名插入，应用层必须自己设闸。
// 引用点击是高频轻操作，配额比反馈宽松，只挡脚本式灌量。
const WINDOW_MS = 60_000;
/** 每 IP 每分钟上限：真人读一篇文章点几十次引用已属极端 */
export const PER_MINUTE_LIMIT = 30;
const citationLimiter = createRateLimiter({
  guestLimit: PER_MINUTE_LIMIT,
  authedLimit: PER_MINUTE_LIMIT,
  windowMs: WINDOW_MS,
});

interface CitationClickBody {
  kind: "source" | "suggested";
  chapter: string;
  doc?: string;
  question?: string;
}

/** 纯校验：合法返回规范化后的字段，否则 null（导出便于单测） */
export function parseCitationClick(
  body: unknown
): Pick<CitationClickBody, "kind" | "chapter" | "doc" | "question"> | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;
  const kind = b.kind;
  if (kind !== "source" && kind !== "suggested") return null;
  const chapter = typeof b.chapter === "string" ? b.chapter.trim() : "";
  if (!chapter || chapter.length > 100) return null;
  const doc = typeof b.doc === "string" && b.doc.trim() ? b.doc.trim().slice(0, 200) : undefined;
  const question =
    typeof b.question === "string" && b.question.trim() ? b.question.trim().slice(0, 500) : undefined;
  return { kind, chapter, doc, question };
}

/** POST: 记录回答内课程引用点击（R1.13，匿名可上报） */
export async function POST(req: NextRequest) {
  const decision = citationLimiter.check(clientIp(req), false);
  if (!decision.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(decision.retryAfterSec) } },
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = parseCitationClick(raw);
  if (!parsed) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    let user;
    try {
      user = await getServerAuthUser();
    } catch {
      return NextResponse.json({ error: "Failed to record click" }, { status: 500 });
    }
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase.from("ai_citation_clicks").insert({
      user_id: user?.id ?? null,
      kind: parsed.kind,
      chapter: parsed.chapter,
      doc: parsed.doc ?? null,
      question: parsed.question ?? null,
    });

    if (error) {
      console.error("[ai/citation-click] insert failed:", error.message);
      return NextResponse.json({ error: "Failed to record click" }, { status: 500 });
    }
  } catch (e) {
    console.error(
      "[ai/citation-click] unexpected failure:",
      e instanceof Error ? e.message : e
    );
    return NextResponse.json({ error: "Failed to record click" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
