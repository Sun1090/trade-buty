"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { getDailyGoalMin, setDailyGoalMin, getTodayStudyMinutes, GOAL_TIERS } from "@/lib/daily-goal";
import { getStreakBreak } from "@/lib/streak";

function subscribeGoal(callback: () => void) {
  window.addEventListener("tb-goal", callback);
  return () => window.removeEventListener("tb-goal", callback);
}

interface GoalDict {
  label: string;
  unit: string;
  set: string;
  reassureTpl: string;
}

/** R4.1：每日目标（分钟三档）+ R4.3 断签挽回提示 + R4.4 完成庆祝动效 */
export function DailyGoal({ dict }: { dict: GoalDict }) {
  const goal = useSyncExternalStore(
    subscribeGoal,
    getDailyGoalMin,
    () => 15, // SSR/SSG snapshot before client hydration.
  );
  const [todayMinutes, setTodayMinutes] = useState(0);
  const [breakInfo, setBreakInfo] = useState<{ broken: boolean; longest: number } | null>(null);

  // 台账每次写入都会派发 tb-study-time（阅读计时 5s 一个 tick）
  useEffect(() => {
    const refresh = () => setTodayMinutes(getTodayStudyMinutes());
    refresh();
    setBreakInfo(getStreakBreak());
    window.addEventListener("tb-study-time", refresh);
    window.addEventListener("tb-progress", refresh);
    return () => {
      window.removeEventListener("tb-study-time", refresh);
      window.removeEventListener("tb-progress", refresh);
    };
  }, []);

  const pct = goal > 0 ? Math.min(100, Math.round((todayMinutes / goal) * 100)) : 0;
  const done = todayMinutes >= goal;

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold">{dict.label}</p>
        {/* R4.4：目标达成庆祝——轻量 CSS（脉冲徽标），不引入动画库 */}
        {done && (
          <span className="text-xs font-medium text-accent animate-pulse">🎉</span>
        )}
      </div>
      <div className="flex items-baseline gap-2 mb-2">
        <span
          className={`font-mono text-2xl font-bold ${done ? "text-accent" : "text-transparent bg-clip-text bg-gradient-to-r from-accent to-[var(--info)]"}`}
        >
          {todayMinutes}
        </span>
        <span className="text-sm text-muted">/ {goal} {dict.unit}</span>
        <span className="ml-auto font-mono text-sm text-faint">
          {done ? "✓ " : ""}{pct}%
        </span>
      </div>
      <div
        className={`h-2 rounded-full overflow-hidden ${done ? "bg-accent/30" : "bg-white/10"}`}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${done ? "bg-accent" : "bg-gradient-to-r from-accent-strong to-accent"}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* 档位切换（R4.1：5/15/30 分钟） */}
      <div className="mt-3 flex items-center gap-2">
        <span className="text-xs text-faint">{dict.set}</span>
        {GOAL_TIERS.map((t) => (
          <button
            key={t}
            onClick={() => setDailyGoalMin(t)}
            className={`rounded-full border px-3 py-1 text-xs transition ${
              goal === t
                ? "border-accent bg-[var(--accent-dim)] text-accent font-medium"
                : "border-[var(--border)] text-muted hover:border-accent/50"
            }`}
          >
            {t} {dict.unit}
          </button>
        ))}
      </div>

      {/* R4.3：断签挽回提示（说明事实，不伪造连续天数） */}
      {breakInfo?.broken && !done && (
        <p className="mt-3 text-xs text-muted leading-relaxed">
          💡 {dict.reassureTpl.replace("{n}", String(breakInfo.longest))}
        </p>
      )}
    </div>
  );
}
