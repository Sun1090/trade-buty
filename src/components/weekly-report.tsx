"use client";

import { useSyncExternalStore } from "react";
import { getStudySeries, studyMinutes } from "@/lib/study-time";
import { WEEK_WINDOW_DAYS } from "@/lib/weekly-summary";

// 窗口长度只有一个主人：`WEEK_WINDOW_DAYS`（住在 `weekly-summary.ts`）。那句注释此前写着
// 「摘要、周目标、柱状图共用这一个数」，而柱状图这边一处都没读它——把常量改成 14，同一屏的
// 标题会变成「近 14 天」，柱子照旧画 7 根、日均照旧除以 7，没有一条测试会红。
// 快照必须是值稳定类型：用逗号串而非数组引用，避免 useSyncExternalStore 无限重渲染
function getSeriesSnapshot(): string {
  return getStudySeries(WEEK_WINDOW_DAYS)
    .map((d) => d.total)
    .join(",");
}
const EMPTY_SNAPSHOT = Array.from({ length: WEEK_WINDOW_DAYS }, () => "0").join(",");
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

  // 秒→分钟只有 studyMinutes 一个算法（与周度摘要、日目标同一份）：整周合计向下取整，
  // 单日也不被抬成「1 分钟」，否则同一页两张卡会对同一段时间报两个分钟数。
  const minutes = series.map((s) => studyMinutes(s));
  const total = studyMinutes(series.reduce((a, b) => a + b, 0));
  const avg = Math.round(total / WEEK_WINDOW_DAYS);
  const max = Math.max(...minutes, 1);
  const dayLabels = ["S", "M", "T", "W", "T", "F", "S"];
  const today = new Date().getDay();

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <p className="text-sm font-semibold mb-3">{dict.title}</p>
      <div className="flex items-end gap-1.5 h-28" role="img" aria-label={dict.summaryTpl.replace("{n}", String(total)).replace("{avg}", String(avg))}>
        {minutes.map((m, i) => {
          const h = Math.max(4, Math.round((m / max) * 100));
          const isToday = i === WEEK_WINDOW_DAYS - 1;
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
                {dayLabels[(((today - (WEEK_WINDOW_DAYS - 1) + i) % 7) + 7) % 7]}
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
