import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDict, isLocale, LOCALES } from "@/lib/i18n";
import { KlineChart } from "@/components/kline-chart";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/chart">): Promise<Metadata> {
  const { locale } = await params;
  const t = getDict(locale).chart;
  return { title: t.title, description: t.intro };
}

export default async function ChartPage({
  params,
}: PageProps<"/[locale]/chart">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDict(locale);

  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <header className="max-w-xl mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          {t.chart.label}
        </p>
        <h1 className="text-3xl font-bold mt-3">{t.chart.title}</h1>
        <p className="mt-3 text-muted leading-relaxed">{t.chart.intro}</p>
      </header>
      <KlineChart dict={t.chart} />
    </div>
  );
}
