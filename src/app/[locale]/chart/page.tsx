import type { Metadata } from "next";
import Link from "next/link";
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
      <header className="mb-8 rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[var(--accent-dim)] via-[var(--surface)] to-[var(--surface)] p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          {t.chart.label}
        </p>
        <h1 className="text-3xl font-bold mt-3">{t.chart.title}</h1>
        <p className="mt-3 text-muted leading-relaxed">{t.chart.intro}</p>
      </header>
      <KlineChart dict={t.chart} />
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
