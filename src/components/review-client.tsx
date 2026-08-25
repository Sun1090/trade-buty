"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ChapterQuiz, QuizQuestion } from "@/lib/quiz-types";
import { readWrong, resolveWrong, clearAllWrong, type WrongEntry } from "@/lib/wrongbook";
import { AiQuiz } from "@/components/ai-quiz";

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
      <div className="rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[var(--accent-dim)] to-[var(--surface)] p-10 text-center">
        <p className="text-4xl" aria-hidden>🎯</p>
        <p className="mt-4 font-semibold">{dict.empty}</p>
        <p className="mt-2 text-sm text-muted">{dict.emptyHint}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link
            href={`/${locale}/path`}
            className="inline-block rounded-full bg-accent-strong hover:bg-accent text-white dark:text-[#06281c] font-semibold px-6 py-2.5 text-sm transition"
          >
            {dict.browseCta}
          </Link>
        </div>
      </div>
    );
  }

  // 按篇章分组
  function exportText() {
    const lines: string[] = ["Trade Buty 错题本导出", `导出时间：${new Date().toLocaleString()}`, ""];
    for (const [title, group] of groups) {
      lines.push(`## ${title}`);
      for (const item of group) {
        const q = item.quiz.questions[item.questionIdx];
        lines.push(`- ${q.question}`);
        lines.push(`  你的选择：${String.fromCharCode(65 + item.picked)}`);
        lines.push(`  正确答案：${String.fromCharCode(65 + q.answer)}`);
      }
      lines.push("");
    }
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "trade-buty-wrongbook.txt";
    a.click();
    URL.revokeObjectURL(url);
  }
  const groups = new Map<string, Item[]>();
  for (const item of items) {
    const title = item.quiz.title;
    if (!groups.has(title)) groups.set(title, []);
    groups.get(title)!.push(item);
  }

  const [redo, setRedo] = useState<{ item: Item; picked: number | null } | null>(null);

  function startRedo() {
    const random = items[Math.floor(Math.random() * items.length)];
    setRedo({ item: random, picked: null });
  }

  function pickRedo(i: number) {
    if (redo?.picked !== null) return;
    setRedo((r) => r ? { ...r, picked: i } : null);
  }

  if (redo) {
    const q = redo.item.question;
    return (
      <div className="rounded-2xl border border-[var(--accent)]/30 border-l-4 border-l-[var(--accent)] bg-gradient-to-br from-[var(--accent-dim)] to-transparent p-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-mono text-faint">随机抽题重答</p>
          <button onClick={() => setRedo(null)} className="text-xs text-faint hover:text-accent transition">返回</button>
        </div>
        <p className="font-medium leading-relaxed">{q.question}</p>
        <ul className="mt-5 space-y-2.5">{q.options.map((opt, i) => {
          let cls = "border-[var(--border)] hover:border-[var(--accent)]/50 cursor-pointer";
          if (redo.picked !== null) {
            if (i === q.answer) cls = "border-accent bg-[var(--accent-dim)]";
            else if (i === redo.picked) cls = "border-down/60 bg-down/10";
            else cls = "border-[var(--border)] opacity-50";
          }
          return (<li key={i} onClick={() => pickRedo(i)} className={`rounded-xl border px-4 py-3 text-sm transition ${cls} ${redo.picked === null ? "cursor-pointer" : ""}`}><span className="font-mono text-xs text-faint mr-2">{String.fromCharCode(65 + i)}</span>{opt}</li>);
        })}</ul>
        {redo.picked !== null && (
          <div className="mt-5 rounded-xl bg-black/20 dark:bg-white/5 p-4 text-sm space-y-3">
            <p className="font-semibold">{redo.picked === q.answer ? "✅ 正确" : "❌ 错误，正确答案是 " + q.options[q.answer]}</p>
            <p className="text-muted leading-relaxed">{q.explain}</p>
            <button onClick={startRedo} className="rounded-full bg-accent-strong hover:bg-accent text-white dark:text-[#06281c] font-semibold px-6 py-2 text-sm transition">下一道随机题</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted">{items.length}</p>
        <div className="flex items-center gap-2">
          <button onClick={exportText} className="text-xs text-faint hover:text-accent transition border border-[var(--border)] rounded-full px-3 py-1.5">
            {locale === "en" ? "Export" : "导出"}
          </button>
          <button
            onClick={() => {
              if (confirm(locale === "en" ? "Clear all wrong answers?" : "清空所有错题？")) {
                clearAllWrong();
              }
            }}
            className="text-xs text-faint hover:text-down transition border border-[var(--border)] rounded-full px-3 py-1.5"
          >
            {locale === "en" ? "Clear" : "清空"}
          </button>
          <button onClick={startRedo} className="text-xs rounded-full border border-[var(--accent)]/40 bg-[var(--accent-dim)] hover:border-accent/60 text-accent font-medium px-4 py-1.5 transition">
            {locale === "en" ? "Random redo" : "随机抽题重答"}
          </button>
        </div>
      </div>
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

      {/* AI 自适应出题：根据错题生成变体题 */}
      {items.length > 0 && (
        <div className="mt-8">
          <AiQuiz
            wrongItems={items.map((i) => ({ chapterNum: i.chapterNum, questionIdx: i.questionIdx }))}
            quizzes={quizzes}
            dict={{ generate: "AI 针对错题出变体题", generating: "正在生成…", error: "生成失败，请重试", question: "题目", explain: "解析" }}
          />
        </div>
      )}
    </div>
  );
}
