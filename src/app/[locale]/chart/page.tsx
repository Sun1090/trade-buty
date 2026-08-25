import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDict, isLocale, LOCALES } from "@/lib/i18n";
import { KlineChart } from "@/components/kline-chart";
import { HeroCard } from "@/components/hero-card";
import { FullscreenToggle } from "@/components/fullscreen-toggle";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/chart">): Promise<Metadata> {
  const { locale } = await params;
  const t = getDict(locale).chart;
  return { title: t.title, description: t.intro, alternates: { canonical: `/${locale}/chart` } };
}

export default async function ChartPage({
  params,
}: PageProps<"/[locale]/chart">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDict(locale);

  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <HeroCard label={t.chart.label} title={t.chart.title}>
        {t.chart.intro}
      </HeroCard>
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
