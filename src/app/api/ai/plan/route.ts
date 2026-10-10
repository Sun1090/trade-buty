import { NextRequest, NextResponse } from "next/server";
import { chat } from "@/lib/ai/client";
import { getChapterTitle } from "@/lib/ai/chapters";
import { getServerAuthUser } from "@/lib/supabase/server";
import { parseJsonLoose } from "@/lib/ai/json-extract";
import { createRateLimiter } from "@/lib/ai/rate-limit";
import { SERVER_ERRORS } from "@/lib/ai/server-errors";
import { readJsonBody } from "@/lib/request-body";

// R7.12：学习计划会调用 LLM，按用户限流，避免单账号无限打端点烧预算。
const planLimiter = createRateLimiter({ guestLimit: 30, authedLimit: 30 });

export interface PlanBody {
  doneChapters: string[];
  currentChapter: string;
  wrongChapters: string[];
  /** 界面语言：决定篇章名取 zh 还是 en（与 /api/ai/chat 同一形状） */
  locale: "zh" | "en";
}

/** 拼进 prompt 的章节 slug 数量/长度上限，避免客户端塞任意长文本 */
const MAX_CHAPTERS = 64;
const MAX_CHAPTER_LEN = 64;
/** 兜底返回的模型原文上限（正常路径走 JSON 里的 plan 字段） */
const MAX_PLAN_CHARS = 600;

/**
 * 请求体字节上限：上面的字段上限要整包解析完才生效，读流阶段得单独设闸。
 * 字符上限按 CJK 的 UTF-8 上界 ×3 折算，再加 JSON 结构开销。
 */
export const MAX_PLAN_BODY_BYTES =
  (MAX_CHAPTERS * MAX_CHAPTER_LEN + MAX_PLAN_CHARS) * 3 + 1_024;

function parseChapterList(value: unknown): string[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;
  if (value.length > MAX_CHAPTERS) return null;
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") return null;
    const slug = item.trim();
    if (slug.length > MAX_CHAPTER_LEN) return null;
    if (slug) out.push(slug);
  }
  return out;
}

/** 校验学习计划请求体；非法返回 null（调用方回 400）。导出便于单测。 */
export function parsePlanBody(value: unknown): PlanBody | null {
  if (typeof value !== "object" || value === null) return null;
  const body = value as Record<string, unknown>;

  const doneChapters = parseChapterList(body.doneChapters);
  const wrongChapters = parseChapterList(body.wrongChapters);
  if (!doneChapters || !wrongChapters) return null;

  let currentChapter = "";
  if (body.currentChapter !== undefined) {
    if (typeof body.currentChapter !== "string") return null;
    const trimmed = body.currentChapter.trim();
    if (trimmed.length > MAX_CHAPTER_LEN) return null;
    currentChapter = trimmed;
  }

  // 与 /api/ai/chat 同一形状：只认两个真实 locale，缺省按 zh（界面默认语言）。
  const locale = body.locale === "en" ? "en" : "zh";

  return { doneChapters, currentChapter, wrongChapters, locale };
}

/**
 * 把章节 slug 换成本地化篇章名；查不到就退回 slug 本身。
 * 为什么必须换：`/api/ai/chat` 与 `/api/ai/quiz` 都先经 `getChapterTitle()` 再进 prompt，
 * 只有这里把英文 slug 直接拼进中文句子（「我当前学习的篇章：spot」）——
 * 同一条句子里混着 slug 与中文，而「slug → 篇章名」这件事在站内早有一个主人。
 * 为什么查不到不报错：客户端传来的 slug 来自 `getChapters()`（真篇章），
 * 但知识库改名会让某个 slug 暂时查不到；那种情况下退回 slug 仍然把信息送到了模型，
 * 比整条请求 400 更接近用户要的东西（与 `chat` 路由「未知章节静默忽略」不是一回事：
 * 那边的篇章只是参考上下文，这边是用户进度本身，不能丢）。
 */
function chapterNames(slugs: readonly string[], locale: string): string[] {
  return slugs.map((slug) => getChapterTitle(locale, slug) ?? slug);
}

function joinChapterNames(slugs: readonly string[], locale: string): string {
  const names = chapterNames(slugs, locale);
  return names.length > 0 ? names.join("、") : "无";
}

export async function POST(req: NextRequest) {
  try {
    let user;
    try {
      user = await getServerAuthUser();
    } catch {
      // R16.291：与「上游暂时不可用」分开——鉴权不可用不是暂时故障，措辞不许承诺「稍后」。
      // 详见 `src/lib/ai/server-errors.ts` 的文件头（这句话此前被同一个值盖住了两种成因）。
      return NextResponse.json({ error: SERVER_ERRORS.authUnavailable }, { status: 502 });
    }
    if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });

    const decision = planLimiter.check(user.id, true);
    if (!decision.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded", retryAfter: decision.retryAfterSec },
        { status: 429, headers: { "Retry-After": String(decision.retryAfterSec) } },
      );
    }

    const read = await readJsonBody(req, MAX_PLAN_BODY_BYTES);
    if (!read.ok) {
      if (read.reason === "too-large") {
        return NextResponse.json({ error: "Payload too large" }, { status: 413 });
      }
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const body = parsePlanBody(read.value);
    if (!body) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

    const done = joinChapterNames(body.doneChapters, body.locale);
    const wrong = joinChapterNames(body.wrongChapters, body.locale);
    // `currentChapter` 是单个 slug：换名之后为空仍要说「无」，与上面两处同一口径。
    const current = body.currentChapter
      ? (getChapterTitle(body.locale, body.currentChapter) ?? body.currentChapter)
      : "无";

    const raw = await chat({
      messages: [
        {
          role: "system",
          content: `你是 Trade Buty 的学习规划师，根据用户的学习进度生成个性化学习计划。

## 约束
1. 不荐股、不承诺收益
2. 基于用户已完成篇章和错题篇章给出建议
3. 用用户提问的语言回答

## 输出格式（严格 JSON）
{"plan": "3-5 句个性化学习建议，包括：已完成回顾、薄弱环节建议、下一步学习方向。不要列表，一段话。"}`,
        },
        {
          role: "user",
          content: `我已完成的篇章：${done}\n我错题所在的篇章：${wrong}\n我当前学习的篇章：${current}\n\n请给我学习建议。`,
        },
      ],
      temperature: 0.5,
      maxTokens: 500,
    });

    // 模型偶尔会带 ```json 围栏或前后说明文字；宽松解析失败时退回原文，
    // 而不是把「模型没按格式输出」变成一次 502。
    const parsed = parseJsonLoose<{ plan?: unknown }>(raw);
    const plan =
      parsed && typeof parsed.plan === "string" && parsed.plan.trim()
        ? parsed.plan.trim()
        : raw.trim().slice(0, MAX_PLAN_CHARS);
    if (!plan) {
      return NextResponse.json({ error: SERVER_ERRORS.upstreamUnavailable }, { status: 502 });
    }
    return NextResponse.json({ plan });
  } catch (e) {
    console.error("[ai/plan] generation failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: SERVER_ERRORS.upstreamUnavailable }, { status: 502 });
  }
}
