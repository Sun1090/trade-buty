"use client";

import { useEffect, useState } from "react";

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
  chapters: { slug: string; docCount: number }[];
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
  const courseTrend = stats && progress
    ? buildCourseCompletionTrend({ chapters, progress, completions, days: 7 })
    : null;
  const quizTrend = stats && progress
    ? buildQuizScoreTrend({
        chapters: Object.keys(QUIZZES).map((slug) => ({ slug, questions: QUIZZES[slug].questions.length })),
        progress: quizProgress,
        attempts: quizAttempts,
        days: 7,
      })
    : null;
  const wrongEntries = typeof window === "undefined" ? {} : readWrong();
  const reviewAttempts = typeof window === "undefined" ? {} : readReviewAttemptLedger();
  const reviewTrend = stats && progress
    ? buildWrongbookEfficiency({ wrongEntries, attempts: reviewAttempts, days: 7 })
    : null;
  const replayHistory = typeof window === "undefined" ? [] : readReplayHistory();
  const replayBestStreak = typeof window === "undefined" ? 0 : readReplayBest();
  const replayTrend = stats && progress
    ? buildReplayTimeTrend({ history: replayHistory, days: 7 })
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
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg)] px-3 py-1 text-xs text-faint" aria-label={dict.overviewLocal}>
            <span aria-hidden>●</span>
            {dict.overviewLocal}
          </span>
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

      {/* R12.2：课程完成率趋势 */}
      <section aria-labelledby="course-completion-trend-title" className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <p id="course-completion-trend-title" className="text-xs font-semibold uppercase tracking-wide text-faint">{dict.trendTitle}</p>
        <p className="mt-2 text-sm text-muted leading-relaxed">{dict.trendDesc}</p>
        <div className="mt-4" role="img" aria-label={`${dict.trendRange}: ${courseTrend!.summary.completionsInRange} ${dict.trendCompletions}, ${courseTrend!.summary.chaptersCompletedInRange} ${dict.trendNewChapters}`}>
          <div className="grid grid-cols-7 gap-2 sm:gap-3 items-end h-24">
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
        <div className="mt-4 grid h-24 items-end gap-2" role="img" aria-label={`${dict.quizTrendTitle}: ${quizTrend!.summary.bestInRangeText ?? dict.quizTrendEmpty}`}>{quizTrend!.days.map((day) => {
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
      </section>

      {/* R12.4：错题复习效率 */}
      <section aria-labelledby="review-efficiency-title" className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <p id="review-efficiency-title" className="text-xs font-semibold uppercase tracking-wide text-faint">{dict.reviewTrendTitle}</p>
        <p className="mt-2 text-sm text-muted leading-relaxed">{dict.reviewTrendDesc}</p>
        <div className="mt-4 grid h-24 items-end gap-2" role="img" aria-label={`${dict.reviewTrendTitle}: ${reviewTrend!.summary.reviewsInRange > 0 ? `${reviewTrend!.summary.correctInRange}/${reviewTrend!.summary.reviewsInRange}` : dict.reviewTrendEmpty}`}>{reviewTrend!.days.map((day) => {
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
      </section>

      {/* R12.5：回放练习时长 */}
      <section aria-labelledby="replay-time-trend-title" className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <p id="replay-time-trend-title" className="text-xs font-semibold uppercase tracking-wide text-faint">{dict.replayTrendTitle}</p>
        <p className="mt-2 text-sm text-muted leading-relaxed">{dict.replayTrendDesc}</p>
        <div className="mt-4 grid h-24 items-end gap-2" role="img" aria-label={`${dict.replayTrendTitle}: ${replayTrend!.summary.roundsInRange > 0 ? `${replayTrend!.summary.roundsInRange}` : dict.replayTrendEmpty}`}>{replayTrend!.days.map((day) => {
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

      {/* 每日目标 */}
      <DailyGoal
        dict={{
          label: dict.goalLabel,
          unit: dict.goalMinUnit,
          set: dict.goalSet,
          reassureTpl: dict.streakReassureTpl,
        }}
      />

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
