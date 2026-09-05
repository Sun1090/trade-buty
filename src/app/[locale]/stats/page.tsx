import { notFound } from "next/navigation";
import { getChapters } from "@/lib/content";
import { getDict, isLocale, LOCALES } from "@/lib/i18n";
import { buildPageMetadata } from "@/lib/metadata";
import { StatsClient } from "@/components/stats-client";
import { HeroCard } from "@/components/hero-card";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/stats">) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDict(locale).stats;
  return buildPageMetadata({
    locale,
    title: t.title,
    description: t.subtitle,
    path: `/${locale}/stats`,
  });
}

export default async function StatsPage({
  params,
}: PageProps<"/[locale]/stats">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDict(locale);
  const chapters = getChapters(locale).map((c) => ({ slug: c.slug, docCount: c.docCount }));

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-5 py-10 sm:py-14">
      <HeroCard label={t.stats.label} title={t.stats.title}>
        {t.stats.subtitle}
      </HeroCard>
      <StatsClient chapters={chapters} dict={t.stats} locale={locale} />
    </div>
  );
}
