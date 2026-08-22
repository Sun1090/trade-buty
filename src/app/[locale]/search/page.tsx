import { notFound } from "next/navigation";
import { getDict, isLocale, LOCALES } from "@/lib/i18n";
import { SearchClient } from "@/components/search-client";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/search">) {
  const { locale } = await params;
  return { title: getDict(locale).search.title };
}

export default async function SearchPage({
  params,
}: PageProps<"/[locale]/search">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { title, placeholder, noResults, resultsTpl } = getDict(locale).search;

  void resultsTpl;
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold mb-6">{title}</h1>
      <SearchClient dict={{ placeholder, noResults, resultsTpl }} />
    </div>
  );
}
