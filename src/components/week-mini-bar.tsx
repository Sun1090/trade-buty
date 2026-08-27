"use client";

import { useMemo } from "react";
import { readActivityDates } from "@/lib/activity-calendar";

const DAYS_ZH = ["日", "一", "二", "三", "四", "五", "六"];
const DAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** 近 7 天活动迷你条形图 */
export function WeekMiniBar({ locale }: { locale: string }) {
  const bars = useMemo(() => {
    const dates = new Set(readActivityDates());
    const today = new Date();
    const days: { label: string; active: boolean }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const dayIdx = d.getDay();
      days.push({
        label: locale === "en" ? DAYS_EN[dayIdx] : DAYS_ZH[dayIdx],
        active: dates.has(dStr),
      });
    }
    return days;
  }, [locale]);

  return (
    <div className="flex items-end justify-between gap-1.5 h-12">
      {bars.map((bar, i) => (
        <div key={i} className="flex flex-col items-center gap-1 flex-1">
          <div
            className={`w-full rounded-t transition-all ${
              bar.active
                ? "bg-gradient-to-t from-accent-strong to-accent h-full"
                : "h-2 bg-[var(--border)]"
            }`}
          />
          <span className="text-[9px] text-faint">{bar.label}</span>
        </div>
      ))}
    </div>
  );
}
