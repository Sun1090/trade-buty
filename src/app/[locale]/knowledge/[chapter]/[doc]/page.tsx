import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { SITE_URL } from "@/lib/site";
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
import { FontSizeControl } from "@/components/font-size-control";
import { BookmarkButton } from "@/components/bookmark-button";
import { RelatedCourses } from "@/components/related-courses";
import { ReadingTimeTracker } from "@/components/reading-time-tracker";
import { ReadingTimeDisplay } from "@/components/reading-time-display";
import { CopyLinkButton } from "@/components/copy-link-button";
import { ReadAloud } from "@/components/read-aloud";
import { FocusMode } from "@/components/focus-mode";
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
  const { locale, chapter, doc: docSlug } = await params;
  const doc = getDoc("zh", chapter, docSlug);
  if (!doc) return {};
  return {
    title: doc.title,
    description: doc.description,
    alternates: {
      canonical: `/${locale}/knowledge/${chapter}/${docSlug}`,
    },
  };
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
  const lessonIndex = Math.max(0, docMetas.findIndex((meta) => meta.slug === docSlug));
  const { prev: prevChapter, next: nextChapter } = getAdjacentChapters(locale, chapterSlug);
  const nextChapterMeta = nextChapter
    ? {
        slug: nextChapter.slug,
        title: nextChapter.title,
        tagline: nextChapter.tagline,
      }
    : null;

  const headings = extractHeadings(doc.content);
  const tools = t.docTools;
  const tocLabel = locale === "en" ? "On this page" : "本页目录";

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
            docCount={docMetas.length}
            docs={docMetas.map((d) => ({ slug: d.slug, title: d.title }))}
            currentDoc={docSlug}
            nextChapter={nextChapterMeta}
            locale={locale}
            dict={{
              nextChapter: t.chapter.nextChapter,
              progressLabel: t.chapter.progressLabel,
              lessonsUnit: t.chapter.lessonsUnit,
              unreadLabel: locale === "en" ? "Unread" : "未读",
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

      {/* 课程标题 hero 区 */}
      <header className="mb-8 rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[var(--accent-dim)] via-[var(--surface)] to-[var(--surface)] p-6 sm:p-8">
        <MarkRead chapterNum={chapterSlug} docSlug={docSlug} />
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-accent">
          <span className="rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1">
            {locale === "zh" ? "课程单元" : "Lesson"} {String(lessonIndex + 1).padStart(2, "0")}
          </span>
          <span className="text-faint">/</span>
          <span className="text-faint">
            {lessonIndex + 1} / {docMetas.length} {locale === "zh" ? "节" : "lessons"}
          </span>
        </div>
        <h1 className="mt-4 text-2xl sm:text-3xl font-bold">{doc.title}</h1>
        {doc.description && (
          <p className="mt-2 text-sm text-muted leading-relaxed">
            {doc.description}
          </p>
        )}
        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <FontSizeControl labels={{ smaller: tools.fontSmaller, larger: tools.fontLarger }} />
          <BookmarkButton
            chapter={chapterSlug}
            doc={docSlug}
            title={doc.title}
            label={{ bookmark: tools.bookmark, bookmarked: tools.bookmarked }}
            labeled
          />
          <CopyLinkButton label={locale === "en" ? "Copy link" : "复制链接"} copiedLabel={locale === "en" ? "Copied ✓" : "已复制 ✓"} />
          <ReadAloud text={doc.content} label={locale === "en" ? "Read aloud" : "朗读"} playingLabel={locale === "en" ? "Stop" : "停止"} locale={locale} />
          <FocusMode label={locale === "en" ? "Focus" : "专注"} activeLabel={locale === "en" ? "Exit focus" : "退出专注"} />
          <span className="ml-auto">
            <ReadingTimeDisplay chapter={chapterSlug} doc={docSlug} label={locale === "en" ? "read" : "已读"} />
          </span>
        </div>
      </header>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: doc.title,
            description: doc.description,
            author: { "@type": "Organization", name: "Trade Buty" },
            publisher: {
              "@type": "Organization",
              name: "Trade Buty",
              logo: { "@type": "ImageObject", url: `${SITE_URL}/icon` },
            },
            inLanguage: locale === "zh" ? "zh-CN" : "en",
            isPartOf: {
              "@type": "Course",
              name: chapter?.title,
            },
          }),
        }}
      />

      <ReadingTimeTracker chapter={chapterSlug} doc={docSlug} />
      {headings.length >= 3 && (
        <details className="xl:hidden mb-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-3">
          <summary className="cursor-pointer text-sm font-medium list-none flex items-center justify-between [&::-webkit-details-marker]:hidden">
            {tocLabel}
            <span aria-hidden className="text-faint text-xs">▾</span>
          </summary>
          <ul className="mt-3 space-y-1.5 pb-1">
            {headings.map((h) => (
              <li key={h.id}>
                <a
                  href={`#${h.id}`}
                  className={`block text-sm text-muted hover:text-accent transition ${h.depth === 3 ? "pl-4" : ""}`}
                >
                  {h.text}
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}
      <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
        <Markdown content={prepareForRender(doc.content, locale, chapterSlug)} />
      </article>

      {/* 测验 + 边学边练 双栏 */}
      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        {QUIZZES[chapterSlug] && (
          <ChapterExamCard quiz={QUIZZES[chapterSlug]} dict={t.quiz} />
        )}
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
          <aside className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-semibold">{t.doc.practiceTitle}</p>
              <p className="mt-1 text-sm text-muted">{t.doc.practiceBody}</p>
            </div>
            <Link
              href={p("/chart")}
              className="rounded-full bg-accent-strong hover:bg-accent text-white dark:text-[#06281c] font-semibold px-5 py-2.5 transition shrink-0 text-sm"
            >
              {t.doc.practiceCta}
            </Link>
          </aside>
        )}
      </div>

      {/* 问 AI */}
      <Link
        href={`${p("/ai")}?q=${encodeURIComponent(locale === "en" ? `Summarize the key points of "${doc.title}"` : `帮我总结《${doc.title}》的要点`)}`}
        className="mt-4 flex items-center justify-between gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 hover:border-[var(--accent)]/50 transition group"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl" aria-hidden>🤖</span>
          <div>
            <p className="font-semibold text-sm group-hover:text-accent transition-colors">
              {t.ai.askAbout} {doc.title}
            </p>
            <p className="text-xs text-faint">{t.ai.subtitle}</p>
          </div>
        </div>
        <span className="text-accent group-hover:translate-x-1 transition-transform shrink-0">→</span>
      </Link>

      <RelatedCourses
        locale={locale}
        chapterSlug={chapterSlug}
        currentDoc={docSlug}
        exclude={chapterSlug === "technical-analysis" ? docSlug : ""}
        label={t.doc.relatedCourses}
      />

      {/* 上一篇章（如果当前是第一章首篇，无） */}
      {prevChapter && !prev && (
        <Link
          href={p(`/knowledge/${prevChapter.slug}`)}
          className="group flex items-center justify-between gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 hover:border-[var(--accent)]/40 transition mb-4"
        >
          <span className="text-2xl text-faint group-hover:-translate-x-1 transition-transform shrink-0">
            ←
          </span>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-widest text-faint">
              {t.chapter.prevChapter ?? "Previous chapter"}
            </p>
            <p className="mt-1 font-semibold group-hover:text-accent transition-colors">
              {prevChapter.title}
            </p>
          </div>
        </Link>
      )}

      {/* 主 CTA：下一篇 / 回篇章 / 下一篇章 */}
      <div className="mt-8">
        {next ? (
          <Link
            href={p(`/knowledge/${chapterSlug}/${next.slug}`)}
            className="group flex items-center justify-between gap-4 rounded-2xl border border-[var(--accent)]/30 bg-gradient-to-br from-[var(--accent-dim)] to-transparent p-5 hover:border-[var(--accent)]/60 transition"
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-accent">
                {t.doc.next}
              </p>
              <p className="mt-1 font-semibold group-hover:text-accent transition-colors">
                {next.title}
              </p>
            </div>
            <span className="text-2xl text-accent group-hover:translate-x-1 transition-transform shrink-0">
              →
            </span>
          </Link>
        ) : nextChapterMeta ? (
          <Link
            href={p(`/knowledge/${nextChapterMeta.slug}`)}
            className="group flex items-center justify-between gap-4 rounded-2xl border border-[var(--accent)]/30 bg-gradient-to-br from-[var(--accent-dim)] to-transparent p-5 hover:border-[var(--accent)]/60 transition"
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-accent">
                {t.chapter.nextChapter}
              </p>
              <p className="mt-1 font-semibold group-hover:text-accent transition-colors">
                {nextChapterMeta.title}
              </p>
            </div>
            <span className="text-2xl text-accent group-hover:translate-x-1 transition-transform shrink-0">
              →
            </span>
          </Link>
        ) : (
          <Link
            href={p(`/knowledge/${chapterSlug}`)}
            className="group flex items-center justify-between gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 hover:border-[var(--accent)]/40 transition"
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-faint">
                {t.nav.path}
              </p>
              <p className="mt-1 font-semibold group-hover:text-accent transition-colors">
                {chapter?.title}
              </p>
            </div>
            <span className="text-2xl text-faint group-hover:translate-x-1 transition-transform shrink-0">
              →
            </span>
          </Link>
        )}
      </div>
        </div>
      </div>
    </div>
    </div>
  );
}
