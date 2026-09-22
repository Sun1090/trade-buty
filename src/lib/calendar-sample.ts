/**
 * 经济日历的示例数据。
 *
 * 这一页从来没有接过真实的数据源（站内只有币安行情可用，经济日历需要第三方 API），
 * 所以它是一份**示例**：文案只能说「这几条覆盖 X → Y」，说「本周」「即将公布」都是假话——
 * 数组是写死的，构建之后一天比一天旧。真实窗口由数组自己算出来，改数据时文案跟着变。
 *
 * 是否给这一页接上游数据源、或者干脆下线，属于产品决策（roadmap R16.16）。
 */
export interface CalendarEvent {
  date: string;
  time: string;
  region: string;
  event: string;
  impact: "high" | "medium" | "low";
}

export const CALENDAR_EVENTS: CalendarEvent[] = [
  { date: "2026-08-26", time: "20:30", region: "🇺🇸 US", event: "Consumer Confidence", impact: "high" },
  { date: "2026-08-28", time: "20:30", region: "🇺🇸 US", event: "GDP Q2 (2nd)", impact: "high" },
  { date: "2026-08-29", time: "20:30", region: "🇺🇸 US", event: "Initial Jobless Claims", impact: "medium" },
  { date: "2026-08-29", time: "22:00", region: "🇺🇸 US", event: "Pending Home Sales", impact: "low" },
  { date: "2026-09-01", time: "09:45", region: "🇨🇳 CN", event: "Manufacturing PMI", impact: "high" },
  { date: "2026-09-01", time: "21:45", region: "🇺🇸 US", event: "ISM Manufacturing PMI", impact: "high" },
  { date: "2026-09-03", time: "20:15", region: "🇪🇺 EU", event: "ECB Rate Decision", impact: "high" },
  { date: "2026-09-05", time: "20:30", region: "🇺🇸 US", event: "Non-Farm Payrolls", impact: "high" },
  { date: "2026-09-05", time: "20:30", region: "🇺🇸 US", event: "Unemployment Rate", impact: "high" },
];

/** 示例数据真实覆盖的日期窗口，如 `2026-08-26 → 2026-09-05` */
export function calendarSampleWindow(events: CalendarEvent[] = CALENDAR_EVENTS): string {
  const days = events.map((e) => e.date).sort();
  return `${days[0]} → ${days[days.length - 1]}`;
}
