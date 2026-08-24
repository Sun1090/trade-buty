"use client";

import { useEffect, useState } from "react";
import { aggregateStats, getUnlockedBadges, BADGES, type LearnStats, type Badge } from "@/lib/learn-stats";
import { formatDuration } from "@/lib/reading-time";
import { DailyGoal } from "@/components/daily-goal";
import { StudyPlan } from "@/components/study-plan";
import { useLocalProgress } from "@/components/use-local-progress";
import { ActivityHeatmap } from "@/components/activity-heatmap";
import { RadarChart } from "@/components/radar-chart";

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
  goalSet: string;
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
    setStats(aggregateStats(chapters));
    const onChange = () => setStats(aggregateStats(chapters));
    window.addEventListener("tb-progress", onChange);
    window.addEventListener("tb-streak", onChange);
    return () => {
      window.removeEventListener("tb-progress", onChange);
      window.removeEventListener("tb-streak", onChange);
    };
  }, [chapters]);

  if (!stats) return null;

  const unlocked = getUnlockedBadges(stats);
  const locked = BADGES.filter((b) => !b.check(stats));

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
        todayRead={stats.readDocs}
        dict={{ label: dict.goalLabel, unit: dict.goalUnit, set: dict.goalSet }}
      />

      {/* 连续学习 + 准确率 + 阅读时长 */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <StatCard value={`🔥 ${stats.currentStreak}`} label={dict.streak} accent />
        <StatCard value={stats.avgQuizScore !== null ? `${stats.avgQuizScore}%` : "—"} label={dict.accuracy} />
        <StatCard value={stats.replayAccuracy !== null ? `${stats.replayAccuracy}%` : "—"} label={`${dict.replay} ${dict.accuracy}`} />
        <StatCard value={formatDuration(stats.totalReadingTime)} label={dict.readDocs} />
      </div>

      {/* 学习计划 */}
      <StudyPlan
        doneChapters={stats.readDocs > 0 ? chapters.filter((c) => (progress?.[c.slug]?.length ?? 0) >= c.docCount).map((c) => c.slug).slice(0, 5) : []}
        wrongChapters={[]}
        currentChapter=""
        dict={{ generate: locale === "en" ? "Generate plan" : "生成学习计划", generating: locale === "en" ? "Generating..." : "生成中…", title: locale === "en" ? "AI Study Plan" : "AI 学习计划" }}
      />

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
