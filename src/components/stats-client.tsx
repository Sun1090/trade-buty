"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

function useStreakShareUrl(
  payload: { currentStreak: number; longestStreak: number; locale: "zh" | "en" } | null,
): string | null {
  const [origin, setOrigin] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window !== "undefined") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOrigin(window.location.origin);
    }
  }, []);
  if (!payload || !origin) return null;
  return `${origin}/share/streak/${encodeStreak(payload)}`;
}


import { aggregateStats, getUnlockedBadges, BADGES, type LearnStats, type Badge } from "@/lib/learn-stats";
import { QUIZZES } from "@/lib/quizzes";
import { readQuizProgress } from "@/lib/quiz-store";
import { buildCourseCompletionTrend } from "@/lib/course-completion-trend";
import { buildLearningOverview, type LearningOverview } from "@/lib/learning-overview";
import { buildQuizScoreTrend } from "@/lib/quiz-score-trend";
import { buildWrongbookEfficiency } from "@/lib/wrongbook-efficiency";
import { buildReplayTimeTrend } from "@/lib/replay-time-trend";
import { buildNextSuggestion } from "@/lib/next-suggestion";
import { getStatsRangeDays, setStatsRangeDays, STATS_RANGE_OPTIONS } from "@/lib/stats-range";
import { getLastCloudSync } from "@/lib/cloud-sync-meta";
import { auditStatsConsistency } from "@/lib/stats-consistency";
import { dismissSyncConflicts, readSyncConflicts } from "@/lib/sync-conflicts";
import { buildStatsExport, downloadStatsExport } from "@/lib/stats-export";
import {
  DEFAULT_REMINDER_SETTINGS,
  getLastShownKey,
  getReminderSettings,
  markReminderShown,
  reminderPeriodKey,
  saveReminderSettings,
  shouldShowReminder,
  type ReminderCadence,
} from "@/lib/review-reminder";
import { getDailyGoalMin } from "@/lib/daily-goal";
import { buildWeeklySummary, getWeeklyGoalMin, setWeeklyGoalMin, WEEKLY_GOAL_TIERS, type WeeklySummaryInput } from "@/lib/weekly-summary";
import { getStudySeries } from "@/lib/study-time";
import { useAuth } from "@/components/auth-provider";
import { effectiveSrs, isSrsDue } from "@/lib/srs";
import { localDateStr } from "@/lib/date-utils";
import { readReplayHistory, readReplayBest } from "@/lib/replay-store";
import { readProgressCompletions } from "@/lib/progress";
import { readQuizAttemptLedger } from "@/lib/quiz-attempt-ledger";
import { readReviewAttemptLedger } from "@/lib/review-attempt-ledger";
import { readWrong } from "@/lib/wrongbook";
import { formatDuration } from "@/lib/reading-time";
import { DailyGoal } from "@/components/daily-goal";
import { StreakRecoveryCard } from "@/components/streak-recovery-card";
import { StudyPlan } from "@/components/study-plan";
import { useLocalProgress } from "@/components/use-local-progress";
import { ActivityHeatmap } from "@/components/activity-heatmap";
import { RadarChart } from "@/components/radar-chart";
import { WeekMiniBar } from "@/components/week-mini-bar";
import { WeeklyReport } from "@/components/weekly-report";
import { StreakShareCard } from "@/components/streak-share-card";
import { encodeStreak } from "@/lib/share-decode";
import type { StatsDict } from "@/lib/i18n-stats";
import { getRecentDays } from "@/lib/streak";

function subscribeConflictEvent(cb: () => void) {
  window.addEventListener("tb-sync-conflict", cb);
  return () => window.removeEventListener("tb-sync-conflict", cb);
}

interface WeeklySummaryCardDict {
  title: string;
  summaryTpl: string;
  goalLabel: string;
  goalAchieved: string;
  goalLeftTpl: string;
  unit: string;
}

function subscribeWeeklyGoal(cb: () => void) {
  const events = ["tb-weekly-goal", "tb-study-time", "tb-progress"] as const;
  events.forEach((e) => window.addEventListener(e, cb));
  return () => events.forEach((e) => window.removeEventListener(e, cb));
}

/** R12.19+R12.20：周度摘要卡（本地台账生成）+ 周目标档位编辑 */
function WeeklySummaryCard({ dict, input }: {
  dict: WeeklySummaryCardDict;
  input: Pick<WeeklySummaryInput, "dailySeconds" | "completions" | "quizAttempts" | "reviewAttempts" | "replayHistory">;
}) {
  const goalMin = useSyncExternalStore(subscribeWeeklyGoal, getWeeklyGoalMin, () => 90);
  const summary = buildWeeklySummary({ ...input, weeklyGoalMin: goalMin });
  const line = dict.summaryTpl
    .replace("{m}", String(summary.totalMinutes))
    .replace("{d}", String(summary.activeDays))
    .replace("{docs}", String(summary.completions))
    .replace("{quiz}", String(summary.quizAttempts))
    .replace("{review}", String(summary.reviews))
    .replace("{replay}", String(summary.replayRounds));

  return (
    <section aria-labelledby="weekly-summary-title" className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p id="weekly-summary-title" className="text-sm font-semibold">{dict.title}</p>
        <span className="text-xs text-faint">{summary.weekStart} ~ {summary.weekEnd}</span>
      </div>
      <p className="mt-2 text-sm text-muted leading-relaxed">{line}</p>
      <p className="mt-1 text-sm" aria-live="polite">
        {summary.goalAchieved ? (
          <span className="text-accent font-medium">{dict.goalAchieved}</span>
        ) : (
          <span className="text-muted">{dict.goalLeftTpl.replace("{m}", String(summary.remainingMin))}</span>
        )}
      </p>
      {/* R12.19：周目标可编辑（45/90/150 分钟，登录后云端同步） */}
      <div className="mt-3 flex items-center gap-2" role="group" aria-label={dict.goalLabel}>
        <span className="text-xs text-faint">{dict.goalLabel}</span>
        {WEEKLY_GOAL_TIERS.map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={goalMin === t}
            onClick={() => setWeeklyGoalMin(t)}
            className={`rounded-full border px-3 py-1 text-xs transition ${
              goalMin === t
                ? "border-accent bg-[var(--accent-dim)] text-accent font-medium"
                : "border-[var(--border)] text-muted hover:border-accent/50"
            }`}
          >
            {t} {dict.unit}
          </button>
        ))}
      </div>
    </section>
  );
}

