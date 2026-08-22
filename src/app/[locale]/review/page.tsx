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

  // 全部题库传给客户端，由其按本地错题记录筛选展示
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-5 py-10">
      <header className="max-w-xl mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          Wrong Answers
        </p>
        <h1 className="text-3xl font-bold mt-3">{t.review.title}</h1>
        <p className="mt-3 text-sm text-muted leading-relaxed">{t.review.intro}</p>
      </header>
      <ReviewClient
        quizzes={Object.values(QUIZZES)}
        dict={t.review}
      />
    </div>
  );
}
