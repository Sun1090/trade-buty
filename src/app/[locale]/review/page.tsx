import Link from "next/link";
import { notFound } from "next/navigation";
import { getDict, isLocale, LOCALES } from "@/lib/i18n";
import { QUIZZES } from "@/lib/quizzes";
import { ReviewClient } from "@/components/review-client";
import { HeroCard } from "@/components/hero-card";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/review">) {
  const { locale } = await params;
  const t = getDict(locale).review;
  return { title: t.title, description: t.intro, alternates: { canonical: `/${locale}/review` } };
}

export default async function ReviewPage({
  params,
}: PageProps<"/[locale]/review">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDict(locale);

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-5 py-10">
      <HeroCard label={t.review.label} title={t.review.title}>
        {t.review.intro}
      </HeroCard>
      <ReviewClient
        quizzes={Object.values(QUIZZES)}
        dict={t.review}
        locale={locale}
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
