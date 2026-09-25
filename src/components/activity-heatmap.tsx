"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { readActivityDates } from "@/lib/activity-calendar";
import { PATH_SURFACE_NAME } from "@/lib/path-name";
import { localDateStr } from "@/lib/date-utils";

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
      const key = localDateStr(d);
      cellMap.set(key, activeSet.has(key) ? 1 : 0);
    }
  }

  const W = WEEKS * 12;
  const H = DAYS * 12;
  // 图上点得亮的格子数——标题里的数字必须就是这张图画出来的东西。
  // 记录本身保留 365 天（`activity-calendar.ts` 的 `slice(-365)`），比这张 26 周的图长一倍，
  // 所以窗口外的日子单独交代，不混进这个数。
  const inWindow = [...cellMap.values()].filter((value) => value > 0).length;
  const earlier = activeSet.size - inWindow;
  const dayUnit =
    locale === "zh" ? "天" : inWindow === 1 ? "day" : "days";
  const earlierNote =
    locale === "zh"
      ? `（另有 ${earlier} 天早于这张图）`
      : ` (${earlier} earlier than this chart)`;
  const pathHref = `/${locale}/path`;
  // 这颗按钮去的是路线总览、不是某一课，所以它的名字取的是那一页自己的名字
  // （`PATH_SURFACE_NAME`，`i18n.ts` 的 `path.title` 也取它）：那一页改名，按钮跟着改。
  const pathTitle = PATH_SURFACE_NAME[locale];
  const ctaText = locale === "en" ? `Open the ${pathTitle} →` : `打开${pathTitle} →`;

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-faint mb-3">
        {label} · {inWindow} {dayUnit}
        {earlier > 0 && (
          <span data-testid="activity-heatmap-earlier" className="font-normal normal-case">
            {earlierNote}
          </span>
        )}
      </p>
      {activeSet.size === 0 ? (
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
