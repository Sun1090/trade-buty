import { notFound } from "next/navigation";
import { CALENDAR_EVENTS, calendarSampleWindow } from "@/lib/calendar-sample";
import { getDict, isLocale, LOCALES } from "@/lib/i18n";
import { buildPageMetadata } from "@/lib/metadata";
import { HeroCard } from "@/components/hero-card";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/calendar">) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const m = getDict(locale).pageMeta;
  return buildPageMetadata({
    locale,
    title: m.calendarTitle,
    description: m.calendarDesc,
    path: `/${locale}/calendar`,
    noindex: true,
  });
}

const IMPACT_COLORS: Record<string, string> = {
  high: "text-down border-down/40 bg-down/10",
  medium: "text-warn border-warn/40 bg-warn-dim",
  low: "text-faint border-[var(--border)] bg-[var(--surface)]",
};

export default async function CalendarPage({ params }: PageProps<"/[locale]/calendar">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const en = locale === "en";
  // 大标题与 <title> 用同一个字符串：这一屏曾经有三个名字（meta「经济日历」、入口「日历」、
  // h1「重要经济事件」），而 h1 那个形容词页面自己不信——列表里就印着一颗「低」影响。
  const { calendarTitle } = getDict(locale).pageMeta;

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-5 py-10 sm:py-14">
      <HeroCard label={en ? "Calendar" : "日历"} title={calendarTitle}>
        {en
          ? `A sample calendar: the releases below span ${calendarSampleWindow()}. It never updates on its own, and it is not investment advice.`
          : `示例日历：下面这几条发布覆盖 ${calendarSampleWindow()}，不会自动更新，也不构成任何投资建议。`}
      </HeroCard>
      <ul className="space-y-2">
        {CALENDAR_EVENTS.map((e, i) => (
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
        {en
          ? "Static sample data — this page reads no economic-calendar feed, and none is connected."
          : "静态示例数据：这一页不读取任何经济日历数据源，站内也没有接上这样一个源。"}
      </p>
    </div>
  );
}
