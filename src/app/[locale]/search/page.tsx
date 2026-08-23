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
      <header className="mb-8 rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[var(--accent-dim)] via-[var(--surface)] to-[var(--surface)] p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          {search.label}
        </p>
        <h1 className="text-2xl font-bold mt-3">{title}</h1>
      </header>
      <SearchClient dict={clientDict} />
    </div>
  );
}
