import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import {
  getAdjacentChapters,
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
import { ChapterCompleteCelebration } from "@/components/chapter-complete-celebration";
import { Collapsible } from "@/components/collapsible";
import { ChapterSummaryAi } from "@/components/chapter-summary-ai";
import { aiEnabledForPage } from "@/lib/ai-toggle";
import { TodayPick } from "@/components/today-pick";

export function generateStaticParams() {
  return LOCALES.flatMap((locale) =>
    getChapterSlugs(locale).map((chapter) => ({ locale, chapter }))
  );
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/knowledge/[chapter]">): Promise<Metadata> {
  const { locale, chapter: slug } = await params;
  const resolved = getChapter("zh", slug);
  if (!resolved) return {};
  return {
    title: resolved.chapter.title,
    description: resolved.chapter.tagline,
    alternates: {
      canonical: `/${locale}/knowledge/${slug}`,
    },
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
  if (!data) {
    const slugs = getChapterSlugs(locale);
    if (!slugs.includes(slug)) {
      const tc = getDict(locale);
      return (
        <div className="mx-auto max-w-3xl px-4 sm:px-5 py-16">
          <p className="font-mono text-4xl text-accent">404</p>
          <h1 className="mt-4 text-2xl font-bold">{tc.notFound.chapterMissing}</h1>
          <ul className="mt-8 grid gap-2.5 sm:grid-cols-2">
            {slugs.map((s) => (
              <li key={s}>
                <Link
                  href={`/${locale}/knowledge/${s}`}
                  className="block rounded-lg border border-[var(--border)] bg-[var(--surface)] px-5 py-3 font-mono text-sm hover:border-[var(--accent)]/60 transition"
                >
                  {s}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      );
    }
    notFound();
  }
  const docs = getDocMetas(locale, slug);
  const { chapter, introContent } = data;
  const { next: nextChapter } = getAdjacentChapters(locale, slug);

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-5 py-10 sm:py-14">
      <nav className="text-sm text-muted mb-6">
        <Link href={p("/")} className="hover:text-accent">
          {t.nav.path}
        </Link>
        <span className="mx-2">/</span>
        <span>{chapter.title}</span>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[var(--accent-dim)] via-[var(--surface)] to-[var(--surface)] p-8">
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(var(--foreground) 1px, transparent 1px), linear-gradient(90deg, var(--foreground) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
          aria-hidden
        />
        <div className="relative">
          <p className="text-xs font-mono text-accent uppercase tracking-widest">
            {t.chapter.progressLabel}
          </p>
          <h1 className="mt-2 text-2xl sm:text-3xl font-bold">{chapter.title}</h1>
          <p className="mt-2 text-sm text-muted leading-relaxed">
            {chapter.tagline}
          </p>
          <div className="mt-4 flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-dim)] border border-[var(--accent)]/30 px-3 py-1 text-xs font-medium text-accent">
              📚 {docs.length} {t.chapter.lessonsUnit}
            </span>
          </div>
        </div>
      </section>

      <ChapterCompleteCelebration chapterSlug={slug} docCount={docs.length} />

      <TodayPick
        chapters={[{ slug, title: chapter.title, docs: docs.map((d) => ({ slug: d.slug, title: d.title })) }]}
        locale={locale}
        label={locale === "en" ? "Continue this course" : "继续本章学习"}
        hint={locale === "en" ? "Next lesson" : "下一节课程"}
        done={locale === "en" ? "Course complete" : "本章已完成"}
      />

      {introContent && (
        <section className="mt-8 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-faint mb-3">
            {t.chapter.introHeading}
          </h2>
          <Collapsible
            preview={<Markdown content={prepareForRender(introContent, locale, slug)} />}
            expandLabel={t.chapter.expandIntro}
            collapseLabel={t.chapter.collapseIntro}
          >
            <div />
          </Collapsible>
        </section>
      )}

      {QUIZZES[slug] && !QUIZZES[slug].docSlug && (
        <section className="mt-12">
          <Quiz quiz={QUIZZES[slug]} dict={t.quiz} />
        </section>
      )}

      {/* 整章测验入口：测验挂在某一节末尾，这里给入口 */}
      {QUIZZES[slug]?.docSlug && (
        <Link
          href={p(`/knowledge/${slug}/${QUIZZES[slug].docSlug}`)}
          className="mt-8 flex items-center justify-between gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 hover:border-[var(--accent)]/50 transition group"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl" aria-hidden>📝</span>
            <div>
              <p className="font-semibold text-sm group-hover:text-accent transition-colors">
                {QUIZZES[slug].title}
              </p>
              <p className="text-xs text-faint">
                {QUIZZES[slug].questions.length} {t.quiz.questionsUnit}
              </p>
            </div>
          </div>
          <span className="text-accent group-hover:translate-x-1 transition-transform shrink-0">→</span>
        </Link>
      )}

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-faint mb-4">
          {t.chapter.coursesHeading}
        </h2>
        <DocList metas={docs} chapterSlug={slug} locale={locale} />
      </section>

      <ChapterSummaryAi
        chapter={slug}
        title={chapter.title}
        locale={locale}
        aiEnabled={aiEnabledForPage()}
        dict={{
          title: t.chapter.aiSummaryTitle,
          generate: t.chapter.aiSummaryGenerate,
          generating: t.chapter.aiSummaryGenerating,
          error: t.chapter.aiSummaryError,
        }}
      />

      {/* 下一篇章 CTA */}
      {nextChapter && (
        <section className="mt-12">
          <Link
            href={p(`/knowledge/${nextChapter.slug}`)}
            className="group block rounded-2xl border border-[var(--accent)]/30 bg-gradient-to-br from-[var(--accent-dim)] to-transparent p-6 hover:border-[var(--accent)]/60 transition"
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-accent">
              {t.chapter.nextChapter} →
            </p>
            <p className="mt-2 text-lg font-bold group-hover:text-accent transition-colors">
              {nextChapter.title}
            </p>
            <p className="mt-1 text-sm text-muted line-clamp-2">
              {nextChapter.tagline}
            </p>
          </Link>
        </section>
      )}
    </div>
  );
}
