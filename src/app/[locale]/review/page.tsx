import Link from "next/link";
import { notFound } from "next/navigation";
import { getDict, isLocale, LOCALES } from "@/lib/i18n";
import { buildPageMetadata } from "@/lib/metadata";
import { QUIZZES } from "@/lib/quizzes";
import { ReviewClient } from "@/components/review-client";
import { aiEnabledForPage } from "@/lib/ai-toggle";
import { HeroCard } from "@/components/hero-card";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/review">) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDict(locale).review;
  return buildPageMetadata({
    locale,
    title: t.title,
    description: t.intro,
    path: `/${locale}/review`,
  });
}

export default async function ReviewPage({
  params,
}: PageProps<"/[locale]/review">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDict(locale);

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-5 py-10 sm:py-14">
      <HeroCard label={t.review.label} title={t.review.title}>
        {t.review.intro}
      </HeroCard>
      <ReviewClient
        quizzes={Object.values(QUIZZES)}
        dict={t.review}
        locale={locale}
        aiEnabled={aiEnabledForPage()}
      />
      <Link
        href={`/${locale}/path`}
        className="mt-8 block rounded-2xl border border-[var(--accent)]/30 bg-gradient-to-br from-[var(--accent-dim)] to-transparent p-5 hover:border-[var(--accent)]/60 transition group"
      >
        <p className="font-semibold text-sm group-hover:text-accent transition-colors">
          {t.review.browseCta}
        </p>
      </Link>
    </div>
  );
}
