import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getChapters } from "@/lib/content";
import { getDict, isLocale, LOCALES } from "@/lib/i18n";
import { StatsClient } from "@/components/stats-client";
import { HeroCard } from "@/components/hero-card";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/stats">): Promise<Metadata> {
  const { locale } = await params;
  const t = getDict(locale).stats;
  return { title: t.title, description: t.subtitle, alternates: { canonical: `/${locale}/stats` } };
}

export default async function StatsPage({
  params,
}: PageProps<"/[locale]/stats">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDict(locale);
  const chapters = getChapters(locale).map((c) => ({ slug: c.slug, docCount: c.docCount }));

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-5 py-10">
      <HeroCard label={t.stats.label} title={t.stats.title}>
        {t.stats.subtitle}
      </HeroCard>
      <StatsClient chapters={chapters} dict={t.stats} />
    </div>
  );
}
