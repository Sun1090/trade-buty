import { NextRequest, NextResponse } from "next/server";
import { streamChat, chat } from "@/lib/ai/client";
import { retrieve } from "@/lib/ai/rag";
import { buildRagContext, SYSTEM_PROMPT } from "@/lib/ai/prompt";
import { buildHistorySummaryPrompt, buildNoContextGuidance } from "@/lib/ai/prompt";
import { getRefusalMessage } from "@/lib/ai/prompt";
import { getChapterTitle } from "@/lib/ai/chapters";
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
import { parseChatBody } from "@/lib/ai/chat-input";
import { BoundedMap, sweepExpired } from "@/lib/bounded-map";

// 简易内存 rate limit（Node.js 实例间相互独立，够用于防基础滥用）。
// 用 BoundedMap 而不是裸 Map：否则伪造 X-Forwarded-For 的攻击者可以每请求
// 塞一个新 key，把常驻实例的内存吃满。
const IP_HITS_MAX = 10_000;
const ipHits = new BoundedMap<string, { count: number; reset: number }>(IP_HITS_MAX);
const GUEST_LIMIT = 10; // 游客每小时 10 次
const AUTHED_LIMIT = 50; // 登录每小时 50 次

// 相同问题缓存（10 分钟 TTL，降低 AI API 消耗）；同样有容量上限，
// 避免不同问题无限堆积。
const ANSWER_CACHE_MAX = 500;
const answerCache = new BoundedMap<string, { text: string; at: number }>(ANSWER_CACHE_MAX);
const CACHE_TTL = 10 * 60 * 1000;

export async function POST(req: NextRequest) {
  // 鉴权（可选）与限流放在解析 body 之前：这样畸形/超大 payload 也计入配额，
  // 不会出现「先解析再限流」的绕过窗口。
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";

  // rate limit（配额随响应头返回：游客前端展示剩余次数，429 附 Retry-After）
  const limit = user ? AUTHED_LIMIT : GUEST_LIMIT;
  const now = Date.now();
  // 表变大时顺手清掉已过期窗口（按需触发，不做每请求全量扫描）
  sweepExpired(ipHits, (v) => v.reset <= now, 5_000);
  const hit = ipHits.get(ip);
  let quotaRemaining: number;
  if (hit && now < hit.reset) {
    if (hit.count >= limit) {
      const retrySec = Math.ceil((hit.reset - now) / 1000);
      return NextResponse.json(
        { error: "Rate limit exceeded", retryAfter: retrySec },
        { status: 429, headers: { "Retry-After": String(retrySec) } },
      );
    }
    hit.count++;
    ipHits.set(ip, hit);
    quotaRemaining = limit - hit.count;
  } else {
    ipHits.set(ip, { count: 1, reset: now + 3600_000 });
    quotaRemaining = limit - 1;
  }
  // 仅游客暴露配额头，登录用户不展示配额提示
  const withQuotaHeaders = (h: Headers) => {
    if (!user) {
      h.set("X-Quota-Limit", String(limit));
      h.set("X-Quota-Remaining", String(quotaRemaining));
    }
  };

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const body = parseChatBody(rawBody);
  if (!body) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const { messages: history, locale } = body;
  const lastUserMsg = [...history].reverse().find((m) => m.role === "user");
  if (!lastUserMsg) {
    return NextResponse.json({ error: "No user message" }, { status: 400 });
  }

  // 输入侧护栏（R1.8）：荐股/收益承诺直接拒绝，不调模型
  const guardHit = matchSensitiveRequest(lastUserMsg.content);
  if (guardHit) {
    const headers = new Headers();
    headers.set('Content-Type', 'text/plain; charset=utf-8');
    headers.set('X-Refused', guardHit);
    withQuotaHeaders(headers);
    return new Response(getRefusalMessage(guardHit, locale), { headers, status: 200 });
  }
  const isContinue = Boolean(body.continueFrom);

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
  const recent = history.slice(-HISTORY_KEEP);
  if (!isContinue && history.length > HISTORY_SUMMARIZE_AT) {
    try {
      const overflow = history.slice(0, -HISTORY_KEEP);
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
  // R3.7：课程落地上下文（未知识别章节则忽略，不报错）
  const ctxTitle = body.contextChapter ? getChapterTitle(locale, body.contextChapter) : null;
  const ctxLine = ctxTitle
    ? (locale === "en"
      ? `\n\n## User context\nThe user is currently studying the chapter "${ctxTitle}". Prefer explanations grounded in this chapter's content.`
      : `\n\n## 用户上下文\n用户正在学习《${ctxTitle}》篇章，请优先结合该篇章内容进行解释。`)
    : "";
  const llmMessages = [
    {
      role: "system" as const,
      content:
        SYSTEM_PROMPT +
        ctxLine +
        (ragContext ? "\n\n" + ragContext : "") +
        (noContextGuidance ? "\n\n" + noContextGuidance : "") +
        (historySummary ? "\n\n## 早期对话摘要\n" + historySummary : ""),
    },
    ...recent,
    ...(isContinue ? [{ role: "user" as const, content: continuePrompt }] : []),
  ];

  // 相同问题缓存（去掉 RAG context 变体，只用用户问题 + locale；续写不读不写）
  const cacheKey = `${locale}::${lastUserMsg.content.trim().toLowerCase()}`;
  sweepExpired(answerCache, (v) => Date.now() - v.at >= CACHE_TTL, 250);
  const cached = !isContinue ? answerCache.get(cacheKey) : undefined;
  if (cached && Date.now() - cached.at < CACHE_TTL) {
    const headers = new Headers();
    headers.set("Content-Type", "text/plain; charset=utf-8");
    headers.set("X-Cache", "HIT");
    if (sources.length > 0) headers.set("X-Sources", encodeURIComponent(JSON.stringify(sources)));
    if (suggested.length > 0) headers.set("X-Suggested", encodeURIComponent(JSON.stringify(suggested)));
    withQuotaHeaders(headers);
    return new Response(cached.text, { headers });
  }

  // 流式返回
  try {
    let finishReason: string | null = null;
    const rawStream = await streamChat({
      messages: llmMessages,
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
    withQuotaHeaders(headers);

    return new Response(markedStream, { headers });
  } catch (e) {
    // 不回传上游错误细节（可能含上游 URL/状态/内部标识），只留服务端日志
    console.error("[ai/chat] generation failed:", e instanceof Error ? e.message : e);
    return new Response("AI 服务暂时不可用，请稍后再试。", {
      status: 502,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
