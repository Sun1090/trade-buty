"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ChapterQuiz, QuizQuestion } from "@/lib/quiz-types";
import { readWrong, resolveWrong, clearAllWrong, applySrsResult, pruneOrphanWrong, type WrongEntry } from "@/lib/wrongbook";
import { effectiveSrs, isSrsDue, isSrsOverdue, daysUntilDue, type SrsState } from "@/lib/srs";
import { addStudyTime } from "@/lib/study-time";
import { localDateStr } from "@/lib/date-utils";
import { AiQuiz } from "@/components/ai-quiz";

export interface ReviewDict {
  title: string;
  empty: string;
  emptyHint: string;
  showAnswer: string;
  yourPick: string;
  correctPick: string;
  resolved: string;
  browseCta: string;
  /** 默认（SRS 开）模式的两个按钮，复习页 intro 点名的是它们 */
  srsMastered: string;
  srsNotYet: string;
}

interface Item extends WrongEntry {
  quiz: ChapterQuiz;
  question: QuizQuestion;
}

/**
 * 渲染用的错题：`srs` 是「什么时候该出现」的统一尺子（含 R5.6 回填），
 * `overdue` 是「要不要标红成逾期」的尺子——只看真实排过的 `srsDue`（R5.4），
 * 两个口径分开是有意的，见下方 dueCount/overdueCount 处注释。
 */
interface ReviewItem extends Item {
  srs: SrsState;
  overdue: boolean;
}