/** R12.9：多设备冲突提示横幅（读取原始字符串作稳定快照，避免每次渲染新对象） */
function SyncConflictNotice({ labels }: { labels: { title: string; bodyTpl: string; dismiss: string } }) {
  const raw = useSyncExternalStore(
    subscribeConflictEvent,
    () => (typeof window === "undefined" ? null : localStorage.getItem("tb-sync-conflicts")),
    () => null,
  );
  const dismissedAt = useSyncExternalStore(
    subscribeConflictEvent,
    () => (typeof window === "undefined" ? null : localStorage.getItem("tb-sync-conflicts-dismissed")),
    () => null,
  );
  let record: ReturnType<typeof readSyncConflicts> = null;
  try {
    record = raw ? (JSON.parse(raw) as ReturnType<typeof readSyncConflicts>) : null;
  } catch {
    record = null;
  }
  if (!record || record.items.length === 0) return null;
  if (dismissedAt === String(record.at)) return null;

  return (
    <section aria-label={labels.title} className="rounded-2xl border border-[var(--info)]/40 bg-[var(--surface)] p-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold">🔄 {labels.title}</p>
        <p className="mt-1 text-sm text-muted leading-relaxed">
          {labels.bodyTpl.replace("{n}", String(record.items.length))}
        </p>
      </div>
      <button
        type="button"
        onClick={() => dismissSyncConflicts(record.at)}
        className="rounded-full border border-[var(--border)] px-4 py-1.5 text-xs text-muted hover:border-accent/50 transition"
      >
        {labels.dismiss}
      </button>
    </section>
  );
}

