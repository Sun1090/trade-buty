"use client";

import { useState } from "react";
import { Quiz } from "@/components/quiz";
import { readQuizProgress } from "@/lib/quiz-store";
import type { ChapterQuiz } from "@/lib/quiz-types";

type QuizDict = {
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
};

/**
 * 章节测验入口卡片——每篇课底部无条件显示。
 * 复用整章题库（ChapterQuiz），不写新题。
 * 未做：显示题数 + 开始按钮，点击就地展开 Quiz。
 * 已做：显示历史最佳 + 再测一次。
 */
export function ChapterExamCard({
  quiz,
  dict,
}: {
  quiz: ChapterQuiz;
  dict: QuizDict;
}) {
  const [expanded, setExpanded] = useState(false);
  const progress = readQuizProgress(quiz.chapterNum);
  const done = progress?.done;
  const total = quiz.questions.length;

  if (expanded) {
    return <Quiz quiz={quiz} dict={dict} />;
  }

  const bestTpl = dict.bestTpl;
  const bestText = bestTpl
    .replace("{n}", String(progress?.best ?? 0))
    .replace("{total}", String(total));

  return (
    <section className="mt-12 rounded-2xl border border-[var(--accent)]/30 bg-gradient-to-br from-[var(--accent-dim)] to-transparent p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-semibold">
            📝 {quiz.title}
          </p>
          <p className="mt-1 text-sm text-muted">
            {total} {dict.questionsUnit}
            {done && (
              <span className="ml-2 text-accent">{bestText}</span>
            )}
          </p>
        </div>
        <button
          onClick={() => setExpanded(true)}
          className="rounded-full bg-accent-strong hover:bg-accent text-white dark:text-[#06281c] font-semibold px-6 py-2.5 transition shrink-0"
        >
          {done ? dict.retry : dict.start}
        </button>
      </div>
    </section>
  );
}
