"use client";

import { useState, useSyncExternalStore } from "react";
import { Quiz, type QuizDict } from "@/components/quiz";
import { readQuizProgress, type QuizProgress } from "@/lib/quiz-store";
import { quizScoreCount } from "@/lib/quiz-score";
import type { ChapterQuiz } from "@/lib/quiz-types";
import type { ShareLocale } from "@/lib/share-card";

function subscribeQuizProgress(onChange: () => void) {
  window.addEventListener("tb-progress", onChange);
  return () => window.removeEventListener("tb-progress", onChange);
}

/**
 * 章节测验入口卡片——本章有题库时，每篇课文底部都放这一张；没有题库时那个位置是
 * AI 出题卡片（`[doc]/page.tsx` 的 else 分支），所以不是「无条件」。
 * 复用整章题库（ChapterQuiz），不写新题。
 * 没做过：显示题数 + 「开始测验」，点击就地展开 Quiz。
 * 做过：同一行补上历史最佳，按钮换成「再测一次」。
 */
export function ChapterExamCard({
  quiz,
  dict,
  locale,
  chapterTitle,
}: {
  quiz: ChapterQuiz;
  dict: QuizDict;
  locale: ShareLocale;
  chapterTitle?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  // 成绩存在 localStorage 里。直接在渲染期读它会让服务端快照与客户端首帧不一致：
  // SSG 吐出的 HTML 是「开始测验」，客户端 hydrate 时用户早就做过题（「再测一次 · 最佳 3/3」），
  // 于是两处文本同时对不上。改成订阅式快照，服务端固定「无进度」，挂载后再对齐真实成绩；
  // `quiz-store` 保存成绩时派发的就是 tb-progress，答完一套题这里会自己更新。
  // 快照必须是可比较的原始值（对象会让 useSyncExternalStore 每帧都认为变了），所以序列化成字符串。
  const serialized = useSyncExternalStore(
    subscribeQuizProgress,
    () => JSON.stringify(readQuizProgress(quiz.chapterNum)),
    () => "null",
  );
  const progress = serialized === "null" ? null : (JSON.parse(serialized) as QuizProgress);
  const done = progress?.done;
  const total = quiz.questions.length;

  if (expanded) {
    return <Quiz quiz={quiz} dict={dict} locale={locale} chapterTitle={chapterTitle} />;
  }

  const bestTpl = dict.bestTpl;
  const bestText = bestTpl
    .replace("{n}", String(quizScoreCount(progress?.best ?? 0, total)))
    .replace("{total}", String(total));

  return (
    <section className="mt-12 rounded-2xl border border-[var(--accent)]/30 border-l-4 border-l-[var(--accent)] bg-gradient-to-br from-[var(--accent-dim)] to-transparent p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-semibold">
            <span aria-hidden>📝 </span>{quiz.title}
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
