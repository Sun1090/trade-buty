"use client";

import { useEffect, useState } from "react";
import { getCurrentStreak, readStreak } from "@/lib/streak";

/** 连续学习天数徽章：首页显示当前连续天数 + 历史最长 */
export function StreakBadge({ labels }: { labels: { current: string; longest: string; days: string } }) {
  const [streak, setStreak] = useState(0);
  const [longest, setLongest] = useState(0);

  useEffect(() => {
    function update() {
      setStreak(getCurrentStreak());
      setLongest(readStreak().longest);
    }
    update();
    window.addEventListener("tb-streak", update);
    window.addEventListener("tb-progress", update);
    return () => {
      window.removeEventListener("tb-streak", update);
      window.removeEventListener("tb-progress", update);
    };
  }, []);

  if (streak === 0 && longest === 0) return null;

  return (
    <div className="inline-flex items-center gap-3 rounded-full border border-[var(--accent)]/30 bg-[var(--accent-dim)] px-4 py-2">
      <span className="text-lg" aria-hidden>🔥</span>
      <div className="flex items-baseline gap-1.5">
        <span className="font-mono text-lg font-bold text-accent">{streak}</span>
        <span className="text-xs text-muted">{labels.days}</span>
      </div>
      {longest > streak && (
        <span className="text-xs text-faint border-l border-[var(--border)] pl-3">
          {labels.longest} {longest}
        </span>
      )}
    </div>
  );
}
