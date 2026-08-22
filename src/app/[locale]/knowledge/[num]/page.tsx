import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getChapter, getChapterNums, getDocMetas, prepareForRender } from "@/lib/content";
import { QUIZZES } from "@/lib/quizzes";
import { getDict, isLocale, LOCALES } from "@/lib/i18n";
import { Markdown } from "@/components/markdown";
import { Quiz } from "@/components/quiz";
import { DocList } from "@/components/doc-list";

export function generateStaticParams() {
  return LOCALES.flatMap((locale) =>
    getChapterNums().map((num) => ({ locale, num }))
  );
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/knowledge/[num]">): Promise<Metadata> {
  const { num } = await params;
  const data = getChapter(num);
  if (!data) return {};
  return {
    title: `${data.chapter.num} ${data.chapter.title}`,
    description: data.chapter.tagline,
  };
}

export default async function ChapterPage({
  params,
}: PageProps<"/[locale]/knowledge/[num]">) {
  const { locale, num } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDict(locale);
  const p = (path: string) => `/${locale}${path}`;
  const data = getChapter(num);
  if (!data) notFound();
  const docs = getDocMetas(num);
  const { chapter, introContent } = data;

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-5 py-10">
      <nav className="text-sm text-muted mb-6">
        <Link href={p("/")} className="hover:text-accent">
          {t.nav.path}
        </Link>
        <span className="mx-2">/</span>
        <span>{chapter.title}</span>
      </nav>

      <h1 className="text-2xl sm:text-3xl font-bold">
        <span className="font-mono text-faint mr-2">{chapter.num}</span>
        {chapter.title}
      </h1>

      {introContent && (
        <section className="mt-8 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-faint mb-3">
            {t.chapter.introHeading}
          </h2>
          <Markdown content={prepareForRender(introContent, num)} />
        </section>
      )}

      {QUIZZES[num] && !QUIZZES[num].docSlug && (
        <section className="mt-12">
          <Quiz quiz={QUIZZES[num]} dict={t.quiz} />
        </section>
      )}

      <section className="mt-10">
        <DocList metas={docs} num={num} locale={locale} />
      </section>
    </div>
  );
}
