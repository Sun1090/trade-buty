"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ChapterQuiz, QuizQuestion } from "@/lib/quiz-types";
import { readWrong, resolveWrong, type WrongEntry } from "@/lib/wrongbook";

export interface ReviewDict {
  title: string;
  intro: string;
  empty: string;
  emptyHint: string;
  showAnswer: string;
  yourPick: string;
  correctPick: string;
  resolved: string;
  browseCta: string;
}

interface Item extends WrongEntry {
  quiz: ChapterQuiz;
  question: QuizQuestion;
}

export function ReviewClient({
  quizzes,
  dict,
  locale,
}: {
  quizzes: ChapterQuiz[];
  dict: ReviewDict;
  locale: string;
}) {
  const [wrong, setWrong] = useState<Record<string, WrongEntry> | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWrong(readWrong());
    const onChange = () => setWrong(readWrong());
    window.addEventListener("tb-progress", onChange);
    return () => window.removeEventListener("tb-progress", onChange);
  }, []);

  if (wrong === null) return null;

  const items: Item[] = Object.values(wrong)
    .map((e) => {
      const quiz = quizzes.find((q) => q.chapterNum === e.chapterNum);
      const question = quiz?.questions[e.questionIdx];
      return quiz && question ? { ...e, quiz, question } : null;
    })
    .filter((x): x is Item => !!x)
    .sort((a, b) => b.at - a.at);

  function resolve(item: Item) {
    resolveWrong(item.chapterNum, item.questionIdx);
    setRevealed((s) => {
      const n = new Set(s);
      n.delete(`${item.chapterNum}:${item.questionIdx}`);
      return n;
    });
  }

  function toggle(key: string) {
    setRevealed((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-10 text-center">
        <p className="text-4xl" aria-hidden>🎯</p>
        <p className="mt-4 font-semibold">{dict.empty}</p>
        <p className="mt-2 text-sm text-muted">{dict.emptyHint}</p>
        <Link
          href={`/${locale}/path`}
          className="inline-block mt-4 rounded-full bg-accent-strong hover:bg-accent text-white dark:text-[#06281c] font-semibold px-6 py-2.5 text-sm transition"
        >
          {dict.browseCta}
        </Link>
      </div>
    );
  }

  // 按篇章分组
  const groups = new Map<string, Item[]>();
  for (const item of items) {
    const title = item.quiz.title;
    if (!groups.has(title)) groups.set(title, []);
    groups.get(title)!.push(item);
  }

  return (
    <div className="space-y-8">
      <p className="text-sm text-muted">{items.length}</p>
      {[...groups.entries()].map(([chapterTitle, groupItems]) => {
        const chapterSlug = groupItems[0].chapterNum;
        const quizDocSlug = groupItems[0].quiz.docSlug;
        return (
        <div key={chapterTitle}>
          <div className="flex items-center justify-between gap-2 mb-3">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-dim)] border border-[var(--accent)]/30 px-3 py-1 text-xs font-medium text-accent">
              {chapterTitle} · {groupItems.length}
            </p>
            <Link
              href={`/${locale}/knowledge/${chapterSlug}/${quizDocSlug}`}
              className="text-xs text-faint hover:text-accent transition underline underline-offset-4"
            >
              重做本章测验 →
            </Link>
          </div>
          <div className="space-y-3">
            {groupItems.map((item) => {
              const key = `${item.chapterNum}:${item.questionIdx}`;
              const open = revealed.has(key);
              return (
                <div
                  key={key}
                  className="rounded-2xl border border-[var(--border)] border-l-2 border-l-[var(--down)] bg-[var(--surface)] p-5"
                >
                  <p className="text-xs text-faint">Q{item.questionIdx + 1}</p>
                  <p className="mt-2 font-medium leading-relaxed">{item.question.question}</p>
                  {!open ? (
                    <button
                      onClick={() => toggle(key)}
                      className="mt-3 text-sm text-accent underline underline-offset-4"
                    >
                      {dict.showAnswer}
                    </button>
                  ) : (
                    <div className="mt-4 space-y-2 text-sm">
                      <p className="text-down">
                        {dict.yourPick}:{" "}
                        {String.fromCharCode(65 + item.picked)}{" "}
                        {item.question.options[item.picked]}
                      </p>
                      <p className="text-accent">
                        {dict.correctPick}:{" "}
                        {String.fromCharCode(65 + item.question.answer)}{" "}
                        {item.question.options[item.question.answer]}
                      </p>
                      <p className="text-muted leading-relaxed">{item.question.explain}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          onClick={() => resolve(item)}
                          className="rounded-full bg-accent-strong hover:bg-accent text-white dark:text-[#06281c] text-xs font-semibold px-5 py-2 transition"
                        >
                          {dict.resolved}
                        </button>
                        <Link
                          href={`/${locale}/ai?q=${encodeURIComponent(item.question.question)}`}
                          className="rounded-full border border-[var(--accent)]/40 bg-[var(--accent-dim)] hover:border-accent/60 text-accent text-xs font-medium px-5 py-2 transition"
                        >
                          <span aria-hidden>🤖 </span>问 AI 深入理解
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        );
      })}
    </div>
  );
}
