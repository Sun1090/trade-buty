import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import {
  getAdjacentDocs,
  getChapter,
  getChapterNums,
  getDoc,
  getDocMetas,
  prepareForRender,
} from "@/lib/content";
import { getDict, isLocale } from "@/lib/i18n";
import { QUIZZES } from "@/lib/quizzes";
import { Markdown } from "@/components/markdown";
import { Quiz } from "@/components/quiz";
import { MarkRead } from "@/components/mark-read";
import { LazyChartEmbed } from "@/components/chart-embed";

export function generateStaticParams() {
  const params: { locale: string; num: string; doc: string }[] = [];
  for (const locale of ["zh", "en"]) {
    for (const num of getChapterNums()) {
      for (const doc of getDocMetas(num)) {
        params.push({ locale, num, doc: doc.slug });
      }
    }
  }
  return params;
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/knowledge/[num]/[doc]">): Promise<Metadata> {
  const { num, doc: docSlug } = await params;
  const doc = getDoc(num, docSlug);
  if (!doc) return {};
  return { title: doc.title, description: doc.description };
}

export default async function DocPage({
  params,
}: PageProps<"/[locale]/knowledge/[num]/[doc]">) {
  const { locale, num, doc: docSlug } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDict(locale);
  const p = (path: string) => `/${locale}${path}`;
  const doc = getDoc(num, docSlug);
  if (!doc) notFound();
  const { prev, next } = getAdjacentDocs(num, docSlug);
  const chapter = getChapter(num)?.chapter;

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-5 py-10">
      <nav className="text-sm text-muted mb-6">
        <Link href={p("/")} className="hover:text-accent">
          {t.nav.path}
        </Link>
        <span className="mx-2">/</span>
        <Link href={p(`/knowledge/${num}`)} className="hover:text-accent">
          {chapter?.title}
        </Link>
      </nav>

      <article>
        <MarkRead chapterNum={num} docSlug={docSlug} />
        <h1 className="text-2xl sm:text-3xl font-bold mb-8">{doc.title}</h1>
        <Markdown content={prepareForRender(doc.content, num)} />
      </article>

      {QUIZZES[num]?.docSlug === docSlug && (
        <Quiz quiz={QUIZZES[num]} dict={t.quiz} />
      )}

      {/* 边学边练 */}
      {num === "06" ? (
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
            href={p(`/knowledge/${num}/${prev.slug}`)}
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
            href={p(`/knowledge/${num}/${next.slug}`)}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 hover:border-[var(--accent)]/60 transition sm:text-right"
          >
            <span className="block text-xs text-faint">{t.doc.next}</span>
            {next.title}
          </Link>
        )}
      </nav>
    </div>
  );
}
