"use client";

import { useState, useSyncExternalStore } from "react";
import { getDailyGoal, setDailyGoal } from "@/lib/daily-goal";

function subscribeGoal(callback: () => void) {
  window.addEventListener("tb-goal", callback);
  return () => window.removeEventListener("tb-goal", callback);
}

interface GoalDict {
  label: string;
  unit: string;
  set: string;
}

/** 每日目标小组件：显示今日目标 + 完成数，可调整 */
export function DailyGoal({
  todayRead,
  dict,
}: {
  todayRead: number;
  dict: GoalDict;
}) {
  const goal = useSyncExternalStore(
    subscribeGoal,
    getDailyGoal,
    () => 3, // SSR/SSG snapshot before client hydration.
  );
  const [editing, setEditing] = useState(false);

  const pct = goal > 0 ? Math.min(100, Math.round((todayRead / goal) * 100)) : 0;
  const done = todayRead >= goal;

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold">
          {dict.label}
          {done && <span className="ml-2 text-accent">✓</span>}
        </p>
        <button
          onClick={() => setEditing((v) => !v)}
          className="text-xs text-faint hover:text-accent transition"
        >
          {dict.set}
        </button>
      </div>
      {editing ? (
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={20}
            defaultValue={goal}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (!Number.isNaN(v)) setDailyGoal(v);
            }}
            className="w-16 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-center outline-none focus:border-accent/50"
          />
          <span className="text-xs text-faint">{dict.unit}</span>
          <button
            onClick={() => { setDailyGoal(goal); setEditing(false); }}
            className="ml-auto rounded-full bg-accent-strong hover:bg-accent text-white dark:text-[#06281c] font-medium px-4 py-1.5 text-xs transition"
          >
            ✓
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="font-mono text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-accent to-[var(--info)]">
              {todayRead}
            </span>
            <span className="text-sm text-muted">/ {goal} {dict.unit}</span>
            <span className="ml-auto font-mono text-sm text-faint">{pct}%</span>
          </div>
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${done ? "bg-accent" : "bg-gradient-to-r from-accent-strong to-accent"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </>
      )}
    </div>
  );
}
