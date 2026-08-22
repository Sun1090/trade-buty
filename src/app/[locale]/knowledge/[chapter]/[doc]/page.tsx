import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import {
  getAdjacentChapters,
  getAdjacentDocs,
  getChapter,
  getChapterSlugs,
  getDoc,
  getDocMetas,
  prepareForRender,
} from "@/lib/content";
import { getDict, isLocale } from "@/lib/i18n";
import { QUIZZES } from "@/lib/quizzes";
import { Markdown } from "@/components/markdown";
import { ChapterExamCard } from "@/components/chapter-exam-card";
import { ChapterRail } from "@/components/chapter-rail";
import { MarkRead } from "@/components/mark-read";
import { LazyChartEmbed } from "@/components/chart-embed";
import { Toc } from "@/components/toc";
import { ReadingProgress } from "@/components/reading-progress";
import { CodeCopy } from "@/components/code-copy";
import { ImageLightbox } from "@/components/image-lightbox";
import { extractHeadings } from "@/lib/toc";

export function generateStaticParams() {
  const params: { locale: string; chapter: string; doc: string }[] = [];
  for (const locale of ["zh", "en"]) {
    for (const chapter of getChapterSlugs(locale)) {
      for (const doc of getDocMetas(locale, chapter)) {
        params.push({ locale, chapter, doc: doc.slug });
      }
    }
  }
  return params;
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/knowledge/[chapter]/[doc]">): Promise<Metadata> {
  const { chapter, doc: docSlug } = await params;
  const doc = getDoc("zh", chapter, docSlug);
  if (!doc) return {};
  return { title: doc.title, description: doc.description };
}

export default async function DocPage({
  params,
}: PageProps<"/[locale]/knowledge/[chapter]/[doc]">) {
  const raw = await params;
  const { locale, chapter: chapterSlug, doc: docSlug } = raw as {
    locale: string;
    chapter: string;
    doc: string;
  };
  if (!isLocale(locale)) notFound();
  const t = getDict(locale);
  const p = (path: string) => `/${locale}${path}`;
  const doc = getDoc(locale, chapterSlug, docSlug);
  if (!doc) {
    const chapterData = getChapter(locale, chapterSlug);
    if (!chapterData) notFound();
    const available = getDocMetas(locale, chapterSlug);
    const tc = getDict(locale);
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-5 py-16">
        <p className="font-mono text-4xl text-accent">404</p>
        <h1 className="mt-4 text-2xl font-bold">{tc.notFound.docMissing}</h1>
        <p className="mt-2 text-sm text-muted">{tc.notFound.docHint}</p>
        <ol className="mt-8 space-y-2.5">
          {available.map((d) => (
            <li key={d.slug}>
              <Link
                href={`/${locale}/knowledge/${chapterSlug}/${d.slug}`}
                className="block rounded-lg border border-[var(--border)] bg-[var(--surface)] px-5 py-3 hover:border-[var(--accent)]/60 transition"
              >
                {d.title}
              </Link>
            </li>
          ))}
        </ol>
      </div>
    );
  }
  const { prev, next } = getAdjacentDocs(locale, chapterSlug, docSlug);
  const chapterData = getChapter(locale, chapterSlug);
  const chapter = chapterData?.chapter;
  const docMetas = getDocMetas(locale, chapterSlug);
  const { next: nextChapter } = getAdjacentChapters(locale, chapterSlug);
  const nextChapterMeta = nextChapter
    ? {
        slug: nextChapter.slug,
        title: nextChapter.title,
        tagline: nextChapter.tagline,
      }
    : null;

  const headings = extractHeadings(doc.content);
  const tools = t.docTools;

  return (
    <div className="relative">
      <ReadingProgress label={tools.backToTop} />
      <Toc items={headings} heading={tools.toc} />
      <CodeCopy
        containerSelector="article"
        copiedLabel={tools.copied}
        copyLabel={tools.copyCode}
      />
      <ImageLightbox containerSelector="article" closeLabel={tools.lightboxClose} />
    <div className="mx-auto max-w-[1400px] px-4 sm:px-6 py-10">
      <div className="grid xl:grid-cols-[260px_1fr] gap-8">
        {chapter && (
          <ChapterRail
            chapterSlug={chapterSlug}
            chapterTitle={chapter.title}
            chapterTagline={chapter.tagline}
            docMetas={docMetas}
            currentDocSlug={docSlug}
            nextChapter={nextChapterMeta}
            locale={locale}
            dict={{
              coursesHeading: t.chapter.coursesHeading,
              nextChapter: t.chapter.nextChapter,
              progressLabel: t.chapter.progressLabel,
              lessonsUnit: t.chapter.lessonsUnit,
            }}
          />
        )}
        <div className="min-w-0 max-w-3xl">
      <nav className="text-sm text-muted mb-6">
        <Link href={p("/")} className="hover:text-accent">
          {t.nav.path}
        </Link>
        <span className="mx-2">/</span>
        <Link href={p(`/knowledge/${chapterSlug}`)} className="hover:text-accent">
          {chapter?.title}
        </Link>
      </nav>

      <article>
        <MarkRead chapterNum={chapterSlug} docSlug={docSlug} />
        <h1 className="text-2xl sm:text-3xl font-bold mb-8">{doc.title}</h1>
        <Markdown content={prepareForRender(doc.content, locale, chapterSlug)} />
      </article>

      {QUIZZES[chapterSlug] && (
        <ChapterExamCard quiz={QUIZZES[chapterSlug]} dict={t.quiz} />
      )}

      {/* 边学边练 */}
      {chapterSlug === "technical-analysis" ? (
        <LazyChartEmbed
          dict={{
            heading: t.chart.embedHeading,
            loading: t.chart.loading,
            error: t.chart.error,
            retry: t.chart.retry,
            disclaimer: t.chart.disclaimer,
          }}
        />
      ) : (
        <aside className="mt-12 rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent-dim)] p-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-semibold">{t.doc.practiceTitle}</p>
            <p className="mt-1 text-sm text-muted">{t.doc.practiceBody}</p>
          </div>
          <Link
            href={p("/chart")}
            className="rounded-full bg-accent-strong hover:bg-accent text-white dark:text-[#06281c] font-semibold px-6 py-2.5 transition shrink-0"
          >
            {t.doc.practiceCta}
          </Link>
        </aside>
      )}

      <nav className="mt-16 pt-6 border-t border-[var(--border)] grid gap-3 sm:grid-cols-2 text-sm">
        {prev ? (
          <Link
            href={p(`/knowledge/${chapterSlug}/${prev.slug}`)}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 hover:border-[var(--accent)]/60 transition"
          >
            <span className="block text-xs text-faint">{t.doc.prev}</span>
            {prev.title}
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link
            href={p(`/knowledge/${chapterSlug}/${next.slug}`)}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 hover:border-[var(--accent)]/60 transition sm:text-right"
          >
            <span className="block text-xs text-faint">{t.doc.next}</span>
            {next.title}
          </Link>
        )}
      </nav>
        </div>
      </div>
    </div>
    </div>
  );
}