export function ReviewClient({
  quizzes,
  dict,
  locale,
  aiEnabled = true,
}: {
  quizzes: ChapterQuiz[];
  dict: ReviewDict;
  locale: string;
  /** R3.9：无 key 环境由服务端页传入 false */
  aiEnabled?: boolean;
}) {
  const [wrong, setWrong] = useState<Record<string, WrongEntry> | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [redo, setRedo] = useState<{ item: Item; picked: number | null } | null>(null);
  // R5.9：SRS 开关（关闭 = 纯列表模式回退）
  const [srsOn, setSrsOn] = useState(true);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWrong(readWrong());
    try {
      setSrsOn(localStorage.getItem("tb-srs-mode") !== "off");
    } catch {
      // localStorage 不可用保持默认开启
    }
    const onChange = () => setWrong(readWrong());
    window.addEventListener("tb-progress", onChange);
    return () => window.removeEventListener("tb-progress", onChange);
  }, []);

  if (wrong === null) return null;

  // R5.10：孤儿清理——题库删除/章节改名后映射不到的条目直接移除
  const validKeys = new Set(
    Object.values(wrong)
      .map((e) => {
        const q = quizzes.find((x) => x.chapterNum === e.chapterNum);
        return q?.questions[e.questionIdx] ? `${e.chapterNum}:${e.questionIdx}` : null;
      })
      .filter((x): x is string => !!x),
  );
  pruneOrphanWrong(validKeys);

  const todayStr = localDateStr();

  const items: ReviewItem[] = Object.values(wrong)
    .map((e) => {
      const quiz = quizzes.find((q) => q.chapterNum === e.chapterNum);
      const question = quiz?.questions[e.questionIdx];
      return quiz && question
        ? {
            ...e,
            quiz,
            question,
            srs: effectiveSrs(e, todayStr),
            overdue: isSrsOverdue(e.srsDue, todayStr),
          }
        : null;
    })
    .filter((x): x is ReviewItem => !!x)
    .sort((a, b) => b.at - a.at);

  // R5.3：SRS 开启时，到期（含过期）置顶、其余按到期日升序；关闭则按入库时间倒序
  const sorted = srsOn
    ? [...items].sort((a, b) => {
        const aDue = isSrsDue(a.srs.due, todayStr);
        const bDue = isSrsDue(b.srs.due, todayStr);
        if (aDue !== bDue) return aDue ? -1 : 1;
        return a.srs.due < b.srs.due ? -1 : a.srs.due > b.srs.due ? 1 : 0;
      })
    : items;

  // 「今日到期」统一走 effectiveSrs：无 srs_due 的条目（R5 之前的旧数据、云端 srs_due 为空的行）
  // 按入库日回填，与统计页「今日到期」、复习提醒卡片同一把尺子。
  const dueCount = items.filter((x) => isSrsDue(x.srs.due, todayStr)).length;
  // 「已过期」是另一把尺子，只看真实排过的 `srsDue`、不看回填值：回填出来的到期日是推断的，
  // 不是系统真正定过的复习计划，拿它标红等于对旧数据宣布一个没人定过的逾期天数（R5.4）。
  // 这与 `wrongbook-efficiency` 的 `overdue` 口径一致，否则复习页显示「N 道已过期」、
  // 导出的统计里 overdue 却是另一个数。
  const overdueCount = items.filter((x) => x.overdue).length;

  /** R5.8：复习应答计入每日目标（1 题记 1 分钟，与台账 quiz 源合并） */
  function creditReview() {
    addStudyTime("quiz", 60);
  }

  /** R5.5：标记掌握了 → SRS 推进/掌握 */
  function markMastered(item: ReviewItem) {
    creditReview();
    applySrsResult(item.chapterNum, item.questionIdx, true);
    setRevealed((s) => {
      const n = new Set(s);
      n.delete(`${item.chapterNum}:${item.questionIdx}`);
      return n;
    });
  }

  /** R5.5：还没掌握 → SRS 重置（明天再见） */
  function markNotYet(item: ReviewItem) {
    creditReview();
    applySrsResult(item.chapterNum, item.questionIdx, false, item.picked);
  }

  /** R5.9：切换 SRS 模式 */
  function toggleSrs() {
    const next = !srsOn;
    setSrsOn(next);
    try {
      localStorage.setItem("tb-srs-mode", next ? "on" : "off");
    } catch {
      // ignore
    }
  }

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

  const groups = new Map<string, ReviewItem[]>();
  for (const item of sorted) {
    const title = item.quiz.title;
    if (!groups.has(title)) groups.set(title, []);
    groups.get(title)!.push(item);
  }

  // 按篇章分组
  function exportText() {
    const en = locale === "en";
    const lines: string[] = [
      en ? "Trade Buty wrong-answer export" : "Trade Buty 错题本导出",
      `${en ? "Exported at: " : "导出时间："}${new Date().toLocaleString()}`,
      "",
    ];
    for (const [title, group] of groups) {
      lines.push(`## ${title}`);
      for (const item of group) {
        const q = item.quiz.questions[item.questionIdx];
        lines.push(`- ${q.question}`);
        lines.push(`  ${en ? "Your pick: " : "你的选择："}${String.fromCharCode(65 + item.picked)}`);
        lines.push(`  ${en ? "Correct answer: " : "正确答案："}${String.fromCharCode(65 + q.answer)}`);
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
          <p className="text-xs font-mono text-faint">{locale === "en" ? "Random redo" : "随机抽题重答"}</p>
          <button onClick={() => setRedo(null)} className="text-xs text-faint hover:text-accent transition">{locale === "en" ? "Back" : "返回"}</button>
        </div>
        <p className="font-medium leading-relaxed">{q.question}</p>
        <ul className="mt-5 space-y-2.5">{q.options.map((opt, i) => {
          let cls = "border-[var(--border)] hover:border-[var(--accent)]/50 cursor-pointer";
          if (redo.picked !== null) {
            if (i === q.answer) cls = "border-accent bg-[var(--accent-dim)]";
            else if (i === redo.picked) cls = "border-down/60 bg-down/10";
            else cls = "border-[var(--border)] opacity-50";
          }
          return (
            <li key={i}>
              <button
                onClick={() => pickRedo(i)}
                disabled={redo.picked !== null}
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
        })}</ul>
        {redo.picked !== null && (
          <div className="mt-5 rounded-xl bg-black/20 dark:bg-white/5 p-4 text-sm space-y-3">
            <p className="font-semibold">
              {redo.picked === q.answer
                ? (locale === "en" ? "✅ Correct" : "✅ 正确")
                : (locale === "en"
                  ? `❌ Wrong — the answer is ${q.options[q.answer]}`
                  : `❌ 错误，正确答案是 ${q.options[q.answer]}`)}
            </p>
            <p className="text-muted leading-relaxed">{q.explain}</p>
            <button onClick={startRedo} className="rounded-full bg-accent-strong hover:bg-accent text-white dark:text-[#06281c] font-semibold px-6 py-2 text-sm transition">{locale === "en" ? "Another random question" : "下一道随机题"}</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent-dim)] p-4 sm:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">{locale === "en" ? "Today’s review" : "今天的复习任务"}</p>
          <p className="mt-2 text-lg font-bold">
            {srsOn
              ? (locale === "en"
                ? `${dueCount} due now${overdueCount > 0 ? ` · ${overdueCount} overdue` : ""} of ${items.length}`
                : `${items.length} 道错题，${dueCount} 道今日到期${overdueCount > 0 ? `（${overdueCount} 道已过期）` : ""}`)
              : (locale === "en" ? `${items.length} questions waiting` : `还有 ${items.length} 道题等你掌握`)}
          </p>
          <p className="mt-1 text-sm text-muted">
            {/* 这句「怎么做」点名的按钮必须是此刻真的渲染出来那两颗：「✓ 已掌握，移出错题本」
                只在 SRS 关闭时才存在，而默认模式走的是「掌握了 / 还没掌握，明天再见」，
                且「掌握了」推进的是间隔表、当场不出库。名字从字典取，句子就不会和按钮分家。 */}
            {locale === "en"
              ? `Reveal the answer, explain it in your own words, then tap ${srsOn ? `“${dict.srsMastered}” or “${dict.srsNotYet}”.` : `“${dict.resolved}”.`}`
              : `先看答案，再用自己的话解释，最后${srsOn ? `点「${dict.srsMastered}」或「${dict.srsNotYet}」。` : `点「${dict.resolved}」。`}`}
          </p>
        </div>
        <button onClick={startRedo} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-left transition hover:border-accent/50 hover:bg-[var(--surface-hover)]">
          <span className="text-2xl" aria-hidden>🎯</span>
          <span className="mt-2 block text-sm font-semibold">{locale === "en" ? "Start a quick redo" : "开始快速重答"}</span>
          <span className="mt-1 block text-xs text-faint">{locale === "en" ? "Random question" : "随机抽一题"} →</span>
        </button>
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted">{items.length}</p>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleSrs}
            className={`text-xs rounded-full px-3 py-1.5 border transition ${srsOn ? "border-accent/60 bg-[var(--accent-dim)] text-accent font-medium" : "border-[var(--border)] text-faint hover:text-accent"}`}
            title={locale === "en" ? "Toggle spaced-repetition ordering" : "切换间隔重复排序"}
          >
            🔁 {locale === "en" ? (srsOn ? "SRS on" : "SRS off") : srsOn ? "复习计划开" : "复习计划关"}
          </button>
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
      {/* R5.12：今天没有到期项时的鼓励文案（不单调显示「无」） */}
      {srsOn && dueCount === 0 && items.length > 0 && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 text-center">
          <p className="text-sm text-muted leading-relaxed">
            {locale === "en"
              ? "🌙 Nothing due today — learn something new and come back another day!"
              : "🌙 今天没有到期的复习——先去学点新内容，改天再回来看看！"}
          </p>
        </div>
      )}
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
              {locale === "en" ? "Redo this chapter quiz →" : "重做本章测验 →"}
            </Link>
          </div>
          <div className="space-y-3">
            {groupItems.map((item) => {
              const key = `${item.chapterNum}:${item.questionIdx}`;
              const open = revealed.has(key);
              return (
                <div
                  key={key}
                  className={`rounded-2xl border border-[var(--border)] border-l-2 bg-[var(--surface)] p-5 ${item.overdue ? "border-l-[var(--down)]" : isSrsDue(item.srs.due, todayStr) ? "border-l-[var(--accent)]" : "border-l-[var(--border-strong)]"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-faint">Q{item.questionIdx + 1}</p>
                    {srsOn && (
                      item.overdue ? (
                        // R5.4：过期温和提醒——说明事实 + 正向措辞，不制造焦虑
                        <span className="rounded-full border border-[var(--down)]/40 bg-[var(--down)]/10 px-2.5 py-0.5 text-[10px] text-down">
                          {locale === "en"
                            ? `${Math.abs(daysUntilDue(item.srs.due, todayStr))}d overdue — catch up today`
                            : `过期 ${Math.abs(daysUntilDue(item.srs.due, todayStr))} 天——今天补上就好`}
                        </span>
                      ) : isSrsDue(item.srs.due, todayStr) ? (
                        <span className="rounded-full border border-[var(--accent)]/40 bg-[var(--accent-dim)] px-2.5 py-0.5 text-[10px] text-accent">
                          {locale === "en" ? "Due today" : "今日到期"}
                        </span>
                      ) : (
                        <span className="rounded-full border border-[var(--border)] px-2.5 py-0.5 text-[10px] text-faint">
                          {locale === "en"
                            ? `in ${daysUntilDue(item.srs.due, todayStr)}d`
                            : `${daysUntilDue(item.srs.due, todayStr)} 天后`}
                        </span>
                      )
                    )}
                  </div>
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
                      <div className="mt-3 flex flex-wrap gap-3">
                        {srsOn ? (
                          <>
                            {/* R5.11：单手操作——按钮加高、间距加开 */}
                            <button
                              onClick={() => markMastered(item)}
                              className="rounded-full bg-accent-strong hover:bg-accent text-white dark:text-[#06281c] text-sm font-semibold px-6 py-3 transition"
                            >
                              {dict.srsMastered}
                            </button>
                            <button
                              onClick={() => markNotYet(item)}
                              className="rounded-full border border-[var(--border-strong)] hover:border-[var(--down)]/60 text-sm font-medium px-6 py-3 text-muted transition"
                            >
                              {dict.srsNotYet}
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => resolve(item)}
                            className="rounded-full bg-accent-strong hover:bg-accent text-white dark:text-[#06281c] text-xs font-semibold px-5 py-2 transition"
                          >
                            {dict.resolved}
                          </button>
                        )}
                        <Link
                          href={`/${locale}/ai?q=${encodeURIComponent(item.question.question)}`}
                          className="rounded-full border border-[var(--accent)]/40 bg-[var(--accent-dim)] hover:border-accent/60 text-accent text-xs font-medium px-5 py-2 transition"
                        >
                          <span aria-hidden>🤖 </span>
                          {locale === "en" ? "Ask AI to go deeper" : "问 AI 深入理解"}
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
            aiEnabled={aiEnabled}
            wrongItems={items.map((i) => ({ chapterNum: i.chapterNum, questionIdx: i.questionIdx }))}
            dict={{
              generate: locale === "en" ? "AI quiz from your wrong answers" : "AI 针对错题出变体题",
              generating: locale === "en" ? "Generating…" : "正在生成…",
              error: locale === "en" ? "Generation failed, retry" : "生成失败，请重试",
              loginRequired: locale === "en" ? "Log in to use AI quiz" : "登录后可用 AI 出题",
              rateLimited: locale === "en" ? "Too many requests, try again later" : "请求过于频繁，请稍后再试",
              retryInTpl: locale === "en" ? "Retry in about {n} min" : "约 {n} 分钟后重试",
              question: locale === "en" ? "Question" : "题目",
              explain: locale === "en" ? "Explanation" : "解析",
              report: locale === "en" ? "Report question" : "举报题目",
              reported: locale === "en" ? "Reported" : "已举报",
              reportFailed: locale === "en" ? "Report not sent — tap to retry" : "举报没送出去，点这里重试",
              badge: locale === "en" ? "AI variant" : "AI 变体题",
              correct: locale === "en" ? "Correct" : "正确",
              wrong: locale === "en" ? "Wrong" : "错误",
              next: locale === "en" ? "Next →" : "下一题 →",
              done: locale === "en" ? "Done" : "完成",
            }}
          />
        </div>
      )}
    </div>
  );
}
