import { notFound } from "next/navigation";
import { getDict, isLocale, LOCALES } from "@/lib/i18n";
import { buildPageMetadata } from "@/lib/metadata";
import { HeroCard } from "@/components/hero-card";
import { BookmarksClient } from "@/components/bookmarks-client";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/bookmarks">) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDict(locale).bookmarks;
  return buildPageMetadata({
    locale,
    title: t.title,
    description: t.subtitle,
    path: `/${locale}/bookmarks`,
    noindex: true,
  });
}

export default async function BookmarksPage({
  params,
}: PageProps<"/[locale]/bookmarks">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDict(locale);

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-5 py-10 sm:py-14">
      <HeroCard label={t.bookmarks.label} title={t.bookmarks.title}>
        {t.bookmarks.subtitle}
      </HeroCard>
      <BookmarksClient locale={locale} emptyLabel={t.bookmarks.empty} />
    </div>
  );
}
