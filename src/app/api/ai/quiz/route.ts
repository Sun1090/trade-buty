import { NextRequest, NextResponse } from "next/server";
import { chat } from "@/lib/ai/client";
import { retrieve } from "@/lib/ai/rag";
import { buildRagContext, buildQuizPrompt, buildChapterQuizPrompt } from "@/lib/ai/prompt";
import { getRetrievalProfile } from "@/lib/ai/retrieval-config";
import { validateAiQuestions, filterDuplicateQuestions } from "@/lib/ai/quiz-gen";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { QUIZZES } from "@/lib/quizzes";
import titlesData from "@/lib/kb-titles.json";

export const runtime = "edge";

type TitlesMap = Record<string, Record<string, { title?: string }>>;
const TITLES = titlesData as TitlesMap;

interface GenerateBody {
  /** 错题的篇章+题号列表，用于取原题 + RAG（变体模式） */
  items?: { chapterNum: string; questionIdx: number }[];
  /** R2.1 章节出题模式：直接按章节 slug 出新题 */
  chapter?: string;
  locale?: string;
  difficulty?: "basic" | "advanced";
}

// R2.10 成本控制：同章节+语言+难度的题目缓存 24h（edge 实例级）
const quizCache = new Map<string, { questions: unknown; at: number }>();
const QUIZ_CACHE_TTL = 24 * 60 * 60 * 1000;

/** 章节标题（去掉 "NN · " 前缀），未知章节返回 null */
export function getChapterTitle(locale: string, chapter: string): string | null {
  const entry = TITLES[locale]?.[chapter]?.title;
  if (!entry) return null;
  return entry.replace(/^\d+\s*·\s*/, "");
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

  // R2.1 章节出题模式：按章节 slug 基于知识库上下文出 5 道新题
  if (body.chapter) {
    return handleChapterQuiz(body, user.id);
  }

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
const profile = getRetrievalProfile('quiz');
    const results = await retrieve(wrongQuestions[0].question, "zh", profile.topK, profile.threshold);
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

/**
 * R2.1：章节出题。RAG 限定该章内容 → AI 生成 5 道题 → 与固定题库去重。
 * 失败降级（R2.5）：AI 出题失败时回退本章固定题（若有），绝不白屏。
 */
async function handleChapterQuiz(
  body: GenerateBody,
  userId: string,
): Promise<NextResponse> {
  const locale = body.locale === "en" ? "en" : "zh";
  const difficulty = body.difficulty === "advanced" ? "advanced" : "basic";
  const chapter = body.chapter as string;
  const chapterTitle = getChapterTitle(locale, chapter);
  if (!chapterTitle) {
    return NextResponse.json({ error: "Unknown chapter" }, { status: 400 });
  }

  // R2.10 缓存命中直接返回
  const cacheKey = `${chapter}::${locale}::${difficulty}`;
  const cached = quizCache.get(cacheKey);
  if (cached && Date.now() - cached.at < QUIZ_CACHE_TTL) {
    return NextResponse.json({ questions: cached.questions, source: "ai", cached: true });
  }

  const fixedQuiz = QUIZZES[chapter];
  const existingQuestions = fixedQuiz?.questions.map((q) => q.question) ?? [];

  try {
    // 章节出题的检索 query 用章节标题本身
    let ragContext = "";
    try {
      const profile = getRetrievalProfile("quiz");
      const query = locale === "en" ? `${chapterTitle} core concepts` : `${chapterTitle} 核心概念`;
      const results = await retrieve(query, locale, profile.topK, profile.threshold, chapter);
      if (results.length > 0) ragContext = buildRagContext(results);
    } catch {
      // RAG 失败不阻断，AI 在无上下文时会按约束拒绝编造
    }

    const raw = await chat({
      messages: buildChapterQuizPrompt(chapterTitle, ragContext, locale, difficulty),
      temperature: 0.7,
      maxTokens: 3000,
    });
    const valid = filterDuplicateQuestions(
      validateAiQuestions(JSON.parse(raw)),
      existingQuestions,
    );
    if (valid.length === 0) throw new Error("No valid questions generated");

    quizCache.set(cacheKey, { questions: valid, at: Date.now() });
    return NextResponse.json({ questions: valid, source: "ai" });
  } catch (e) {
    // R2.5 降级：有固定题回退固定题，否则报错由前端提示
    if (fixedQuiz) {
      return NextResponse.json({ questions: fixedQuiz.questions, source: "fallback" });
    }
    const msg = e instanceof Error ? e.message : "AI quiz error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
