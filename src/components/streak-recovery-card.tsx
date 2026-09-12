"use client";

import { useSyncExternalStore } from "react";
import { getStreakBreak } from "@/lib/streak";
import { getTodayStudyMinutes } from "@/lib/daily-goal";
import { readWrong } from "@/lib/wrongbook";
import { effectiveSrs, isSrsDue } from "@/lib/srs";
import { localDateStr } from "@/lib/date-utils";
import { buildStreakRecovery } from "@/lib/streak-recovery";

const DISMISS_KEY = "tb-recovery-dismissed";

function subscribe(callback: () => void) {
  const events = ["tb-streak", "tb-study-time", "tb-progress", "tb-goal"] as const;
  events.forEach((e) => window.addEventListener(e, callback));
  return () => events.forEach((e) => window.removeEventListener(e, callback));
}

const getBroken = () => getStreakBreak().broken;
const getLongest = () => getStreakBreak().longest;
const getDueReviewCount = () => {
  try {
    const today = localDateStr();
    return Object.values(readWrong()).filter((entry) =>
      isSrsDue(effectiveSrs(entry).due, today),
    ).length;
  } catch {
    return 0;
  }
};
const getDismissedToday = () => {
  try {
    return localStorage.getItem(DISMISS_KEY) === localDateStr();
  } catch {
    return false;
  }
};

export interface StreakRecoveryLabels {
  title: string;
  bodyTpl: string;
  reviewTpl: string;
  continueLabel: string;
  replayLabel: string;
  later: string;
}

/**
 * R12.6：断档恢复提示卡——只在「断签 + 今天还没开始学 + 未关闭」时出现。
 * 今日一旦破零（任意学习动作）即自动隐去；「稍后」仅隐藏到今日结束。
 */
export function StreakRecoveryCard({
  hasUnfinishedChapter,
  locale,
  labels,
}: {
  hasUnfinishedChapter: boolean;
  locale: string;
  labels: StreakRecoveryLabels;
}) {
  const broken = useSyncExternalStore(subscribe, getBroken, () => false);
  const longest = useSyncExternalStore(subscribe, getLongest, () => 0);
  const todayMinutes = useSyncExternalStore(subscribe, getTodayStudyMinutes, () => 0);
  const dueReviews = useSyncExternalStore(subscribe, getDueReviewCount, () => 0);
  const dismissed = useSyncExternalStore(subscribe, getDismissedToday, () => false);

  const suggestion = buildStreakRecovery({
    broken,
    longest,
    todayMinutes,
    dueReviews,
    hasUnfinishedChapter,
    locale,
  });

  if (!suggestion.show || dismissed) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, localDateStr());
      window.dispatchEvent(new Event("tb-streak"));
    } catch {
      // ignore
    }
  }

  return (
    <section
      aria-label={labels.title}
      className="rounded-2xl border border-[var(--border)] border-l-4 border-l-[var(--info)] bg-[var(--surface)] p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            <span aria-hidden>🌱 </span>
            {labels.title}
          </p>
          <p className="mt-1 text-sm text-muted leading-relaxed max-w-2xl">
            {labels.bodyTpl.replace("{n}", String(suggestion.longest))}
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="text-xs text-faint hover:text-muted transition"
        >
          {labels.later}
        </button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {suggestion.actions.map((action) => (
          <a
            key={action.kind}
            href={action.href}
            className={
              action.kind === suggestion.actions[0]?.kind
                ? "rounded-full bg-accent-strong hover:bg-accent text-white dark:text-[#06281c] font-semibold px-5 py-2 text-sm transition"
                : "rounded-full border border-[var(--border)] text-muted hover:border-accent/50 px-5 py-2 text-sm transition"
            }
          >
            {action.kind === "review"
              ? labels.reviewTpl.replace("{n}", String(dueReviews))
              : action.kind === "continue"
                ? labels.continueLabel
                : labels.replayLabel}
          </a>
        ))}
      </div>
    </section>
  );
}
