import { notFound } from "next/navigation";
import { getChapters, getDocMetas } from "@/lib/content";
import { isLocale, LOCALES } from "@/lib/i18n";
import { getStatsDict } from "@/lib/i18n-stats";
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
  const t = getStatsDict(locale);
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
  const t = getStatsDict(locale);
  const chapters = getChapters(locale).map((c) => ({
    slug: c.slug,
    title: c.title,
    docCount: c.docCount,
    docs: getDocMetas(locale, c.slug).map((d) => ({ slug: d.slug, title: d.title })),
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-5 py-10 sm:py-14">
      <HeroCard label={t.label} title={t.title}>
        {t.subtitle}
      </HeroCard>
      <StatsClient chapters={chapters} dict={t} locale={locale} />
    </div>
  );
}
