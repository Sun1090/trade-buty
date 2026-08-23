import Link from "next/link";
import { notFound } from "next/navigation";
import { getDict, isLocale, LOCALES } from "@/lib/i18n";
import { QUIZZES } from "@/lib/quizzes";
import { ReviewClient } from "@/components/review-client";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/review">) {
  const { locale } = await params;
  return { title: getDict(locale).review.title };
}

export default async function ReviewPage({
  params,
}: PageProps<"/[locale]/review">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDict(locale);

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-5 py-10">
      <header className="mb-8 rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[var(--accent-dim)] via-[var(--surface)] to-[var(--surface)] p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          {t.review.label}
        </p>
        <h1 className="text-3xl font-bold mt-3">{t.review.title}</h1>
        <p className="mt-3 text-sm text-muted leading-relaxed">{t.review.intro}</p>
      </header>
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
