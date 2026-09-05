import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "edge";

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

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase.from("ai_citation_clicks").insert({
    user_id: user?.id ?? null,
    kind: parsed.kind,
    chapter: parsed.chapter,
    doc: parsed.doc ?? null,
    question: parsed.question ?? null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
