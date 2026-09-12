import { NextRequest, NextResponse } from "next/server";
import { chat } from "@/lib/ai/client";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseJsonLoose } from "@/lib/ai/json-extract";

export interface PlanBody {
  doneChapters: string[];
  currentChapter: string;
  wrongChapters: string[];
}

/** 拼进 prompt 的章节 slug 数量/长度上限，避免客户端塞任意长文本 */
const MAX_CHAPTERS = 64;
const MAX_CHAPTER_LEN = 64;
/** 兜底返回的模型原文上限（正常路径走 JSON 里的 plan 字段） */
const MAX_PLAN_CHARS = 600;

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

  return { doneChapters, currentChapter, wrongChapters };
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });

    let raw1: unknown;
    try {
      raw1 = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const body = parsePlanBody(raw1);
    if (!body) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

    const done = body.doneChapters.join("、") || "无";
    const wrong = body.wrongChapters.join("、") || "无";

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
          content: `我已完成的篇章：${done}\n我错题所在的篇章：${wrong}\n我当前学习的篇章：${body.currentChapter || "无"}\n\n请给我学习建议。`,
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
      return NextResponse.json({ error: "AI 服务暂时不可用，请稍后再试。" }, { status: 502 });
    }
    return NextResponse.json({ plan });
  } catch (e) {
    console.error("[ai/plan] generation failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "AI 服务暂时不可用，请稍后再试。" }, { status: 502 });
  }
}
