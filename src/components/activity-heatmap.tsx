"use client";

import { useEffect, useState } from "react";
import { readActivityDates } from "@/lib/activity-calendar";

const WEEKS = 26; // 最近半年
const DAYS = 7;

/** 学习活动热力图：GitHub 贡献图风格（SVG） */
export function ActivityHeatmap({ label, emptyLabel }: { label: string; emptyLabel: string }) {
  const [dates, setDates] = useState<string[]>([]);

  useEffect(() => {
    const update = () => setDates(readActivityDates());
    update();
    window.addEventListener("tb-streak", update);
    return () => window.removeEventListener("tb-streak", update);
  }, []);

  const activeSet = new Set(dates);
  // 计算最近 N 周的日期网格
  const cellMap: Map<string, number> = new Map();
  const today = new Date();
  for (let week = WEEKS - 1; week >= 0; week--) {
    for (let day = 0; day < DAYS; day++) {
      const d = new Date(today);
      d.setDate(d.getDate() - (week * DAYS + (DAYS - 1 - day)));
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      cellMap.set(key, activeSet.has(key) ? 1 : 0);
    }
  }

  const W = WEEKS * 12;
  const H = DAYS * 12;
  const activeCount = activeSet.size;

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-faint mb-3">
        {label} · {activeCount} {activeCount <= 1 ? "day" : "days"}
      </p>
      {activeCount === 0 ? (
        <p className="text-sm text-faint">{emptyLabel}</p>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-md" role="img" aria-label={label}>
          {[...cellMap.entries()].map(([key, v], i) => {
            const week = Math.floor(i / DAYS);
            const day = i % DAYS;
            return (
              <rect
                key={key}
                x={week * 12}
                y={day * 12}
                width={9}
                height={9}
                rx={1.5}
                fill={v === 1 ? "var(--accent)" : "rgba(233,237,245,0.08)"}
                opacity={v === 1 ? 0.85 : 1}
              >
                <title>{key}</title>
              </rect>
            );
          })}
        </svg>
      )}
    </div>
  );
}