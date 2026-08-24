import { NextRequest, NextResponse } from "next/server";
import { chat } from "@/lib/ai/client";
import { retrieve } from "@/lib/ai/rag";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "edge";

interface SummaryBody {
  chapter: string;
  title: string;
  locale?: string;
}

/** POST: 生成章节摘要（RAG 取该章内容 → AI 总结） */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    const body = (await req.json()) as SummaryBody;
    if (!body.chapter) {
      return NextResponse.json({ error: "Missing chapter" }, { status: 400 });
    }

    // RAG 用章节标题检索该章内容
    let ragContext = "";
    try {
      const results = await retrieve(body.title, body.locale || "zh", 6);
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

    const parsed = JSON.parse(raw);
    return NextResponse.json({ summary: parsed.summary || raw || "" });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "AI error" }, { status: 502 });
  }
}