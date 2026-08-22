"use client";

import { useEffect, useState } from "react";
import type { ChapterQuiz } from "@/lib/quiz-types";

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
}

const tpl = (s: string, vars: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k]));

const key = (ch: string) => `tb-quiz-${ch}`;

interface Progress {
  best: number;
  done: boolean;
}

export function Quiz({ quiz, dict }: { quiz: ChapterQuiz; dict: QuizDict }) {
  const [started, setStarted] = useState(false);
  const [current, setCurrent] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const [progress, setProgress] = useState<Progress | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key(quiz.chapterNum));
      // 从外部存储同步一次性快照，非级联渲染场景
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setProgress(JSON.parse(raw) as Progress);
    } catch {
      // 忽略损坏的存档
    }
  }, [quiz.chapterNum]);

  function save(finalScore: number) {
    const p: Progress = {
      best: Math.max(progress?.best ?? 0, finalScore),
      done: true,
    };
    setProgress(p);
    try {
      localStorage.setItem(key(quiz.chapterNum), JSON.stringify(p));
    } catch {
      // 存储不可用时仅内存保留
    }
  }

  function pick(i: number) {
    if (picked !== null) return;
    setPicked(i);
    if (i === quiz.questions[current].answer) setCorrect((c) => c + 1);
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

  if (!started) {
    return (
      <div className="mt-12 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-semibold">✏️ {quiz.title}</p>
            <p className="mt-1 text-sm text-muted">
              {dict.questionsUnit}
              {progress?.done && (
                <span className="ml-2 text-accent">{tpl(dict.bestTpl, { n: progress.best, total: quiz.questions.length })}</span>
              )}
            </p>
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
      <p className="text-xs text-faint">
        {tpl(dict.progressTpl, { i: current + 1, n: quiz.questions.length })}{correct}
      </p>
      <p className="mt-3 font-medium leading-relaxed">{q.question}</p>
      <ul className="mt-5 space-y-2.5">
        {q.options.map((opt, i) => {
          const isAnswer = i === q.answer;
          const isPicked = i === picked;
          let cls =
            "border-[var(--border)] hover:border-[var(--accent)]/50 cursor-pointer";
          if (picked !== null) {
            if (isAnswer) cls = "border-accent bg-accent-dim";
            else if (isPicked) cls = "border-down/60 bg-down/10";
            else cls = "border-[var(--border)] opacity-50";
          }
          return (
            <li
              key={i}
              onClick={() => pick(i)}
              className={`rounded-xl border px-4 py-3 text-sm transition ${cls} ${picked !== null ? "" : "cursor-pointer"}`}
              role={picked === null ? "button" : undefined}
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
