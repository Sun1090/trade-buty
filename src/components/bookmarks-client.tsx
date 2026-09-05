"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { readBookmarks, type BookmarkEntry } from "@/lib/bookmarks";

export function BookmarksClient({
  locale,
  emptyLabel,
}: {
  locale: string;
  emptyLabel: string;
}) {
  const [bookmarks, setBookmarks] = useState<BookmarkEntry[]>([]);

  useEffect(() => {
    const update = () => setBookmarks(Object.values(readBookmarks()).sort((a, b) => b.at - a.at));
    update();
    window.addEventListener("tb-bookmarks", update);
    return () => window.removeEventListener("tb-bookmarks", update);
  }, []);

  if (bookmarks.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[var(--accent-dim)] to-[var(--surface)] p-10 text-center">
        <p className="text-4xl" aria-hidden>☆</p>
        <p className="mt-4 font-semibold">{emptyLabel}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link
            href={`/${locale}/path`}
            data-testid="bookmarks-empty-cta"
            className="inline-block rounded-full bg-accent-strong hover:bg-accent text-white dark:text-[#06281c] font-semibold px-6 py-2.5 text-sm transition"
          >
            {locale === "en" ? "Browse the learning path →" : "去看学习路线 →"}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {bookmarks.map((b) => (
        <Link
          key={`${b.chapter}/${b.doc}`}
          href={`/${locale}/knowledge/${b.chapter}/${b.doc}`}
          className="group flex items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4 hover:border-[var(--accent)]/50 hover:bg-[var(--surface-hover)] transition"
        >
          <div>
            <p className="font-semibold text-sm group-hover:text-accent transition-colors">
              {b.title}
            </p>
            <p className="mt-1 text-xs text-faint font-mono">{b.chapter}/{b.doc}</p>
          </div>
          <span className="text-accent text-sm">★</span>
        </Link>
      ))}
    </div>
  );
}
