import { NextRequest, NextResponse } from "next/server";
import { streamChat, chat } from "@/lib/ai/client";
import { retrieve } from "@/lib/ai/rag";
import { buildRagContext, SYSTEM_PROMPT } from "@/lib/ai/prompt";
import { buildHistorySummaryPrompt, buildNoContextGuidance } from "@/lib/ai/prompt";
import { getRefusalMessage } from "@/lib/ai/prompt";
import { matchSensitiveRequest } from "@/lib/ai/guardrail";
import { looksLikeRecommendation } from "@/lib/ai/guardrail";
import { getRetrievalProfile } from "@/lib/ai/retrieval-config";
import { TRUNCATED_MARKER } from "@/lib/ai/streaming";
import {
  enrichSourcesWithTitles,
  suggestChaptersFromResults,
  type ChapterSuggestion,
  type SourceLink,
} from "@/lib/ai/sources";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "edge";

interface ChatBody {
  messages: { role: "user" | "assistant"; content: string }[];
  locale?: string;
  /** 续写：已有回答全文，服务端在其后继续生成（不再重复 RAG） */
  continueFrom?: string;
}

// 简易内存 rate limit（edge runtime 每实例独立，够用于防基础滥用）
const ipHits = new Map<string, { count: number; reset: number }>();
const GUEST_LIMIT = 10; // 游客每小时 10 次
const AUTHED_LIMIT = 50; // 登录每小时 50 次

// 相同问题缓存（10 分钟 TTL，降低 AI API 消耗）
const answerCache = new Map<string, { text: string; at: number }>();
const CACHE_TTL = 10 * 60 * 1000;

