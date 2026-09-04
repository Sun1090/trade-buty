import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "edge";

export interface ExportQuery {
  rating?: "helpful" | "unhelpful";
  limit: number;
  since?: string;
}

/** 解析导出查询参数，非法值回退安全默认 */
export function parseExportQuery(searchParams: URLSearchParams): ExportQuery {
  const ratingRaw = searchParams.get("rating");
  const limitRaw = Number(searchParams.get("limit") ?? "");
  const sinceRaw = searchParams.get("since") ?? undefined;
  return {
    rating: ratingRaw === "helpful" || ratingRaw === "unhelpful" ? ratingRaw : undefined,
    limit:
      Number.isFinite(limitRaw) && (limitRaw as number) > 0
        ? Math.min(Math.floor(limitRaw as number), 500)
        : 100,
    since: sinceRaw && !Number.isNaN(Date.parse(sinceRaw)) ? sinceRaw : undefined,
  };
}

function isAuthorized(req: NextRequest): boolean {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return false;
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${token}`;
}

/** GET: 导出 AI 反馈供人工抽查（需 ADMIN_TOKEN） */
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const q = parseExportQuery(new URL(req.url).searchParams);
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("ai_feedback")
    .select("id, rating, question, answer, user_id, created_at")
    .order("created_at", { ascending: false })
    .limit(q.limit);
  if (q.rating) query = query.eq("rating", q.rating);
  if (q.since) query = query.gte("created_at", q.since);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ count: data?.length ?? 0, items: data ?? [] });
}
