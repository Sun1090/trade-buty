"use client";

import { useLocalProgress } from "@/components/use-local-progress";
import { readSummary } from "@/lib/learn-stats";

/**
 * 学习路线页：全局进度条——所有篇章总完成度。
 * 接收所有篇章 slug + docCount，汇总 localStorage 已读数。
 */
export function PathGlobalProgress({
  chapters,
}: {
  chapters: { slug: string; docCount: number }[];
}) {
  const progress = useLocalProgress();
  // R4.10：与统计页共用同一口径实现
  const { readDocs, totalDocs, doneChapters, overallPct: pct } = readSummary(
    (progress ?? {}) as Record<string, unknown[]>,
    chapters,
  );

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold">
          {readDocs}/{totalDocs} · {doneChapters}/{chapters.length}
        </p>
        <span className="font-mono text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-accent to-[var(--info)]">
          {pct}%
        </span>
      </div>
      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-accent-strong to-accent transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