export async function POST(req: NextRequest) {
  const body = (await req.json()) as ChatBody;
  const lastUserMsg = [...body.messages].reverse().find((m) => m.role === "user");
  if (!lastUserMsg) {
    return NextResponse.json({ error: "No user message" }, { status: 400 });
  }

  // 鉴权（可选）
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";

  // rate limit
  const limit = user ? AUTHED_LIMIT : GUEST_LIMIT;
  const now = Date.now();
  const hit = ipHits.get(ip);
  if (hit && now < hit.reset) {
    if (hit.count >= limit) {
      return NextResponse.json(
        { error: "Rate limit exceeded", retryAfter: Math.ceil((hit.reset - now) / 1000) },
        { status: 429 },
      );
    }
    hit.count++;
  } else {
    ipHits.set(ip, { count: 1, reset: now + 3600_000 });
  }

  const locale = body.locale || "zh";

  // 输入侧护栏（R1.8）：荐股/收益承诺直接拒绝，不调模型
  const guardHit = matchSensitiveRequest(lastUserMsg.content);
  if (guardHit) {
    const headers = new Headers();
    headers.set('Content-Type', 'text/plain; charset=utf-8');
    headers.set('X-Refused', guardHit);
    return new Response(getRefusalMessage(guardHit, locale), { headers, status: 200 });
  }
  const isContinue =
    typeof body.continueFrom === "string" && body.continueFrom.trim().length > 0;

  // RAG 检索（配置中心统一 topK/阈值；续写不再重复检索）
  const profile = getRetrievalProfile('chat');
  let ragContext = "";
  let sources: SourceLink[] = [];
  let suggested: ChapterSuggestion[] = [];
  let noContextGuidance = "";
  try {
    if (!isContinue) {
      const results = await retrieve(lastUserMsg.content, locale, profile.topK, profile.threshold);
      if (results.length > 0) {
        ragContext = buildRagContext(results);
        sources = enrichSourcesWithTitles(results, locale);
      } else if (profile.relaxedTopK > 0) {
        // 兜底：放宽阈值二次检索，只取章节做推荐
        const relaxed = await retrieve(lastUserMsg.content, locale, profile.relaxedTopK, 0);
        suggested = suggestChaptersFromResults(relaxed, locale);
        noContextGuidance = buildNoContextGuidance(suggested);
      }
    }
  } catch (e) {
    // RAG 失败不阻断，退化为无上下文对话
    console.error("[ai/chat] RAG failed:", e instanceof Error ? e.message : e);
  }

  // 构造消息：system + rag context + 历史摘要 + 历史（保留最近 5 轮）+ 最新用户消息
  // 续写：在已有回答后追加“请继续”，不重复 RAG、不走缓存
  // 超长历史（>14 条）时把早期轮次压缩成摘要，避免上下文丢失
  const HISTORY_KEEP = 10;
  const HISTORY_SUMMARIZE_AT = 14;
  let historySummary = "";
  const recent = body.messages.slice(-HISTORY_KEEP);
  if (!isContinue && body.messages.length > HISTORY_SUMMARIZE_AT) {
    try {
      const overflow = body.messages.slice(0, -HISTORY_KEEP);
      historySummary = await chat({
        messages: buildHistorySummaryPrompt(overflow, locale),
        temperature: 0.2,
        maxTokens: 300,
      });
    } catch (e) {
      // 摘要失败不阻断，直接截断
      console.error("[ai/chat] history summary failed:", e instanceof Error ? e.message : e);
    }
  }
  const continuePrompt = locale === "en" ? "Continue." : "请继续。";
  const messages = [
    {
      role: "system" as const,
      content:
        SYSTEM_PROMPT +
        (ragContext ? "\n\n" + ragContext : "") +
        (noContextGuidance ? "\n\n" + noContextGuidance : "") +
        (historySummary ? "\n\n## 早期对话摘要\n" + historySummary : ""),
    },
    ...recent,
    ...(isContinue ? [{ role: "user" as const, content: continuePrompt }] : []),
  ];

  // 相同问题缓存（去掉 RAG context 变体，只用用户问题 + locale；续写不读不写）
  const cacheKey = `${locale}::${lastUserMsg.content.trim().toLowerCase()}`;
  const cached = !isContinue ? answerCache.get(cacheKey) : undefined;
  if (cached && Date.now() - cached.at < CACHE_TTL) {
    const headers = new Headers();
    headers.set("Content-Type", "text/plain; charset=utf-8");
    headers.set("X-Cache", "HIT");
    if (sources.length > 0) headers.set("X-Sources", encodeURIComponent(JSON.stringify(sources)));
    if (suggested.length > 0) headers.set("X-Suggested", encodeURIComponent(JSON.stringify(suggested)));
    return new Response(cached.text, { headers });
  }

  // 流式返回
  try {
    let finishReason: string | null = null;
    const rawStream = await streamChat({
      messages,
      temperature: 0.3,
      maxTokens: 1500,
      onFinish: (r) => {
        finishReason = r;
      },
    });

    // 包装流：传输同时累计文本，完成后写入缓存（续写不写缓存，避免污染原问题缓存）
    const encoder = new TextEncoder();
    let acc = "";
    const cachedStream = rawStream.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          acc += new TextDecoder().decode(chunk);
          controller.enqueue(chunk);
        },
        flush() {
          if (acc.trim() && !isContinue) {
            answerCache.set(cacheKey, { text: acc, at: Date.now() });
          }
          if (looksLikeRecommendation(acc)) {
            console.warn('[ai/guardrail] 输出疑似荐股，人工抽查', acc.slice(0, 160));
          }
        },
      }),
    );

    // 截断标记：finish_reason=length 时追加（Markdown 不可见），前端据此展示“继续生成”
    const markedStream = cachedStream.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        flush(controller) {
          if (finishReason === "length") {
            controller.enqueue(encoder.encode(TRUNCATED_MARKER));
          }
        },
      }),
    );

    // 把 sources 放在 response header，前端读取后展示引用
    const headers = new Headers();
    headers.set("Content-Type", "text/event-stream");
    headers.set("Cache-Control", "no-cache");
    if (sources.length > 0) {
      headers.set("X-Sources", encodeURIComponent(JSON.stringify(sources)));
    }
    if (suggested.length > 0) {
      headers.set("X-Suggested", encodeURIComponent(JSON.stringify(suggested)));
    }

    return new Response(markedStream, { headers });
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "AI API error", {
      status: 502,
    });
  }
}
