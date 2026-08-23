"use client";

import Link from "next/link";
import type { DocMeta } from "@/lib/content";
import { useLocalProgress } from "@/components/use-local-progress";

export function DocList({
  metas,
  chapterSlug,
  locale,
}: {
  metas: DocMeta[];
  chapterSlug: string;
  locale: string;
}) {
  const emptyLabel = locale === "en" ? "No lessons yet." : "暂无课程。";
  const progress = useLocalProgress();
  const readSet = new Set(progress?.[chapterSlug] ?? []);

  if (metas.length === 0) {
    return (
      <p className="text-sm text-faint py-4">{emptyLabel}</p>
    );
  }

  const pct = Math.round((readSet.size / metas.length) * 100);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="h-2 w-32 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-accent-strong to-accent transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-xs font-mono text-accent">
          {readSet.size}/{metas.length}
        </span>
      </div>
      <ol className="space-y-2.5">
        {metas.map((d, i) => {
          const read = readSet.has(d.slug);
          return (
            <li key={d.slug}>
              <Link
                href={`/${locale}/knowledge/${chapterSlug}/${d.slug}`}
                className={`group block rounded-xl border px-5 py-4 hover:bg-[var(--surface-hover)] hover:border-[var(--accent)]/50 hover:-translate-y-0.5 transition-all ${
                  read
                    ? "border-[var(--accent)]/40 border-l-2 border-l-accent bg-gradient-to-r from-[var(--accent-dim)] to-transparent"
                    : "border-[var(--border)] bg-[var(--surface)]"
                }`}
              >
                <span className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className={`shrink-0 flex h-7 w-7 items-center justify-center rounded-lg font-mono text-xs font-bold border ${
                      read
                        ? "bg-accent border-accent text-[#06281c]"
                        : "border-[var(--border-strong)] text-faint"
                    }`}
                  >
                    {read ? "✓" : String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="font-medium group-hover:text-accent transition-colors">
                    {d.title}
                  </span>
                </span>
                {d.description && (
                  <p className="mt-1.5 pl-10 text-sm text-faint line-clamp-2">
                    {d.description}
                  </p>
                )}
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
