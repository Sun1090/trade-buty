"use client";

import { useState } from "react";
import { applySrsResult } from "@/lib/wrongbook";
import { addStudyTime } from "@/lib/study-time";
import { isAiGloballyDisabled } from "@/lib/ai-toggle";
import { sendAiFeedback, type ReportStatus } from "@/lib/ai-feedback";

interface AiQuizProps {
  /** 用户错题列表（篇章+题号） */
  wrongItems: { chapterNum: string; questionIdx: number }[];
  dict: {
    generate: string; generating: string; error: string; question: string; explain: string;
    report: string; reported: string; reportFailed: string; badge: string; correct: string; wrong: string; next: string; done: string;
    /** 401 与 429 各自的说法：把「重试没用」和「等一会儿再有结果」混成一句就是假话 */
    loginRequired: string; rateLimited: string;
    /** 等待时长整句由字典出，包括单位：把 `min` 拼到中文界面里就是半句英文残话 */
    retryInTpl: string;
  };
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
export function AiQuiz({ wrongItems, dict, aiEnabled = true }: AiQuizProps & { aiEnabled?: boolean }) {
  const [questions, setQuestions] = useState<AiQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [reported, setReported] = useState<Record<number, ReportStatus>>({});

  // R3.9/R3.10：AI 关闭时隐藏入口
  if (aiEnabled === false || isAiGloballyDisabled()) return null;

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
      // 上游的 error 字段是英文状态串（`Login required` / `Rate limit exceeded` /
      // `No matching questions`），摆到界面上就是英文句子插在中文界面里；
      // 这里只按状态码选本站文案。
      if (res.status === 401) {
        setError(dict.loginRequired);
        return;
      }
      if (res.status === 429) {
        const retryAfter = Number.parseInt(res.headers.get("retry-after") ?? "", 10);
        const minutes = Number.isFinite(retryAfter) ? Math.ceil(retryAfter / 60) : 0;
        setError(
          minutes > 0
            ? `${dict.rateLimited} · ${dict.retryInTpl.replace("{n}", String(minutes))}`
            : dict.rateLimited
        );
        return;
      }
      if (!res.ok) {
        setError(dict.error);
        return;
      }
      const data = await res.json();
      setQuestions(data.questions);
    } catch {
      setError(dict.error);
    } finally {
      setLoading(false);
    }
  }

  /**
   * R2.6/R2.8/R5.5：变体题与错题本打通，走 SRS 状态机。
   * 变体题 i 对应来源错题 wrongItems[i % n]；答对推进间隔、答错重置（幂等）。
   * R5.8：每次复习应答计入每日目标（1 题记 1 分钟）。
   */
  function pick(i: number) {
    if (picked !== null) return;
    setPicked(i);
    const q = questions[current];
    const src = wrongItems[current % wrongItems.length];
    if (!q || !src) return;
    addStudyTime("quiz", 60);
    // 不传 `i`：那是**变体题**的选项序号，而变体题的选项是模型现写的，和来源题的选项
    // 不是一套（`ai/prompt.ts` 各写各的）。写进来源错题的 `picked`，复习页的「你的选择」
    // 就会指到一条用户从没见过的选项上——宁可留着来源题那次真正点过的序号。
    applySrsResult(src.chapterNum, src.questionIdx, i === q.answer);
  }

  /** R2.11：题目质量举报——送出成功才改口，失败要看得见、也要能再点一次 */
  async function report(idx: number) {
    if (reported[idx] === "sending" || reported[idx] === "sent") return;
    setReported((prev) => ({ ...prev, [idx]: "sending" }));
    const q = questions[idx];
    const sent = await sendAiFeedback({
      rating: "unhelpful",
      question: q?.question ?? "",
      answer: q?.explain ?? "",
    });
    setReported((prev) => ({ ...prev, [idx]: sent ? "sent" : "failed" }));
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
        {dict.badge} {current + 1}/{questions.length}
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
            <li key={i}>
              <button
                onClick={() => pick(i)}
                disabled={picked !== null}
                aria-label={`${String.fromCharCode(65 + i)}. ${opt}`}
                className={`w-full text-left rounded-xl border px-4 py-3 text-sm transition focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:cursor-default ${cls}`}
              >
                <span className="font-mono text-xs text-faint mr-2" aria-hidden>
                  {String.fromCharCode(65 + i)}
                </span>
                {opt}
              </button>
            </li>
          );
        })}
      </ul>
      {picked !== null && (
        <div className="mt-5 rounded-xl bg-black/20 dark:bg-white/5 p-4 text-sm space-y-3">
          <p className="font-semibold">
            {picked === q.answer ? `✅ ${dict.correct}` : `❌ ${dict.wrong}`}
          </p>
          <p className="text-muted leading-relaxed">{q.explain}</p>
          <div className="flex items-center gap-4">
            <button
              onClick={next}
              className="rounded-full bg-accent-strong hover:bg-accent text-white dark:text-[#06281c] font-semibold px-6 py-2 text-sm transition"
            >
              {current < questions.length - 1 ? dict.next : dict.done}
            </button>
            <button
              onClick={() => report(current)}
              className="text-xs text-faint hover:text-down transition disabled:opacity-50"
              disabled={reported[current] === "sending" || reported[current] === "sent"}
            >
              {reported[current] === "sent"
                ? dict.reported
                : reported[current] === "failed"
                  ? `⚠ ${dict.reportFailed}`
                  : `⚑ ${dict.report}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
