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
  const progress = useLocalProgress();
  const readSet = new Set(progress?.[chapterSlug] ?? []);
  const pct = Math.round((readSet.size / metas.length) * 100);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="h-1.5 w-24 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-accent transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-xs font-mono text-accent">
          {readSet.size}/{metas.length}
        </span>
      </div>
      <ol className="space-y-3">
        {metas.map((d) => {
          const read = readSet.has(d.slug);
          return (
            <li key={d.slug}>
              <Link
                href={`/${locale}/knowledge/${chapterSlug}/${d.slug}`}
                className="block rounded-lg border border-[var(--border)] bg-[var(--surface)] px-5 py-4 hover:border-[var(--accent)]/50 transition"
              >
                <span className="flex items-center gap-2.5">
                  <span
                    aria-hidden
                    className={`shrink-0 flex h-5 w-5 items-center justify-center rounded-full text-[11px] border ${
                      read
                        ? "bg-accent border-accent text-[#06281c]"
                        : "border-[var(--border-strong)] text-transparent"
                    }`}
                  >
                    ✓
                  </span>
                  <span className="font-medium">{d.title}</span>
                </span>
                {d.description && (
                  <p className="mt-1 pl-[30px] text-sm text-faint line-clamp-2">
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
