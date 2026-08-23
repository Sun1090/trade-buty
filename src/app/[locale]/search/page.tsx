import { notFound } from "next/navigation";
import { getDict, isLocale, LOCALES } from "@/lib/i18n";
import { SearchClient } from "@/components/search-client";
import { HeroCard } from "@/components/hero-card";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/search">) {
  const { locale } = await params;
  const s = getDict(locale).search;
  return { title: s.title, description: s.placeholder };
}

export default async function SearchPage({
  params,
}: PageProps<"/[locale]/search">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const search = getDict(locale).search;
  const { title } = search;
  const clientDict = {
    placeholder: search.placeholder,
    noResults: search.noResults,
    resultsTpl: search.resultsTpl,
    emptyHint: search.emptyHint,
    browseCta: search.browseCta,
    recentLabel: search.recentLabel,
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <HeroCard label={search.label} title={title} />
      <SearchClient dict={clientDict} />
    </div>
  );
}
