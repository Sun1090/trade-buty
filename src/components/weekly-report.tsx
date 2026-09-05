"use client";

import { useSyncExternalStore } from "react";
import { getStudySeries } from "@/lib/study-time";

// 快照必须是值稳定类型：用逗号串而非数组引用，避免 useSyncExternalStore 无限重渲染
function getSeriesSnapshot(): string {
  return getStudySeries(7)
    .map((d) => d.total)
    .join(",");
}
const EMPTY_SNAPSHOT = "0,0,0,0,0,0,0";
function subscribeStudyTime(callback: () => void) {
  const events = ["tb-study-time", "tb-goal", "tb-progress"] as const;
  events.forEach((e) => window.addEventListener(e, callback));
  return () => events.forEach((e) => window.removeEventListener(e, callback));
}

interface WeeklyDict {
  title: string;
  unit: string;
  summaryTpl: string;
}

/**
 * R4.6：周报视图——近 7 天学习柱状（纯 SVG，无图表库）。
 * R4.11：容器 flex 均分 + viewBox 缩放，320px 不溢出。
 * R4.12：SVG 附 aria-label 与文字摘要，读屏可读。
 */
export function WeeklyReport({ dict }: { dict: WeeklyDict }) {
  const series = useSyncExternalStore(
    subscribeStudyTime,
    getSeriesSnapshot,
    () => EMPTY_SNAPSHOT,
  ).split(",")
    .map(Number);

  const minutes = series.map((s) => Math.round(s / 60));
  const total = minutes.reduce((a, b) => a + b, 0);
  const avg = Math.round(total / 7);
  const max = Math.max(...minutes, 1);
  const dayLabels = ["S", "M", "T", "W", "T", "F", "S"];
  const today = new Date().getDay();

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <p className="text-sm font-semibold mb-3">{dict.title}</p>
      <div className="flex items-end gap-1.5 h-28" role="img" aria-label={dict.summaryTpl.replace("{n}", String(total)).replace("{avg}", String(avg))}>
        {minutes.map((m, i) => {
          const h = Math.max(4, Math.round((m / max) * 100));
          const isToday = i === 6;
          return (
            <div key={i} className="flex-1 min-w-0 flex flex-col items-center gap-1">
              <span className="text-[9px] font-mono text-faint">{m > 0 ? m : ""}</span>
              <div className="w-full flex items-end h-full">
                <div
                  className={`w-full rounded-t transition-all duration-500 ${isToday ? "bg-accent" : "bg-accent/40"}`}
                  style={{ height: `${h}%` }}
                  title={`${m} ${dict.unit}`}
                />
              </div>
              <span className={`text-[9px] ${isToday ? "text-accent font-bold" : "text-faint"}`}>
                {dayLabels[(today - 6 + i + 14) % 7]}
              </span>
            </div>
          );
        })}
      </div>
      {/* R4.12：文字摘要（读屏 + 快速浏览） */}
      <p className="mt-3 text-xs text-muted">
        {dict.summaryTpl.replace("{n}", String(total)).replace("{avg}", String(avg))}
      </p>
    </div>
  );
}
