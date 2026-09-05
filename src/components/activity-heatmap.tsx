"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { readActivityDates } from "@/lib/activity-calendar";

const WEEKS = 26; // 最近半年
const DAYS = 7;

interface HeatmapProps {
  label: string;
  emptyLabel: string;
  locale: "zh" | "en";
}

/** 学习活动热力图：GitHub 贡献图风格（SVG）。R8.7 空态补 CTA。 */
export function ActivityHeatmap({ label, emptyLabel, locale }: HeatmapProps) {
  const [dates, setDates] = useState<string[]>([]);

  useEffect(() => {
    const update = () => setDates(readActivityDates());
    update();
    window.addEventListener("tb-streak", update);
    return () => window.removeEventListener("tb-streak", update);
  }, []);

  const activeSet = new Set(dates);
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
  const pathHref = `/${locale}/path`;
  const ctaText = locale === "en" ? "Start a lesson →" : "去学第一课 →";

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-faint mb-3">
        {label} · {activeCount} {activeCount <= 1 ? "day" : "days"}
      </p>
      {activeCount === 0 ? (
        <div data-testid="activity-heatmap-empty" className="space-y-3">
          <p className="text-sm text-faint">{emptyLabel}</p>
          <Link
            href={pathHref}
            data-testid="activity-heatmap-cta"
            className="inline-block rounded-full border border-[var(--accent)]/40 hover:border-accent/60 px-4 py-1.5 text-xs font-medium text-accent transition"
          >
            {ctaText}
          </Link>
        </div>
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
                rx={2}
                fill={v ? "var(--accent)" : "var(--border)"}
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
