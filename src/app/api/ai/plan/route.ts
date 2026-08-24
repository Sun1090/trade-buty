import { NextRequest, NextResponse } from "next/server";
import { chat } from "@/lib/ai/client";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "edge";

interface PlanBody {
  doneChapters: string[];
  currentChapter: string;
  wrongChapters: string[];
  locale?: string;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });

    const body = (await req.json()) as PlanBody;
    const done = body.doneChapters?.join("、") || "无";
    const wrong = body.wrongChapters?.join("、") || "无";

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

    const parsed = JSON.parse(raw);
    return NextResponse.json({ plan: parsed.plan || "继续学习吧！" });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "AI error" }, { status: 502 });
  }
}