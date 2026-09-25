"use client";

import { useEffect, useState } from "react";
import { readActivityDates } from "@/lib/activity-calendar";
import { localDateStr, shiftDate } from "@/lib/date-utils";

const DAYS_ZH = ["日", "一", "二", "三", "四", "五", "六"];
const DAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * 近 7 天活动迷你条形图。
 *
 * 数据在挂载后读、并跟随 `tb-streak` 更新：`recordActivity()` 就是由 `touchStreak()`
 * 顺带写的（同一个事件），所以「今天学了一节」必须立刻让这根条亮起来。早先这里把
 * 日期窗口 memo 在 `[locale]` 上，等于整个页面生命周期内都固定住挂载那天的「今天」，
 * 同一页上的热力图会亮、这根条不会。
 */
export function WeekMiniBar({ locale }: { locale: string }) {
  const [dates, setDates] = useState<string[]>([]);

  useEffect(() => {
    const update = () => setDates(readActivityDates());
    update();
    window.addEventListener("tb-streak", update);
    return () => window.removeEventListener("tb-streak", update);
  }, []);

  const active = new Set(dates);
  const today = localDateStr();
  const days: { label: string; onThisDay: boolean }[] = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = shiftDate(today, -offset);
    const [year, month, dayOfMonth] = date.split("-").map(Number);
    const weekday = new Date(year, month - 1, dayOfMonth).getDay();
    days.push({
      label: locale === "en" ? DAYS_EN[weekday] : DAYS_ZH[weekday],
      onThisDay: active.has(date),
    });
  }

  // 亮/不亮原本只有颜色这一个通道，读屏用户什么也拿不到（WCAG 1.4.1 用色传信）。
  // role="img" 会让容器内的文字对 AT 变成装饰，所以名称必须自带整条模式——
  // 按时间顺序报 7 格，而不是只报「哪几天有」，否则听的人不知道窗口从哪天开始。
  // 更要紧的是这把尺子得说出口：这一格看的是「那天有没有记过一次学习活动」
  // （`activity-calendar`，由 `touchStreak` 写入），跟同一屏摘要卡那个「{d} 天各学满 1 分钟」
  // 不是同一把尺（那把见 `weekly-summary.ts` 的 `ACTIVE_DAY_MIN_SECONDS`），
  // 两个数可以互相超出，谁都不许冒充对方。
  const pattern = locale === "en"
    ? `Which of the last 7 days recorded a learning activity (a lesson marked read, a question answered, or a replay round finished; oldest to newest): ${days
        .map((day) => (day.onThisDay ? "yes" : "no"))
        .join(", ")}`
    : `近 7 天里哪几天记过一次学习活动（标过已读、答过题或打完一轮回放；从 6 天前到今天）：${days
        .map((day) => (day.onThisDay ? "有" : "无"))
        .join("、")}`;

  return (
    <div
      role="img"
      aria-label={pattern}
      className="flex items-end justify-between gap-1.5 h-12"
    >
      {days.map((day, index) => (
        <div key={index} className="flex flex-col items-center gap-1 flex-1">
          <div
            data-active={day.onThisDay ? "true" : "false"}
            className={`w-full rounded-t transition-all ${
              day.onThisDay
                ? "bg-gradient-to-t from-accent-strong to-accent h-full"
                : "h-2 bg-[var(--border)]"
            }`}
          />
          <span className="text-[9px] text-faint">{day.label}</span>
        </div>
      ))}
    </div>
  );
}
