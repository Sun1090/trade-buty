import { NextRequest, NextResponse } from "next/server";
import { chat } from "@/lib/ai/client";
import { retrieve } from "@/lib/ai/rag";
import { buildRagContext, buildQuizPrompt } from "@/lib/ai/prompt";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { QUIZZES } from "@/lib/quizzes";

export const runtime = "edge";

interface GenerateBody {
  /** 错题的篇章+题号列表，用于取原题 + RAG */
  items: { chapterNum: string; questionIdx: number }[];
}

/**
 * POST: 根据用户错题生成 AI 变体题。
 * 1. 取错题对应的原题（question + explain）
 * 2. 用原题做 RAG 检索知识库
 * 3. AI 生成 3 道同主题变体题（JSON）
 */
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";

  // 登录用户才可用（消耗较大）
  if (!user) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }

  const body = (await req.json()) as GenerateBody;
  if (!body.items?.length) {
    return NextResponse.json({ error: "No items" }, { status: 400 });
  }

  // 取原题
  const wrongQuestions: { question: string; explain: string }[] = [];
  for (const item of body.items.slice(0, 5)) {
    const quiz = QUIZZES[item.chapterNum];
    const q = quiz?.questions[item.questionIdx];
    if (q) {
      wrongQuestions.push({ question: q.question, explain: q.explain });
    }
  }

  if (wrongQuestions.length === 0) {
    return NextResponse.json({ error: "No matching questions" }, { status: 400 });
  }

  // RAG：用第一道错题做检索
  let ragContext = "";
  try {
    const results = await retrieve(wrongQuestions[0].question, "zh", 3);
    if (results.length > 0) {
      ragContext = buildRagContext(results);
    }
  } catch {
    // RAG 失败不阻断
  }

  // AI 出题
  try {
    const raw = await chat({
      messages: buildQuizPrompt(wrongQuestions, ragContext),
      temperature: 0.7,
      maxTokens: 2000,
    });

    // 解析 JSON
    const parsed = JSON.parse(raw);
    if (!parsed.questions || !Array.isArray(parsed.questions)) {
      throw new Error("Invalid AI response");
    }

    // 校验每道题结构
    const valid = parsed.questions.filter(
      (q: { question?: string; options?: string[]; answer?: number; explain?: string }) =>
        q.question && q.options?.length === 4 && q.answer !== undefined && q.answer >= 0 && q.answer < 4 && q.explain,
    );

    if (valid.length === 0) {
      throw new Error("No valid questions generated");
    }

    return NextResponse.json({ questions: valid });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "AI quiz error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