function StatCard({ value, label, accent }: { value: string | number; label: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-5 text-center ${accent ? "border-[var(--accent)]/40 bg-[var(--accent-dim)]" : "border-[var(--border)] bg-[var(--surface)]"}`}>
      <p className="font-mono text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-accent to-[var(--info)]">{value}</p>
      <p className="mt-1 text-xs text-faint">{label}</p>
    </div>
  );
}

export function StatsClient({
  chapters,
  dict,
  locale = "en",
}: {
  chapters: { slug: string; docCount: number; title?: string; docs?: { slug: string; title: string }[] }[];
  dict: StatsDict;
  locale?: string;
}) {
  const [stats, setStats] = useState<LearnStats | null>(null);
  const progress = useLocalProgress();
  const completions = typeof window === "undefined" ? {} : readProgressCompletions();
  const quizAttempts = typeof window === "undefined" ? {} : readQuizAttemptLedger();
  const quizProgress = typeof window === "undefined" || !stats
    ? {}
    : Object.fromEntries(
        Object.keys(QUIZZES).map((slug) => [
          slug,
          readQuizProgress(slug) ?? { best: 0, done: false },
        ]),
      );
  const rangeDays = useSyncExternalStore(
    (cb) => {
      window.addEventListener("tb-stats-range", cb);
      return () => window.removeEventListener("tb-stats-range", cb);
    },
    getStatsRangeDays,
    () => 7,
  );
  // R12.15–R12.17：复习提醒（频率/免打扰/周期去重，时钟即渲染环境时间）
  // 快照必须是值稳定类型（原始字符串），渲染期再解析，避免 useSyncExternalStore 无限重渲染
  const reminderSettingsRaw = useSyncExternalStore(
    (cb) => {
      window.addEventListener("tb-reminder", cb);
      return () => window.removeEventListener("tb-reminder", cb);
    },
    () => (typeof window === "undefined" ? null : localStorage.getItem("tb-review-reminder-settings")),
    () => null,
  );
  const reminderSettings = useMemo(() => getReminderSettings(), [reminderSettingsRaw]);
  const reminderLastShown = useSyncExternalStore(
    (cb) => {
      window.addEventListener("tb-reminder", cb);
      return () => window.removeEventListener("tb-reminder", cb);
    },
    () => getLastShownKey(),
    () => null,
  );
  // R12.8：数据来源标识（本机 vs 本机+云端、上次云端合并时间）
  const user = useAuth();
  const lastCloudSync = useSyncExternalStore(
    (cb) => {
      window.addEventListener("tb-cloud-sync", cb);
      return () => window.removeEventListener("tb-cloud-sync", cb);
    },
    getLastCloudSync,
    () => null,
  );
  const courseTrend = stats && progress
    ? buildCourseCompletionTrend({ chapters, progress, completions, days: rangeDays })
    : null;
  const quizTrend = stats && progress
    ? buildQuizScoreTrend({
        chapters: Object.keys(QUIZZES).map((slug) => ({ slug, questions: QUIZZES[slug].questions.length })),
        progress: quizProgress,
        attempts: quizAttempts,
        days: rangeDays,
      })
    : null;
  const wrongEntries = typeof window === "undefined" ? {} : readWrong();
  const reviewAttempts = typeof window === "undefined" ? {} : readReviewAttemptLedger();
  const reviewTrend = stats && progress
    ? buildWrongbookEfficiency({ wrongEntries, attempts: reviewAttempts, days: rangeDays })
    : null;
  const replayHistory = typeof window === "undefined" ? [] : readReplayHistory();
  const replayBestStreak = typeof window === "undefined" ? 0 : readReplayBest();
  const replayTrend = stats && progress
    ? buildReplayTimeTrend({ history: replayHistory, days: rangeDays })
    : null;
  // R12.7：下一步学习建议（本地数据推导，复习 > 新学 > 测验 > 回放）
  const dueReviewCount = typeof window === "undefined"
    ? 0
    : Object.values(wrongEntries).filter((entry) =>
        isSrsDue(effectiveSrs(entry).due, localDateStr()),
      ).length;
  const nextUnread = progress
    ? (() => {
        for (const chapter of chapters) {
          const read = new Set(progress[chapter.slug] ?? []);
          const unread = (chapter.docs ?? []).find((doc) => !read.has(doc.slug));
          if (unread) {
            return {
              chapter: chapter.slug,
              chapterTitle: chapter.title ?? chapter.slug,
              doc: unread.slug,
              docTitle: unread.title ?? unread.slug,
            };
          }
        }
        return null;
      })()
    : null;
  const pendingQuizChapter = progress
    ? (() => {
        for (const chapter of chapters) {
          if (chapter.docCount <= 0) continue;
          const readCount = (progress[chapter.slug] ?? []).length;
          if (readCount < chapter.docCount) continue;
          const quizEntry = quizProgress[chapter.slug];
          const quizDone = Boolean(quizEntry?.done) || (quizEntry?.best ?? 0) > 0;
          if (!quizDone) {
            return { chapter: chapter.slug, chapterTitle: chapter.title ?? chapter.slug };
          }
        }
        return null;
      })()
    : null;
  const nextSuggestion = stats && progress
    ? buildNextSuggestion({
        dueReviews: dueReviewCount,
        nextUnread,
        pendingQuizChapter,
        replayRounds: stats.replayRounds,
        locale,
      })
    : null;
  const overview: LearningOverview | null = stats && progress
    ? buildLearningOverview({
        chapters,
        progress,
        quizzesDone: stats.quizzesDone,
        totalQuizzes: stats.totalQuizzes,
        avgQuizScore: stats.avgQuizScore,
        replayRounds: stats.replayRounds,
        replayAccuracy: stats.replayAccuracy,
        totalStudySeconds: stats.totalStudySeconds,
        currentStreak: stats.currentStreak,
      })
    : null;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStats(aggregateStats(chapters));
    const onChange = () => setStats(aggregateStats(chapters));
    window.addEventListener("tb-progress", onChange);
    window.addEventListener("tb-streak", onChange);
    window.addEventListener("tb-study-time", onChange);
    return () => {
      window.removeEventListener("tb-progress", onChange);
      window.removeEventListener("tb-streak", onChange);
      window.removeEventListener("tb-study-time", onChange);
    };
  }, [chapters]);

  // R8.4 分享链接 URL（client-only）
  const streakShareUrl = useStreakShareUrl(
    stats && stats.currentStreak > 0
      ? {
          currentStreak: stats.currentStreak,
          longestStreak: stats.longestStreak,
          locale: locale === "en" ? "en" : "zh",
        }
      : null,
  );

  // R12.23：跨聚合器口径对账——开发/测试环境发现口径漂移即告警；生产构建摇树移除
  useEffect(() => {
    if (process.env.NODE_ENV === "production" || !stats || !overview) return;
    const issues = auditStatsConsistency({ overview, courseTrend, quizTrend, reviewTrend, replayTrend, stats });
    if (issues.length > 0) console.warn("[stats] 数据口径不一致:", issues);
  }, [stats, overview, courseTrend, quizTrend, reviewTrend, replayTrend]);

  if (!stats || !overview) return null;

  const unlocked = getUnlockedBadges(stats);
  const locked = BADGES.filter((b) => !b.check(stats));

  // R4.5：新用户空态——不给一片 0，给行动建议
  if (stats.overallPct === 0 && stats.totalStudySeconds === 0 && stats.currentStreak === 0) {
    return (
      <div className="rounded-2xl border border-[var(--accent)]/30 border-l-4 border-l-[var(--accent)] bg-gradient-to-br from-[var(--accent-dim)] to-transparent p-8 text-center">
        <p className="text-2xl" aria-hidden>🚀</p>
        <p className="mt-2 font-semibold">{dict.emptyTitle}</p>
        <p className="mt-2 text-sm text-muted leading-relaxed max-w-md mx-auto">{dict.emptyBody}</p>
        <a
          href={`/${locale}/path`}
          className="mt-5 inline-block rounded-full bg-accent-strong hover:bg-accent text-white dark:text-[#06281c] font-semibold px-6 py-2.5 text-sm transition"
        >
          {dict.emptyCta} →
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* R12.1 学习总览卡片 */}
      <section aria-labelledby="learning-overview-title" className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="learning-overview-title" className="text-base font-semibold">{dict.overviewTitle}</h2>
            <p className="mt-1 text-sm text-muted">{dict.overviewDesc}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg)] px-3 py-1 text-xs text-faint" aria-label={user ? dict.sourceCloud : dict.sourceLocal}>
              <span aria-hidden>●</span>
              {user ? dict.sourceCloud : dict.sourceLocal}
            </span>
            {user && lastCloudSync !== null && (
              <span className="text-[11px] text-faint">
                {dict.sourceSyncedTpl.replace(
                  "{t}",
                  new Date(lastCloudSync).toLocaleString(locale === "en" ? "en-US" : "zh-CN", {
                    month: "numeric",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  }),
                )}
              </span>
            )}
          </div>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4">
            <dt className="text-xs text-faint">{dict.overviewCourses}</dt>
            <dd className="mt-2 font-mono text-2xl font-bold">{overview.courses.readDocs}/{overview.courses.totalDocs}</dd>
            <dd className="mt-1 text-xs text-muted">{overview.courses.doneChapters}/{overview.courses.totalChapters} · {overview.courses.completionPct}%</dd>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4">
            <dt className="text-xs text-faint">{dict.overviewQuizzes}</dt>
            <dd className="mt-2 font-mono text-2xl font-bold">{overview.quizzes.done}/{overview.quizzes.total}</dd>
            <dd className="mt-1 text-xs text-muted">{overview.quizzes.bestPct === null ? "—" : `${overview.quizzes.bestPct}%`}</dd>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4">
            <dt className="text-xs text-faint">{dict.overviewReplay}</dt>
            <dd className="mt-2 font-mono text-2xl font-bold">{overview.replay.rounds}</dd>
            <dd className="mt-1 text-xs text-muted">{overview.replay.accuracyPct === null ? "—" : `${overview.replay.accuracyPct}%`}</dd>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4">
            <dt className="text-xs text-faint">{dict.overviewTime}</dt>
            <dd className="mt-2 font-mono text-2xl font-bold">{formatDuration(overview.engagement.totalStudySeconds)}</dd>
            <dd className="mt-1 text-xs text-muted">🔥 {overview.engagement.currentStreak}</dd>
          </div>
        </dl>
      </section>

      {/* R12.7：个性化下一步学习建议 */}
      {nextSuggestion && (
        <section aria-labelledby="next-suggestion-title" className="rounded-2xl border border-[var(--accent)]/30 bg-gradient-to-br from-[var(--accent-dim)] to-transparent p-5">
          <p id="next-suggestion-title" className="text-xs font-semibold uppercase tracking-wide text-accent">{dict.nextTitle}</p>
          <p className="mt-2 font-semibold">
            {nextSuggestion.kind === "review" && dict.nextDueReviewTpl.replace("{n}", String(nextSuggestion.count ?? 0))}
            {nextSuggestion.kind === "read" && dict.nextReadTpl
              .replace("{doc}", nextSuggestion.docTitle ?? "")
              .replace("{chapter}", nextSuggestion.chapterTitle ?? "")}
            {nextSuggestion.kind === "quiz" && dict.nextQuizTpl.replace("{chapter}", nextSuggestion.chapterTitle ?? "")}
            {nextSuggestion.kind === "replay" && dict.nextReplay}
            {nextSuggestion.kind === "explore" && dict.nextAllClear}
          </p>
          <a
            href={nextSuggestion.href}
            className="mt-4 inline-block rounded-full bg-accent-strong hover:bg-accent text-white dark:text-[#06281c] font-semibold px-6 py-2.5 text-sm transition"
          >
            →
          </a>
        </section>
      )}

      {/* R12.9：多设备同步冲突提示（自动合并后可关闭） */}
      <SyncConflictNotice
        labels={{
          title: dict.conflictTitle,
          bodyTpl: dict.conflictBodyTpl,
          dismiss: dict.conflictDismiss,
        }}
      />

      {/* R12.15–12.17：复习提醒横幅（本周期去重，可关闭） */}
      {shouldShowReminder({ settings: reminderSettings, dueCount: dueReviewCount, lastShownKey: reminderLastShown }) && (
        <section aria-label={dict.reminderTitle} className="rounded-2xl border border-[var(--accent)]/40 bg-[var(--accent-dim)]/60 p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold">⏰ {dict.reminderTitle}</p>
            <p className="mt-1 text-sm text-muted">{dict.reminderBodyTpl.replace("{n}", String(dueReviewCount))}</p>
          </div>
          <div className="flex items-center gap-2">
            <a href={`/${locale}/review`} className="rounded-full bg-accent-strong hover:bg-accent px-4 py-1.5 text-xs font-semibold text-white dark:text-[#06281c] transition">
              {dict.reminderCta}
            </a>
            <button
              type="button"
              onClick={() => {
                const key = reminderPeriodKey(reminderSettings);
                if (key) markReminderShown(key);
              }}
              className="rounded-full border border-[var(--border)] px-4 py-1.5 text-xs text-muted hover:border-accent/50 transition"
            >
              {dict.reminderLater}
            </button>
          </div>
        </section>
      )}

      {/* R12.10：时间范围筛选（作用于下面四组趋势） */}
      <div className="flex items-center justify-end gap-2" role="group" aria-label={dict.rangeLabel}>
        <span className="text-xs text-faint">{dict.rangeLabel}</span>
        {STATS_RANGE_OPTIONS.map((days) => (
          <button
            key={days}
            type="button"
            aria-pressed={rangeDays === days}
            onClick={() => setStatsRangeDays(days)}
            className={`rounded-full border px-3 py-1 text-xs transition ${
              rangeDays === days
                ? "border-accent bg-[var(--accent-dim)] text-accent font-medium"
                : "border-[var(--border)] text-muted hover:border-accent/50"
            }`}
          >
            {dict.rangeDaysTpl.replace("{n}", String(days))}
          </button>
        ))}
      </div>

      {/* R12.2：课程完成率趋势 */}
      <section aria-labelledby="course-completion-trend-title" className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <p id="course-completion-trend-title" className="text-xs font-semibold uppercase tracking-wide text-faint">{dict.trendTitle}</p>
        <p className="mt-2 text-sm text-muted leading-relaxed">{dict.trendDesc}</p>
        <div className="mt-4" role="img" aria-label={`${dict.rangeDaysTpl.replace("{n}", String(rangeDays))}: ${courseTrend!.summary.completionsInRange} ${dict.trendCompletions}, ${courseTrend!.summary.chaptersCompletedInRange} ${dict.trendNewChapters}`}>
          <div className={rangeDays > 7 ? "overflow-x-auto pb-1" : ""}>
          <div className="grid gap-2 sm:gap-3 items-end h-24" style={{ gridTemplateColumns: `repeat(${rangeDays}, minmax(0, 1fr))`, minWidth: rangeDays > 7 ? `${rangeDays * 2.2}rem` : undefined }}>
            {courseTrend!.days.map((day) => {
              const max = Math.max(1, ...courseTrend!.days.map((bucket) => bucket.completions));
              const height = day.completions > 0 ? Math.max(18, Math.round((day.completions / max) * 100)) : 4;
              return (
                <div key={day.date} className="flex flex-col items-center gap-1 min-h-0">
                  <span className="text-[10px] font-mono text-faint">{day.completions || ""}</span>
                  <div className="w-full rounded-t-md bg-[var(--accent)]/70" style={{ height: `${height}%` }} />
                  <span className="text-[10px] text-faint">{day.date.slice(5)}</span>
                </div>
              );
            })}
          </div>
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 text-center">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3"><dt className="text-xs text-faint">{dict.trendCompletions}</dt><dd className="mt-1 font-mono text-xl font-bold">{courseTrend!.summary.completionsInRange}</dd></div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3"><dt className="text-xs text-faint">{dict.trendNewChapters}</dt><dd className="mt-1 font-mono text-xl font-bold">{courseTrend!.summary.chaptersCompletedInRange}</dd></div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3"><dt className="text-xs text-faint">{dict.readDocs}</dt><dd className="mt-1 font-mono text-xl font-bold">{courseTrend!.latest.readDocs}/{courseTrend!.latest.totalDocs}</dd></div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3"><dt className="text-xs text-faint">{dict.overviewCourses}</dt><dd className="mt-1 font-mono text-xl font-bold">{courseTrend!.latest.completionPct}%</dd></div>
        </dl>
        {!courseTrend!.hasLedger && <p className="mt-3 text-xs text-muted">{dict.trendNoDates}</p>}
      </section>

      {/* R12.3：测验成绩趋势与最高分 */}
      <section aria-labelledby="quiz-score-trend-title" className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <p id="quiz-score-trend-title" className="text-xs font-semibold uppercase tracking-wide text-faint">{dict.quizTrendTitle}</p>
        <p className="mt-2 text-sm text-muted leading-relaxed">{dict.quizTrendDesc}</p>
        <div className="mt-4 grid h-24 items-end gap-2 overflow-x-auto pb-1" style={{ gridTemplateColumns: `repeat(${rangeDays}, minmax(0, 1fr))`, minWidth: rangeDays > 7 ? `${rangeDays * 2.2}rem` : undefined }} role="img" aria-label={`${dict.quizTrendTitle}: ${quizTrend!.summary.bestInRangeText ?? dict.quizTrendEmpty}`}>{quizTrend!.days.map((day) => {
          const height = Math.max(day.attempts > 0 ? 12 : 2, day.bestPct || 2);
          return (
            <div key={day.date} className="flex h-full flex-1 flex-col justify-end gap-1">
              <span className="text-[10px] font-mono text-faint">{day.bestScoreText ?? ""}</span>
              <div className="w-full rounded-t-md bg-[var(--info)]/75" style={{ height: `${height}%` }} />
              <span className="text-[10px] text-faint">{day.date.slice(5)}</span>
            </div>
          );
        })}</div>
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 text-center">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3"><dt className="text-xs text-faint">{dict.quizTrendAttempts}</dt><dd className="mt-1 font-mono text-xl font-bold">{quizTrend!.summary.attemptsInRange}</dd></div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3"><dt className="text-xs text-faint">{dict.quizBestInRange}</dt><dd className="mt-1 font-mono text-xl font-bold">{quizTrend!.summary.bestInRangeText ?? "-"}</dd></div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3"><dt className="text-xs text-faint">{dict.quizAvgScore}</dt><dd className="mt-1 font-mono text-xl font-bold">{quizTrend!.latest.avgPct === null ? "-" : `${quizTrend!.latest.avgPct}%`}</dd></div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3"><dt className="text-xs text-faint">{dict.quizzes}</dt><dd className="mt-1 font-mono text-xl font-bold">{quizTrend!.latest.doneQuizzes}/{quizTrend!.latest.totalQuizzes}</dd></div>
        </dl>
        {!quizTrend!.hasLedger && <p className="mt-3 text-xs text-muted">{dict.quizNoDates}</p>}
        {/* R12.11：分区空态 CTA——从未完成过任何测验时给出行动入口 */}
        {quizTrend!.latest.doneQuizzes === 0 && chapters[0] && (
          <p className="mt-3 text-xs text-muted">
            <a className="text-accent hover:underline" href={`/${locale}/knowledge/${chapters[0].slug}`}>{dict.ctaQuiz} →</a>
          </p>
        )}
      </section>

      {/* R12.4：错题复习效率 */}
      <section aria-labelledby="review-efficiency-title" className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <p id="review-efficiency-title" className="text-xs font-semibold uppercase tracking-wide text-faint">{dict.reviewTrendTitle}</p>
        <p className="mt-2 text-sm text-muted leading-relaxed">{dict.reviewTrendDesc}</p>
        <div className="mt-4 grid h-24 items-end gap-2 overflow-x-auto pb-1" style={{ gridTemplateColumns: `repeat(${rangeDays}, minmax(0, 1fr))`, minWidth: rangeDays > 7 ? `${rangeDays * 2.2}rem` : undefined }} role="img" aria-label={`${dict.reviewTrendTitle}: ${reviewTrend!.summary.reviewsInRange > 0 ? `${reviewTrend!.summary.correctInRange}/${reviewTrend!.summary.reviewsInRange}` : dict.reviewTrendEmpty}`}>{reviewTrend!.days.map((day) => {
          const max = Math.max(1, ...reviewTrend!.days.map((bucket) => bucket.reviews));
          const height = day.reviews > 0 ? Math.max(12, Math.round((day.reviews / max) * 100)) : 2;
          const correctHeight = day.reviews > 0 ? Math.round((day.correct / day.reviews) * 100) : 0;
          return (
            <div key={day.date} className="flex h-full flex-1 flex-col justify-end gap-1">
              <span className="text-[10px] font-mono text-faint">{day.reviews > 0 ? `${day.correct}/${day.reviews}` : ""}</span>
              <div className="relative w-full rounded-t-md bg-[var(--accent)]/30" style={{ height: `${height}%` }}>
                {correctHeight > 0 && <div className="absolute inset-x-0 bottom-0 rounded-t-md bg-[var(--accent)]/80" style={{ height: `${correctHeight}%` }} />}
              </div>
              <span className="text-[10px] text-faint">{day.date.slice(5)}</span>
            </div>
          );
        })}</div>
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 text-center">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3"><dt className="text-xs text-faint">{dict.reviewTrendReviews}</dt><dd className="mt-1 font-mono text-xl font-bold">{reviewTrend!.summary.reviewsInRange}</dd></div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3"><dt className="text-xs text-faint">{dict.reviewTrendAccuracy}</dt><dd className="mt-1 font-mono text-xl font-bold">{reviewTrend!.summary.accuracyPct === null ? "-" : `${reviewTrend!.summary.accuracyPct}%`}</dd></div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3"><dt className="text-xs text-faint">{dict.reviewTrendMastered}</dt><dd className="mt-1 font-mono text-xl font-bold">{reviewTrend!.summary.masteredInRange}</dd></div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3"><dt className="text-xs text-faint">{dict.reviewTrendDue}</dt><dd className="mt-1 font-mono text-xl font-bold">{reviewTrend!.latest.dueToday}/{reviewTrend!.latest.pending}</dd></div>
        </dl>
        {!reviewTrend!.hasLedger && <p className="mt-3 text-xs text-muted">{dict.reviewNoDates}</p>}
        {/* R12.11：错题本为空时引导先去做测验收集错题 */}
        {reviewTrend!.latest.pending === 0 && reviewTrend!.summary.reviewsInRange === 0 && chapters[0] && (
          <p className="mt-3 text-xs text-muted">
            <a className="text-accent hover:underline" href={`/${locale}/knowledge/${chapters[0].slug}`}>{dict.ctaReview} →</a>
          </p>
        )}
      </section>

      {/* R12.5：回放练习时长 */}
      <section aria-labelledby="replay-time-trend-title" className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <p id="replay-time-trend-title" className="text-xs font-semibold uppercase tracking-wide text-faint">{dict.replayTrendTitle}</p>
        <p className="mt-2 text-sm text-muted leading-relaxed">{dict.replayTrendDesc}</p>
        <div className="mt-4 grid h-24 items-end gap-2 overflow-x-auto pb-1" style={{ gridTemplateColumns: `repeat(${rangeDays}, minmax(0, 1fr))`, minWidth: rangeDays > 7 ? `${rangeDays * 2.2}rem` : undefined }} role="img" aria-label={`${dict.replayTrendTitle}: ${replayTrend!.summary.roundsInRange > 0 ? `${replayTrend!.summary.roundsInRange}` : dict.replayTrendEmpty}`}>{replayTrend!.days.map((day) => {
          const max = Math.max(1, ...replayTrend!.days.map((bucket) => bucket.rounds));
          const height = day.rounds > 0 ? Math.max(12, Math.round((day.rounds / max) * 100)) : 2;
          return (
            <div key={day.date} className="flex h-full flex-1 flex-col justify-end gap-1">
              <span className="text-[10px] font-mono text-faint">{day.rounds > 0 ? (day.durationSec > 0 ? formatDuration(day.durationSec) : `${day.rounds}`) : ""}</span>
              <div className="w-full rounded-t-md bg-[var(--info)]/60" style={{ height: `${height}%` }} />
              <span className="text-[10px] text-faint">{day.date.slice(5)}</span>
            </div>
          );
        })}</div>
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 text-center">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3"><dt className="text-xs text-faint">{dict.replayTrendRounds}</dt><dd className="mt-1 font-mono text-xl font-bold">{replayTrend!.summary.roundsInRange}</dd></div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3"><dt className="text-xs text-faint">{dict.replayTrendTime}</dt><dd className="mt-1 font-mono text-xl font-bold">{replayTrend!.summary.durationInRangeSec > 0 ? formatDuration(replayTrend!.summary.durationInRangeSec) : "-"}</dd></div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3"><dt className="text-xs text-faint">{dict.replayTrendAvg}</dt><dd className="mt-1 font-mono text-xl font-bold">{replayTrend!.summary.avgSecInRange === null ? "-" : formatDuration(replayTrend!.summary.avgSecInRange)}</dd></div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3"><dt className="text-xs text-faint">{dict.replayTrendBestStreak}</dt><dd className="mt-1 font-mono text-xl font-bold">{Math.max(replayBestStreak, replayTrend!.allTime.bestStreak)}</dd></div>
        </dl>
        {replayTrend!.hasHistory && !replayTrend!.hasDurations && <p className="mt-3 text-xs text-muted">{dict.replayNoDurations}</p>}
        {/* R12.11：从未做过回放时给出入口 */}
        {replayTrend!.allTime.totalRounds === 0 && (
          <p className="mt-3 text-xs text-muted">
            <a className="text-accent hover:underline" href={`/${locale}/replay`}>{dict.ctaReplay} →</a>
          </p>
        )}
      </section>

      {/* 详细统计概览 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard value={`${stats.overallPct}%`} label={dict.overall} accent />
        <StatCard value={`${stats.readDocs}/${stats.totalDocs}`} label={dict.readDocs} />
        <StatCard value={`${stats.doneChapters}/${stats.totalChapters}`} label={dict.chapters} />
        <StatCard value={stats.currentWrong} label={dict.wrong} />
        <StatCard value={`${stats.quizzesDone}/${stats.totalQuizzes}`} label={dict.quizzes} />
        <StatCard value={stats.replayRounds} label={dict.replay} />
      </div>

      {/* R12.12：版本化数据导出（本地生成，不上传） */}
      <section aria-labelledby="stats-export-title" className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p id="stats-export-title" className="text-xs font-semibold uppercase tracking-wide text-faint">{dict.dataExportTitle}</p>
          <p className="mt-1 text-xs text-muted leading-relaxed">{dict.dataExportDesc}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            const payload = buildStatsExport({
              locale,
              courses: overview.courses,
              quizzes: overview.quizzes,
              replay: {
                rounds: overview.replay.rounds,
                accuracyPct: overview.replay.accuracyPct,
                bestStreak: Math.max(replayBestStreak, replayTrend!.allTime.bestStreak),
              },
              review: {
                pending: reviewTrend!.latest.pending,
                dueToday: reviewTrend!.latest.dueToday,
                overdue: reviewTrend!.latest.overdue,
              },
              engagement: {
                totalStudySeconds: overview.engagement.totalStudySeconds,
                currentStreak: overview.engagement.currentStreak,
                longestStreak: stats.longestStreak,
              },
              goals: { dailyGoalMinutes: getDailyGoalMin() },
            });
            downloadStatsExport(payload);
          }}
          className="rounded-full border border-accent/40 bg-[var(--accent-dim)] px-4 py-1.5 text-xs font-medium text-accent hover:border-accent transition"
        >
          {dict.dataExportBtn}
        </button>
      </section>

      {/* 每日目标 */}
      <DailyGoal
        dict={{
          label: dict.goalLabel,
          unit: dict.goalMinUnit,
          set: dict.goalSet,
          reassureTpl: dict.streakReassureTpl,
        }}
      />

      {/* R12.15/R12.16：复习提醒设置（频率 + 免打扰窗口） */}
      <section aria-labelledby="reminder-settings-title" className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <p id="reminder-settings-title" className="text-sm font-semibold">{dict.reminderSettingsTitle}</p>
        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-3">
          <label className="flex items-center gap-2 text-xs text-muted">
            {dict.reminderCadenceLabel}
            <select
              value={reminderSettings.cadence}
              onChange={(e) => saveReminderSettings({ ...reminderSettings, cadence: e.target.value as ReminderCadence })}
              className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-xs"
              aria-label={dict.reminderCadenceLabel}
            >
              <option value="off">{dict.reminderCadenceOff}</option>
              <option value="daily">{dict.reminderCadenceDaily}</option>
              <option value="weekly">{dict.reminderCadenceWeekly}</option>
            </select>
          </label>
          <span className="flex items-center gap-2 text-xs text-muted">
            {dict.reminderDndLabel}
            <select
              value={reminderSettings.dndStartHour}
              onChange={(e) => saveReminderSettings({ ...reminderSettings, dndStartHour: Number(e.target.value) })}
              className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-xs"
              aria-label={`${dict.reminderDndLabel} start`}
            >
              {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{h}:00</option>)}
            </select>
            →
            <select
              value={reminderSettings.dndEndHour}
              onChange={(e) => saveReminderSettings({ ...reminderSettings, dndEndHour: Number(e.target.value) })}
              className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-xs"
              aria-label={`${dict.reminderDndLabel} end`}
            >
              {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{h}:00</option>)}
            </select>
          </span>
        </div>
      </section>

      {/* R12.6：断档恢复提示（断签且今日未破零时出现） */}
      <StreakRecoveryCard
        hasUnfinishedChapter={chapters.some((c) => (progress?.[c.slug]?.length ?? 0) < c.docCount)}
        locale={locale}
        labels={{
          title: dict.recoveryTitle,
          bodyTpl: dict.recoveryBodyTpl,
          reviewTpl: dict.recoveryReviewTpl,
          continueLabel: dict.recoveryContinue,
          replayLabel: dict.recoveryReplay,
          later: dict.recoveryLater,
        }}
      />

      {/* R4.6：近 7 天周报 */}
      <WeeklyReport dict={{ title: dict.weeklyTitle, unit: dict.goalMinUnit, summaryTpl: dict.weeklySummaryTpl }} />

      {/* R12.19 每周目标可编辑 + R12.20 周度学习摘要（本地生成） */}
      <WeeklySummaryCard
        dict={{
          title: dict.weekSummaryTitle,
          summaryTpl: dict.weekSummaryTpl,
          goalLabel: dict.weekGoalLabel,
          goalAchieved: dict.weekGoalAchieved,
          goalLeftTpl: dict.weekGoalLeftTpl,
          unit: dict.goalMinUnit,
        }}
        input={{
          dailySeconds: getStudySeries(7).map((d) => d.total),
          completions,
          quizAttempts,
          reviewAttempts,
          replayHistory,
        }}
      />

      {/* 连续学习 + 准确率 + 学习时长 */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div>
          <StatCard value={`🔥 ${stats.currentStreak}`} label={dict.streak} accent />
          {/* R8.3 连续学习分享卡：currentStreak=0 时按钮自动禁用 */}
          <div className="mt-3">
            <StreakShareCard
              currentStreak={stats.currentStreak}
              longestStreak={stats.longestStreak}
              recentDays={getRecentDays()}
              locale={locale === "en" ? "en" : "zh"}
              labels={{
                share: dict.shareStreak,
                previewAlt: dict.previewAlt,
                download: dict.download,
                copyLink: dict.copyLink,
                copiedLink: dict.copiedLink,
                  downloadFailed: dict.downloadFailed,
              }}
              shareUrl={streakShareUrl ?? undefined}
            />
          </div>
        </div>
        <StatCard value={stats.avgQuizScore !== null ? `${stats.avgQuizScore}%` : "—"} label={dict.accuracy} />
        <StatCard value={stats.replayAccuracy !== null ? `${stats.replayAccuracy}%` : "—"} label={`${dict.replay} ${dict.accuracy}`} />
        <StatCard value={formatDuration(stats.totalStudySeconds)} label={dict.totalStudyTime} />
      </div>

      {/* 学习计划 */}
      <StudyPlan
        doneChapters={stats.readDocs > 0 ? chapters.filter((c) => (progress?.[c.slug]?.length ?? 0) >= c.docCount).map((c) => c.slug).slice(0, 5) : []}
        wrongChapters={[]}
        currentChapter=""
        dict={{ generate: locale === "en" ? "Generate plan" : "生成学习计划", generating: locale === "en" ? "Generating..." : "生成中…", title: locale === "en" ? "AI Study Plan" : "AI 学习计划" }}
      />

      {/* 近 7 天迷你条 */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-faint mb-3">
          {dict.trendRange}
        </p>
        <WeekMiniBar locale={locale} />
      </div>

      {/* 热力图 + 雷达图 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ActivityHeatmap
          label={locale === "en" ? "Activity calendar" : "学习日历"}
          emptyLabel={locale === "en" ? "No activity yet" : "还没有学习记录"}
          locale={locale === "en" ? "en" : "zh"}
        />
        <RadarChart
          label={locale === "en" ? "Mastery radar" : "掌握度雷达"}
          emptyLabel={locale === "en" ? "Finish quizzes to see radar" : "完成测验后查看掌握度"}
        />
      </div>

      {/* 成就徽章 */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-faint mb-4">
          {dict.badges} · {unlocked.length}/{BADGES.length}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {unlocked.map((b: Badge) => (
            <div
              key={b.id}
              className="rounded-2xl border border-[var(--accent)]/40 bg-gradient-to-br from-[var(--accent-dim)] to-transparent p-4 text-center"
            >
              <p className="text-3xl" aria-hidden>{b.icon}</p>
              <p className="mt-2 text-sm font-semibold">{b.name}</p>
              <p className="mt-1 text-xs text-faint">{b.desc}</p>
            </div>
          ))}
          {locked.map((b: Badge) => (
            <div
              key={b.id}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-center opacity-40"
            >
              <p className="text-3xl" aria-hidden>🔒</p>
              <p className="mt-2 text-sm font-semibold">{b.name}</p>
              <p className="mt-1 text-xs text-faint">{b.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
