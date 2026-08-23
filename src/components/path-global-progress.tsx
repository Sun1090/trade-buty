"use client";

import { useLocalProgress } from "@/components/use-local-progress";

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
  const totalDocs = chapters.reduce((s, c) => s + c.docCount, 0);
  const readDocs = chapters.reduce(
    (s, c) => s + (progress?.[c.slug]?.length ?? 0),
    0,
  );
  const pct = totalDocs > 0 ? Math.round((readDocs / totalDocs) * 100) : 0;
  const doneChapters = chapters.filter(
    (c) => (progress?.[c.slug]?.length ?? 0) >= c.docCount,
  ).length;

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
