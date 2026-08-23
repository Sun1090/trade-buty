"use client";

import Link from "next/link";
import { useLocalProgress } from "@/components/use-local-progress";

interface RailDict {
  nextChapter: string;
  progressLabel: string;
  lessonsUnit: string;
}

interface NextChapter {
  slug: string;
  title: string;
  tagline: string;
}

/**
 * 单课页左侧栏：篇章进度 + 下一篇章 CTA。
 * 不重复课程列表（那是篇章页的事），保持精简。
 */
export function ChapterRail({
  chapterSlug,
  chapterTitle,
  chapterTagline,
  docCount,
  nextChapter,
  locale,
  dict,
}: {
  chapterSlug: string;
  chapterTitle: string;
  chapterTagline: string;
  docCount: number;
  nextChapter: NextChapter | null;
  locale: string;
  dict: RailDict;
}) {
  const progress = useLocalProgress();
  const readCount = progress?.[chapterSlug]?.length ?? 0;
  const pct = docCount > 0 ? Math.round((readCount / docCount) * 100) : 0;
  const done = readCount >= docCount && docCount > 0;

  return (
    <aside className="hidden xl:block">
      <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pr-2 space-y-6">
        {/* 篇章进度卡片 */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <Link
            href={`/${locale}/knowledge/${chapterSlug}`}
            className="block hover:text-accent transition-colors"
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-faint mb-2">
              {dict.progressLabel}
            </p>
            <h2 className="font-bold text-sm leading-snug">
              {chapterTitle}
            </h2>
          </Link>
          <p className="mt-1.5 text-xs text-faint line-clamp-2 leading-relaxed">
            {chapterTagline}
          </p>
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-faint">
                {readCount}/{docCount} {dict.lessonsUnit}
              </span>
              <span className="text-xs font-mono text-accent">{pct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-accent-strong to-accent transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
          {done && (
            <p className="mt-3 text-xs text-accent font-medium">
              ✓ {dict.progressLabel} 100%
            </p>
          )}
        </div>

        {/* 下一篇章 */}
        {nextChapter && (
          <Link
            href={`/${locale}/knowledge/${nextChapter.slug}`}
            className="block rounded-2xl border border-[var(--accent)]/30 bg-gradient-to-br from-[var(--accent-dim)] to-transparent p-5 hover:border-[var(--accent)]/60 transition group"
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-accent">
              {dict.nextChapter} →
            </p>
            <p className="mt-1.5 font-semibold text-sm group-hover:text-accent transition-colors flex items-center gap-1">
              {nextChapter.title}
              <span className="opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all">→</span>
            </p>
            <p className="mt-1 text-xs text-faint line-clamp-2 leading-relaxed">
              {nextChapter.tagline}
            </p>
          </Link>
        )}
      </div>
    </aside>
  );
}
