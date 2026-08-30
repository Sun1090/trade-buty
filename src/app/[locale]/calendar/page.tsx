import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, LOCALES } from "@/lib/i18n";
import { HeroCard } from "@/components/hero-card";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Economic Calendar", robots: { index: false, follow: false } };
}

interface Event {
  date: string;
  time: string;
  region: string;
  event: string;
  impact: "high" | "medium" | "low";
}

// 静态事件列表（示例数据，可后续接 API）
const EVENTS: Event[] = [
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

const IMPACT_COLORS: Record<string, string> = {
  high: "text-down border-down/40 bg-down/10",
  medium: "text-warn border-warn/40 bg-warn-dim",
  low: "text-faint border-[var(--border)] bg-[var(--surface)]",
};

export default async function CalendarPage({ params }: PageProps<"/[locale]/calendar">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const en = locale === "en";

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-5 py-10 sm:py-14">
      <HeroCard label={en ? "Calendar" : "日历"} title={en ? "Economic Calendar" : "重要经济事件"}>
        {en ? "Key economic releases that may move markets. Times in UTC+8." : "可能影响市场的关键经济数据发布。时间为北京时间。"}
      </HeroCard>
      <ul className="space-y-2">
        {EVENTS.map((e, i) => (
          <li
            key={i}
            className={`flex items-center gap-4 rounded-xl border px-4 py-3 ${IMPACT_COLORS[e.impact]}`}
          >
            <div className="shrink-0 text-center">
              <p className="text-xs font-mono text-faint">{e.date.slice(5)}</p>
              <p className="text-xs font-mono">{e.time}</p>
            </div>
            <span className="text-xs font-mono shrink-0">{e.region}</span>
            <span className="text-sm flex-1 truncate">{e.event}</span>
            <span className="text-[10px] uppercase font-semibold shrink-0">
              {e.impact === "high" ? (en ? "High" : "高") : e.impact === "medium" ? (en ? "Med" : "中") : (en ? "Low" : "低")}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-8 text-xs text-faint">
        {en ? "Static sample data. API integration planned." : "静态示例数据，API 接入待定。"}
      </p>
    </div>
  );
}
