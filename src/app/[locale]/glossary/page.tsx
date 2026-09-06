import { notFound } from "next/navigation";
import { getDict, isLocale, LOCALES } from "@/lib/i18n";
import { buildPageMetadata } from "@/lib/metadata";
import { HeroCard } from "@/components/hero-card";
import { GLOSSARY_TERMS } from "@/lib/glossary";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/glossary">) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const m = getDict(locale).pageMeta;
  return buildPageMetadata({
    locale,
    title: m.glossaryTitle,
    description: m.glossaryDesc,
    path: `/${locale}/glossary`,
    noindex: true,
  });
}

export default async function GlossaryPage({ params }: PageProps<"/[locale]/glossary">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const en = locale === "en";

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-5 py-10 sm:py-14">
      <HeroCard label={en ? "Glossary" : "术语表"} title={en ? "Trading Glossary" : "交易术语表"}>
        {en
          ? "Common terms used across the course, with bilingual definitions."
          : "课程中常见的交易术语，中英对照。"
        }
      </HeroCard>
      <div className="grid gap-3 sm:grid-cols-2">
        {GLOSSARY_TERMS.map((t) => (
          <div key={t.en} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="flex items-baseline gap-2 mb-1">
              <span className="font-semibold text-sm">{en ? t.en : t.term}</span>
              <span className="text-xs text-faint font-mono">{en ? t.term : t.en}</span>
            </div>
            <p className="text-xs text-muted leading-relaxed">{en ? t.defEn : t.def}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
