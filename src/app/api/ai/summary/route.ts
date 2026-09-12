import { NextRequest, NextResponse } from "next/server";
import { chat } from "@/lib/ai/client";
import { retrieve } from "@/lib/ai/rag";
import { getRetrievalProfile } from "@/lib/ai/retrieval-config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseJsonLoose } from "@/lib/ai/json-extract";
import { clientIp, createRateLimiter } from "@/lib/ai/rate-limit";

// R7.12：章节导语会调用 LLM，游客/登录分档限流。
const summaryLimiter = createRateLimiter({ guestLimit: 20, authedLimit: 60 });

export interface SummaryBody {
  chapter: string;
  title: string;
  locale: "zh" | "en";
}

const MAX_SLUG_CHARS = 64;
const MAX_TITLE_CHARS = 200;
/** 兜底返回的模型原文上限 */
const MAX_SUMMARY_CHARS = 800;

/** 校验章节导语请求体；非法返回 null（调用方回 400）。导出便于单测。 */
export function parseSummaryBody(value: unknown): SummaryBody | null {
  if (typeof value !== "object" || value === null) return null;
  const body = value as Record<string, unknown>;
  if (typeof body.chapter !== "string") return null;
  const chapter = body.chapter.trim();
  if (!chapter || chapter.length > MAX_SLUG_CHARS) return null;

  let title = chapter;
  if (body.title !== undefined) {
    if (typeof body.title !== "string") return null;
    const trimmed = body.title.trim();
    if (trimmed.length > MAX_TITLE_CHARS) return null;
    if (trimmed) title = trimmed;
  }

  return { chapter, title, locale: body.locale === "en" ? "en" : "zh" };
}

/** POST: 生成章节摘要（RAG 取该章内容 → AI 总结） */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    const decision = summaryLimiter.check(user?.id ?? clientIp(req), !!user);
    if (!decision.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded", retryAfter: decision.retryAfterSec },
        { status: 429, headers: { "Retry-After": String(decision.retryAfterSec) } },
      );
    }

    let raw1: unknown;
    try {
      raw1 = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const body = parseSummaryBody(raw1);
    if (!body) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    // RAG 用章节标题检索该章内容
    let ragContext = "";
    try {
      const profile = getRetrievalProfile("summary");
      // 摘要只应检索本章内容，避免把别章内容混进导语
      const results = await retrieve(body.title, body.locale, profile.topK, profile.threshold, body.chapter);
      if (results.length > 0) {
        ragContext = results
          .map((r) => `[${r.chapter}/${r.doc}] ${r.chunk}`)
          .join("\n\n---\n\n");
      }
    } catch {
      // RAG 失败不阻断
    }

    const raw = await chat({
      messages: [
        {
          role: "system",
          content: `你是 Trade Buty 的内容导览专家。为《${body.title}》生成一段 2-3 句的章节导语。

## 要求
1. 概括本章核心主题
2. 指出学完能获得什么
3. 用 ${body.locale === "en" ? "English" : "中文"} 回答
4. 一句话，不列点

## 检索到的内容
${ragContext || "（无检索内容）"}`,
        },
        { role: "user", content: `请为《${body.title}》生成导语。` },
      ],
      temperature: 0.4,
      maxTokens: 300,
    });

    // 围栏/多余说明文字都不再导致 502；解析失败时退回模型原文
    const parsed = parseJsonLoose<{ summary?: unknown }>(raw);
    const summary =
      parsed && typeof parsed.summary === "string" && parsed.summary.trim()
        ? parsed.summary.trim()
        : raw.trim().slice(0, MAX_SUMMARY_CHARS);
    return NextResponse.json({ summary });
  } catch (e) {
    console.error("[ai/summary] generation failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "AI 服务暂时不可用，请稍后再试。" }, { status: 502 });
  }
}
