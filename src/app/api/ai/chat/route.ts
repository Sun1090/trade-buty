import { NextRequest, NextResponse } from "next/server";
import { streamChat } from "@/lib/ai/client";
import { retrieve } from "@/lib/ai/rag";
import { buildRagContext, SYSTEM_PROMPT } from "@/lib/ai/prompt";
import { enrichSourcesWithTitles, type SourceLink } from "@/lib/ai/sources";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "edge";

interface ChatBody {
  messages: { role: "user" | "assistant"; content: string }[];
  locale?: string;
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

  // RAG 检索
  let ragContext = "";
  let sources: SourceLink[] = [];
  try {
    const results = await retrieve(lastUserMsg.content, locale, 4);
    if (results.length > 0) {
      ragContext = buildRagContext(results);
      sources = enrichSourcesWithTitles(results, locale);
    }
  } catch (e) {
    // RAG 失败不阻断，退化为无上下文对话
    console.error("[ai/chat] RAG failed:", e instanceof Error ? e.message : e);
  }

  // 构造消息：system + rag context + 历史（保留最近 5 轮）+ 最新用户消息
  const recent = body.messages.slice(-10);
  const messages = [
    { role: "system" as const, content: SYSTEM_PROMPT + (ragContext ? "\n\n" + ragContext : "") },
    ...recent,
  ];

  // 相同问题缓存（去掉 RAG context 变体，只用用户问题 + locale）
  const cacheKey = `${locale}::${lastUserMsg.content.trim().toLowerCase()}`;
  const cached = answerCache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL) {
    const headers = new Headers();
    headers.set("Content-Type", "text/plain; charset=utf-8");
    headers.set("X-Cache", "HIT");
    if (sources.length > 0) headers.set("X-Sources", JSON.stringify(sources));
    return new Response(cached.text, { headers });
  }

  // 流式返回
  try {
    const rawStream = await streamChat({
      messages,
      temperature: 0.3,
      maxTokens: 1500,
    });

    // 包装流：传输同时累计文本，完成后写入缓存
    const encoder = new TextEncoder();
    let acc = "";
    const cachedStream = rawStream.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          acc += new TextDecoder().decode(chunk);
          controller.enqueue(chunk);
        },
        flush() {
          if (acc.trim()) {
            answerCache.set(cacheKey, { text: acc, at: Date.now() });
          }
        },
      }),
    );

    // 把 sources 放在 response header，前端读取后展示引用
    const headers = new Headers();
    headers.set("Content-Type", "text/event-stream");
    headers.set("Cache-Control", "no-cache");
    if (sources.length > 0) {
      headers.set("X-Sources", JSON.stringify(sources));
    }

    return new Response(cachedStream, { headers });
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "AI API error", {
      status: 502,
    });
  }
}
