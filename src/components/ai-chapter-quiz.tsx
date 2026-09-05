"use client";

import { useState } from "react";

interface AiQuizQuestion {
  question: string;
  options: string[];
  answer: number;
  explain: string;
}

interface AiChapterQuizDict {
  start: string;
  generating: string;
  badge: string;
  loginRequired: string;
  error: string;
  fallback: string;
  correct: string;
  wrong: string;
  next: string;
  done: string;
  disclaimer: string;
  basic: string;
  advanced: string;
  report: string;
  reported: string;
}

/**
 * R2.1/R2.7：AI 章节出题卡片——供无固定题库的章节在课末展示。
 * 登录后可用；AI 失败且无固定题时给文案，不白屏（R2.5 前端侧）。
 */
export function AiChapterQuizCard({
  chapter,
  locale,
  dict,
}: {
  chapter: string;
  locale: string;
  dict: AiChapterQuizDict;
}) {
  const [questions, setQuestions] = useState<AiQuizQuestion[] | null>(null);
  const [source, setSource] = useState<"ai" | "fallback" | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [difficulty, setDifficulty] = useState<"basic" | "advanced">("basic");
  const [reported, setReported] = useState<Record<number, boolean>>({});

  async function generate() {
    setLoading(true);
    setError(null);
    setQuestions(null);
    setCurrent(0);
    setPicked(null);
    try {
      const res = await fetch("/api/ai/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapter, locale, difficulty }),
      });
      if (res.status === 401) {
        setError(dict.loginRequired);
        return;
      }
      if (!res.ok) {
        throw new Error(dict.error);
      }
      const data = await res.json();
      setQuestions(data.questions);
      setSource(data.source ?? "ai");
    } catch {
      setError(dict.error);
    } finally {
      setLoading(false);
    }
  }

  /** R2.11：题目质量举报（fire-and-forget） */
  function report(idx: number) {
    if (reported[idx]) return;
    setReported((prev) => ({ ...prev, [idx]: true }));
    const q = questions?.[idx];
    void fetch("/api/ai/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating: "unhelpful", question: q?.question ?? "", answer: q?.explain ?? "" }),
    }).catch(() => {});
  }

  // 入口态
  if (!questions) {
    return (
      <section className="rounded-2xl border border-[var(--accent)]/30 border-l-4 border-l-[var(--accent)] bg-gradient-to-br from-[var(--accent-dim)] to-transparent p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-semibold">
              <span aria-hidden>📝 </span>
              {dict.start}
              <span className="ml-2 rounded-full border border-[var(--accent)]/40 px-2 py-0.5 text-[10px] font-mono text-accent align-middle">
                🤖 {dict.badge}
              </span>
            </p>
          </div>
          <button
            onClick={generate}
            disabled={loading}
            className="rounded-full bg-accent-strong hover:bg-accent text-white dark:text-[#06281c] font-semibold px-6 py-2.5 transition shrink-0 disabled:opacity-50"
          >
            {loading ? "…" : dict.start}
          </button>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs text-faint">难度</span>
          {(["basic", "advanced"] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDifficulty(d)}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                difficulty === d
                  ? "border-accent bg-[var(--accent-dim)] text-accent"
                  : "border-[var(--border)] text-muted hover:border-accent/50"
              }`}
            >
              {d === "basic" ? dict.basic : dict.advanced}
            </button>
          ))}
        </div>
        {loading && <p className="mt-3 text-xs text-muted animate-pulse">{dict.generating}</p>}
        {error && <p className="mt-3 text-xs text-down">{error}</p>}
      </section>
    );
  }

  const q = questions[current];
  return (
    <section className="rounded-2xl border border-[var(--accent)]/30 border-l-4 border-l-[var(--accent)] bg-gradient-to-br from-[var(--accent-dim)] to-transparent p-6">
      <p className="text-xs font-mono text-faint mb-2">
        🤖 {dict.badge} · {current + 1}/{questions.length}
        {source === "fallback" && <span className="ml-2 text-faint">({dict.fallback})</span>}
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
              onClick={() => picked === null && setPicked(i)}
              className={`rounded-xl border px-4 py-3 text-sm transition ${cls}`}
            >
              <span className="font-mono text-xs text-faint mr-2">{String.fromCharCode(65 + i)}</span>
              {opt}
            </li>
          );
        })}
      </ul>
      {picked !== null && (
        <div className="mt-5 rounded-xl bg-black/20 dark:bg-white/5 p-4 text-sm space-y-3">
          <p className="font-semibold">{picked === q.answer ? `✅ ${dict.correct}` : `❌ ${dict.wrong}`}</p>
          <p className="text-muted leading-relaxed">{q.explain}</p>
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                if (current < questions.length - 1) {
                  setCurrent((c) => c + 1);
                  setPicked(null);
                } else {
                  setQuestions(null);
                  setSource(null);
                  setCurrent(0);
                  setPicked(null);
                }
              }}
              className="rounded-full bg-accent-strong hover:bg-accent text-white dark:text-[#06281c] font-semibold px-6 py-2 text-sm transition"
            >
              {current < questions.length - 1 ? dict.next : dict.done}
            </button>
            <button
              onClick={() => report(current)}
              className="text-xs text-faint hover:text-down transition disabled:opacity-50"
              disabled={reported[current]}
            >
              {reported[current] ? dict.reported : `⚑ ${dict.report}`}
            </button>
          </div>
        </div>
      )}
      <p className="mt-4 text-[10px] text-faint">{dict.disclaimer}</p>
    </section>
  );
}
