"use client";

import Link from "next/link";
import type { DocMeta } from "@/lib/content";
import { useLocalProgress } from "@/components/use-local-progress";

interface RailDict {
  coursesHeading: string;
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
 * 单课页左侧栏：篇章标题 + 进度条 + 本篇课程精简列表 + 下一篇章 CTA。
 * 桌面 xl+ 显示（sticky），移动端隐藏。
 */
export function ChapterRail({
  chapterSlug,
  chapterTitle,
  chapterTagline,
  docMetas,
  currentDocSlug,
  nextChapter,
  locale,
  dict,
}: {
  chapterSlug: string;
  chapterTitle: string;
  chapterTagline: string;
  docMetas: DocMeta[];
  currentDocSlug: string;
  nextChapter: NextChapter | null;
  locale: string;
  dict: RailDict;
}) {
  const progress = useLocalProgress();
  const readSet = new Set(progress?.[chapterSlug] ?? []);
  const readCount = readSet.size;
  const total = docMetas.length;
  const pct = total > 0 ? Math.round((readCount / total) * 100) : 0;

  return (
    <aside className="hidden xl:block">
      <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pr-2 space-y-6">
        {/* 篇章信息 + 进度 */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-faint mb-2">
            {dict.progressLabel}
          </p>
          <h2 className="font-bold text-sm leading-snug">{chapterTitle}</h2>
          <p className="mt-1 text-xs text-faint line-clamp-2 leading-relaxed">
            {chapterTagline}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <div className="h-1.5 flex-1 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-accent transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs font-mono text-accent shrink-0">
              {readCount}/{total}
            </span>
          </div>
        </div>

        {/* 本篇课程列表 */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-faint mb-3">
            {dict.coursesHeading}
          </p>
          <ol className="space-y-0.5 border-l border-[var(--border)]">
            {docMetas.map((d, i) => {
              const read = readSet.has(d.slug);
              const current = d.slug === currentDocSlug;
              return (
                <li key={d.slug}>
                  <Link
                    href={`/${locale}/knowledge/${chapterSlug}/${d.slug}`}
                    className={`block pl-3 py-1.5 text-xs leading-snug rounded-r transition-colors ${
                      current
                        ? "text-accent font-medium bg-[var(--accent-dim)]"
                        : read
                          ? "text-muted hover:text-foreground hover:bg-white/5"
                          : "text-faint hover:text-foreground hover:bg-white/5"
                    }`}
                  >
                    <span className="font-mono mr-1.5 text-[10px]">
                      {read ? "✓" : String(i + 1).padStart(2, "0")}
                    </span>
                    {d.title.replace(/^\d+\s*·\s*/, "")}
                  </Link>
                </li>
              );
            })}
          </ol>
        </div>

        {/* 下一篇章 */}
        {nextChapter && (
          <Link
            href={`/${locale}/knowledge/${nextChapter.slug}`}
            className="block rounded-xl border border-[var(--accent)]/30 bg-gradient-to-br from-[var(--accent-dim)] to-transparent p-4 hover:border-[var(--accent)]/60 transition group"
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-accent">
              {dict.nextChapter}
            </p>
            <p className="mt-1.5 font-semibold text-sm group-hover:text-accent transition-colors">
              {nextChapter.title}
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
