import Link from "next/link";
import { notFound } from "next/navigation";
import { getDict, isLocale, LOCALES } from "@/lib/i18n";
import { buildPageMetadata } from "@/lib/metadata";
import { KlineChart } from "@/components/kline-chart";
import { HeroCard } from "@/components/hero-card";
import { FullscreenToggle } from "@/components/fullscreen-toggle";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/chart">) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDict(locale).chart;
  return buildPageMetadata({
    locale,
    title: t.title,
    description: t.intro,
    path: `/${locale}/chart`,
  });
}

export default async function ChartPage({
  params,
}: PageProps<"/[locale]/chart">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDict(locale);

  return (
    <div className="mx-auto max-w-6xl px-5 py-10 sm:py-14">
      <HeroCard label={t.chart.label} title={t.chart.title}>
        {t.chart.intro}
      </HeroCard>
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-accent/20 bg-accent/5 p-4 text-sm">
        <span className="text-xl" aria-hidden>🧭</span>
        <p className="text-muted">{locale === "zh" ? "练习方法：先描述趋势，再标出关键位置，最后回到课程验证你的判断。" : "Practice loop: describe the trend, mark key levels, then return to the lesson to verify your reasoning."}</p>
      </div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-mono text-faint">BTCUSDT · 4H</p>
        <FullscreenToggle targetId="chart-container" label={{ enter: "全屏", exit: "退出" }} />
      </div>
      <div id="chart-container">
        <KlineChart dict={t.chart} />
      </div>
      <Link
        href={`/${locale}/path`}
        className="mt-8 block rounded-2xl border border-[var(--accent)]/30 bg-gradient-to-br from-[var(--accent-dim)] to-transparent p-5 hover:border-[var(--accent)]/60 transition group"
      >
        <p className="font-semibold text-sm group-hover:text-accent transition-colors">
          {t.chart.continueLearning}
        </p>
      </Link>
    </div>
  );
}
