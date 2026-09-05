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
import { formatDuration } from "@/lib/reading-time";
import { DailyGoal } from "@/components/daily-goal";
import { StudyPlan } from "@/components/study-plan";
import { useLocalProgress } from "@/components/use-local-progress";
import { ActivityHeatmap } from "@/components/activity-heatmap";
import { RadarChart } from "@/components/radar-chart";
import { WeekMiniBar } from "@/components/week-mini-bar";
import { WeeklyReport } from "@/components/weekly-report";
import { StreakShareCard } from "@/components/streak-share-card";
import { encodeStreak } from "@/lib/share-decode";
import { getRecentDays } from "@/lib/streak";

interface StatsDict {
  title: string;
  subtitle: string;
  readDocs: string;
  chapters: string;
  wrong: string;
  quizzes: string;
  replay: string;
  streak: string;
  accuracy: string;
  badges: string;
  noBadges: string;
  overall: string;
  goalLabel: string;
  goalUnit: string;
  goalMinUnit: string;
  goalSet: string;
  streakReassureTpl: string;
  shareStreak: string;
  previewStreak: string;
  download: string;
  previewAlt: string;
  copyLink: string;
  copiedLink: string;
  totalStudyTime: string;
  weeklyTitle: string;
  weeklySummaryTpl: string;
  emptyTitle: string;
  emptyBody: string;
  emptyCta: string;
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
  chapters: { slug: string; docCount: number }[];
  dict: StatsDict;
  locale?: string;
}) {
  const [stats, setStats] = useState<LearnStats | null>(null);
  const progress = useLocalProgress();

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

  if (!stats) return null;

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
      {/* 概览卡片 */}
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
          {locale === "en" ? "Last 7 days" : "近 7 天"}
        </p>
        <WeekMiniBar locale={locale} />
      </div>

      {/* 热力图 + 雷达图 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ActivityHeatmap
          label={locale === "en" ? "Activity calendar" : "学习日历"}
          emptyLabel={locale === "en" ? "No activity yet" : "还没有学习记录"}
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
