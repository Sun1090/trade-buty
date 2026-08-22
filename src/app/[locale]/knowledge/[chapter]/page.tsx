import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import {
  getChapter,
  getChapterSlugs,
  getDocMetas,
  prepareForRender,
} from "@/lib/content";
import { QUIZZES } from "@/lib/quizzes";
import { getDict, isLocale, LOCALES } from "@/lib/i18n";
import { Markdown } from "@/components/markdown";
import { Quiz } from "@/components/quiz";
import { DocList } from "@/components/doc-list";

export function generateStaticParams() {
  return LOCALES.flatMap((locale) =>
    getChapterSlugs(locale).map((chapter) => ({ locale, chapter }))
  );
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/knowledge/[chapter]">): Promise<Metadata> {
  const { chapter: slug } = await params;
  const data = isLocale(slug) ? null : null; // slug 不是 locale，仅取内容
  const resolved = getChapter("zh", slug);
  if (!resolved) return {};
  return {
    title: resolved.chapter.title,
    description: resolved.chapter.tagline,
  };
}

export default async function ChapterPage({
  params,
}: PageProps<"/[locale]/knowledge/[chapter]">) {
  const raw = await params;
  const { locale, chapter: slug } = raw as { locale: string; chapter: string };
  if (!isLocale(locale)) notFound();
  const t = getDict(locale);
  const p = (path: string) => `/${locale}${path}`;
  const data = getChapter(locale, slug);
  if (!data) notFound();
  const docs = getDocMetas(locale, slug);
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

      <h1 className="text-2xl sm:text-3xl font-bold">{chapter.title}</h1>

      {introContent && (
        <section className="mt-8 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-faint mb-3">
            {t.chapter.introHeading}
          </h2>
          <Markdown content={prepareForRender(introContent, locale, slug)} />
        </section>
      )}

      {QUIZZES[slug] && !QUIZZES[slug].docSlug && (
        <section className="mt-12">
          <Quiz quiz={QUIZZES[slug]} dict={t.quiz} />
        </section>
      )}

      <section className="mt-10">
        <DocList metas={docs} chapterSlug={slug} locale={locale} />
      </section>
    </div>
  );
}
