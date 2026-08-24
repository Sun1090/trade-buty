"use client";

import { useState } from "react";
import type { ChapterQuiz } from "@/lib/quiz-types";

interface AiQuizProps {
  /** 用户错题列表（篇章+题号） */
  wrongItems: { chapterNum: string; questionIdx: number }[];
  quizzes: ChapterQuiz[];
  dict: { generate: string; generating: string; error: string; question: string; explain: string };
}

interface AiQuestion {
  question: string;
  options: string[];
  answer: number;
  explain: string;
}

/**
 * AI 自适应出题组件：根据错题调用 AI 生成变体题，就地答题+解析。
 */
export function AiQuiz({ wrongItems, quizzes, dict }: AiQuizProps) {
  const [questions, setQuestions] = useState<AiQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);

  async function generate() {
    if (wrongItems.length === 0) return;
    setLoading(true);
    setError(null);
    setQuestions([]);
    setCurrent(0);
    setPicked(null);

    try {
      const res = await fetch("/api/ai/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: wrongItems }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || dict.error);
      }
      const data = await res.json();
      setQuestions(data.questions);
    } catch (e) {
      setError(e instanceof Error ? e.message : dict.error);
    } finally {
      setLoading(false);
    }
  }

  function pick(i: number) {
    if (picked !== null) return;
    setPicked(i);
  }

  function next() {
    if (current < questions.length - 1) {
      setCurrent((c) => c + 1);
      setPicked(null);
    } else {
      // 全部答完
      setQuestions([]);
      setCurrent(0);
      setPicked(null);
    }
  }

  if (questions.length === 0) {
    return (
      <button
        onClick={generate}
        disabled={loading || wrongItems.length === 0}
        className="w-full rounded-xl border border-[var(--accent)]/40 bg-[var(--accent-dim)] hover:border-accent/60 transition p-4 text-left disabled:opacity-50"
      >
        <span className="flex items-center gap-2">
          <span className="text-lg" aria-hidden>🤖</span>
          <span className="text-sm font-medium text-accent">
            {loading ? dict.generating : dict.generate}
          </span>
        </span>
        {error && <p className="mt-2 text-xs text-down">{error}</p>}
      </button>
    );
  }

  const q = questions[current];
  return (
    <div className="rounded-2xl border border-[var(--accent)]/30 border-l-4 border-l-[var(--accent)] bg-gradient-to-br from-[var(--accent-dim)] to-transparent p-6">
      <p className="text-xs font-mono text-faint mb-2">
        AI 变体题 {current + 1}/{questions.length}
      </p>
      <p className="font-medium leading-relaxed">{q.question}</p>
      <ul className="mt-5 space-y-2.5">
        {q.options.map((opt, i) => {
          let cls = "border-[var(--border)] hover:border-[var(--accent)]/50 cursor-pointer";
          if (picked !== null) {
            if (i === q.answer) cls = "border-accent bg-[var(--accent-dim)]";
            else if (i === picked) cls = "border-down/60 bg-down/10";
            else cls = "border-[var(--border)] opacity-50";
          }
          return (
            <li
              key={i}
              onClick={() => pick(i)}
              className={`rounded-xl border px-4 py-3 text-sm transition ${cls} ${picked === null ? "cursor-pointer" : ""}`}
            >
              <span className="font-mono text-xs text-faint mr-2">
                {String.fromCharCode(65 + i)}
              </span>
              {opt}
            </li>
          );
        })}
      </ul>
      {picked !== null && (
        <div className="mt-5 rounded-xl bg-black/20 dark:bg-white/5 p-4 text-sm space-y-3">
          <p className="font-semibold">
            {picked === q.answer ? "✅ 正确" : "❌ 错误"}
          </p>
          <p className="text-muted leading-relaxed">{q.explain}</p>
          <button
            onClick={next}
            className="rounded-full bg-accent-strong hover:bg-accent text-white dark:text-[#06281c] font-semibold px-6 py-2 text-sm transition"
          >
            {current < questions.length - 1 ? "下一题 →" : "完成"}
          </button>
        </div>
      )}
    </div>
  );
}
