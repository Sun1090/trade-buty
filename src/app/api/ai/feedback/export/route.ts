import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";


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
  // 定长比较：这是全库读端点唯一的鉴权，不能用 `===` 的短路语义把逐字节前缀泄露出去
  const expected = Buffer.from(`Bearer ${token}`);
  const got = Buffer.from(header);
  return got.length === expected.length && timingSafeEqual(got, expected);
}

/** GET: 导出 AI 反馈供人工抽查（需 ADMIN_TOKEN） */
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "export unavailable" }, { status: 503 });
  }
  const q = parseExportQuery(new URL(req.url).searchParams);

  try {
    // 必须走 service_role：`ai_feedback` 的策略是 `using (auth.uid() = user_id)`，
    // 而这个端点只带 ADMIN_TOKEN、没有 Supabase cookie，`auth.uid()` 恒为 NULL，
    // 用 anon 服务端客户端查询会「成功但零行」——R1.7 的人工抽查（红线：荐股 /
    // 收益承诺只能靠人复查逮）因此从未真正可用。npm run db:test 的
    // 「anon 读不到任何 ai_feedback」断言就是这条事实的钉。
    const supabase = createSupabaseAdminClient();

    let query = supabase
      .from("ai_feedback")
      .select("id, rating, question, answer, user_id, created_at")
      .order("created_at", { ascending: false })
      .limit(q.limit);
    if (q.rating) query = query.eq("rating", q.rating);
    if (q.since) query = query.gte("created_at", q.since);

    const { data, error } = await query;
    if (error) {
      console.error("[ai/feedback/export] select failed:", error.message);
      return NextResponse.json({ error: "Failed to export feedback" }, { status: 500 });
    }
    return NextResponse.json({ count: data?.length ?? 0, items: data ?? [] });
  } catch (e) {
    console.error(
      "[ai/feedback/export] unexpected failure:",
      e instanceof Error ? e.message : e
    );
    return NextResponse.json({ error: "Failed to export feedback" }, { status: 500 });
  }
}
