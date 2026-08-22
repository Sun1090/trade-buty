"use client";

import { useLocalProgress } from "@/components/use-local-progress";

export function GlobalReadStat({ totalDocs }: { totalDocs: number }) {
  const progress = useLocalProgress();
  const read = progress
    ? Object.values(progress).reduce((s, list) => s + list.length, 0)
    : null;

  if (read === null || read === 0) return null;

  return (
    <p className="mt-6 text-sm text-accent">
      📖 你已完成 {read} / {totalDocs} 篇 ·{" "}
      <span className="text-muted">继续加油</span>
    </p>
  );
}
