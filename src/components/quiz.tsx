"use client";

import { useEffect, useRef, useState } from "react";
import type { ChapterQuiz } from "@/lib/quiz-types";
import { recordWrong, resolveWrong } from "@/lib/wrongbook";
import { readQuizProgress, saveQuizProgress, type QuizProgress } from "@/lib/quiz-store";
import { QuizTimer } from "@/components/quiz-timer";

interface QuizDict {
  questionsUnit: string;
  bestTpl: string;
  start: string;
  retry: string;
  progressTpl: string;
  correct: string;
  wrong: string;
  nextQ: string;
  finish: string;
  perfect: string;
}

const tpl = (s: string, vars: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k]));

export function Quiz({ quiz, dict }: { quiz: ChapterQuiz; dict: QuizDict }) {
  const [started, setStarted] = useState(false);
  const [current, setCurrent] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const [progress, setProgress] = useState<QuizProgress | null>(null);
  const explainRef = useRef<HTMLDivElement>(null);

  // 答题后自动滚到解析区（小屏体验）
  useEffect(() => {
    if (picked !== null) {
      explainRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [picked]);

  // 键盘快捷：1-4/A-D 选答案，Enter 下一题
  useEffect(() => {
    if (!started) return;
    function onKey(e: KeyboardEvent) {
      const q = quiz.questions[current];
      if (picked === null) {
        // 选答案：1-4 或 A-D
        const idx = "1234".indexOf(e.key);
        const idxAlpha = "abcdABCD".indexOf(e.key.toUpperCase() !== e.key ? e.key : e.key.toUpperCase());
        const map = { "1": 0, "2": 1, "3": 2, "4": 3, a: 0, b: 1, c: 2, d: 3, A: 0, B: 1, C: 2, D: 3 } as Record<string, number>;
        const i = map[e.key];
        if (i !== undefined && i < q.options.length) {
          pick(i);
        }
      } else if (e.key === "Enter" || e.key === " ") {
        // 下一题
        next();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, picked, current]);

  useEffect(() => {
    // 从本地存储同步一次性快照，非级联渲染场景
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProgress(readQuizProgress(quiz.chapterNum));
  }, [quiz.chapterNum]);

  function save(finalScore: number) {
    const p: QuizProgress = {
      best: Math.max(progress?.best ?? 0, finalScore),
      done: true,
    };
    setProgress(p);
    saveQuizProgress(quiz.chapterNum, p, quiz.questions.length);
  }

  function pick(i: number) {
    if (picked !== null) return;
    setPicked(i);
    if (i === quiz.questions[current].answer) {
      setCorrect((c) => c + 1);
      resolveWrong(quiz.chapterNum, current);
    } else {
      recordWrong(quiz.chapterNum, current, i);
    }
  }

  function next() {
    const isLast = current === quiz.questions.length - 1;
    if (isLast) {
      save(correct);
      setStarted(false);
      setCurrent(0);
      setPicked(null);
      setCorrect(0);
      return;
    }
    setCurrent((c) => c + 1);
    setPicked(null);
  }

  function skipQ() {
    if (picked !== null) return;
    next();
  }

  if (!started) {
    const perfect = progress?.done && progress.best === quiz.questions.length;
    return (
      <div className={`mt-12 rounded-2xl border p-6 ${
        perfect
          ? "border-[var(--accent)]/50 bg-gradient-to-br from-[var(--accent-dim)] to-transparent"
          : "border-[var(--border)] bg-[var(--surface)]"
      }`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-semibold">{perfect ? "🏆" : "✏️"} {quiz.title}</p>
            <p className="mt-1 text-sm text-muted">
              {dict.questionsUnit}
              {progress?.done && (
                <span className="ml-2 text-accent">{tpl(dict.bestTpl, { n: progress.best, total: quiz.questions.length })}</span>
              )}
              {perfect && <span className="ml-2 text-accent font-medium">· {dict.perfect}</span>}
            </p>
            {/* 成绩分析条 */}
            {progress?.done && (
              <div className="mt-3 flex items-center gap-2">
                <div className="flex h-2 rounded-full overflow-hidden bg-down/20" style={{ width: `${quiz.questions.length * 12}px` }}>
                  <div className="bg-accent" style={{ width: `${(progress.best / quiz.questions.length) * 100}%` }} />
                </div>
                <span className="text-xs text-faint font-mono">
                  {progress.best}/{quiz.questions.length} · {Math.round((progress.best / quiz.questions.length) * 100)}%
                </span>
              </div>
            )}
          </div>
          <button
            onClick={() => setStarted(true)}
            className="rounded-full border border-accent/50 bg-accent-dim text-accent font-semibold px-6 py-2.5 hover:bg-accent hover:text-white dark:hover:text-[#06281c] transition shrink-0"
          >
            {progress?.done ? dict.retry : dict.start}
          </button>
        </div>
      </div>
    );
  }

  const q = quiz.questions[current];
  return (
    <div className="mt-12 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <div className="flex items-center justify-between text-xs text-faint">
        <p>{tpl(dict.progressTpl, { i: current + 1, n: quiz.questions.length })}</p>
        <div className="flex items-center gap-3">
          <QuizTimer running={picked === null} />
          {picked === null && (
            <button onClick={skipQ} className="text-xs text-faint hover:text-accent transition underline underline-offset-4">
              跳过
            </button>
          )}
          <span className="font-mono text-accent">
            {Math.round(((current + (picked !== null ? 1 : 0)) / quiz.questions.length) * 100)}%
          </span>
        </div>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-accent-strong to-accent transition-all duration-300"
          style={{
            width: `${((current + (picked !== null ? 1 : 0)) / quiz.questions.length) * 100}%`,
          }}
        />
      </div>
      <p className="mt-3 font-medium leading-relaxed">{q.question}</p>
      <ul className="mt-5 space-y-2.5">
        {q.options.map((opt, i) => {
          const isAnswer = i === q.answer;
          const isPicked = i === picked;
          let cls =
            "border-[var(--border)] hover:border-[var(--accent)]/50 hover:-translate-y-0.5 hover:bg-[var(--accent-dim)] cursor-pointer";
          if (picked !== null) {
            if (isAnswer) cls = "border-accent bg-accent-dim";
            else if (isPicked) cls = "border-down/60 bg-down/10";
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
        <div ref={explainRef} className="mt-5 rounded-xl bg-black/20 dark:bg-white/5 p-4 text-sm space-y-3">
          <p className="font-semibold">
            {picked === q.answer ? dict.correct : dict.wrong}
          </p>
          <p className="text-muted leading-relaxed">{q.explain}</p>
          <button
            onClick={next}
            className="rounded-full bg-accent-strong hover:bg-accent text-white dark:text-[#06281c] font-semibold px-6 py-2 transition"
          >
            {current === quiz.questions.length - 1 ? dict.finish : dict.nextQ}
          </button>
        </div>
      )}
    </div>
  );
}
