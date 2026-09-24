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
  /**
   * 收藏只存在这台设备的 localStorage 里，SSG 预渲染的那份 HTML 一条都看不见它。
   * 所以在读完之前，这一页不许替访客断言「还没有收藏课程」——那句对每一个已经收藏过
   * 的人都是假的，而且关掉 JS 就永远是假的（`bookmark-count.tsx` 同口径：没读过就不说话）。
   */
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const update = () => setBookmarks(Object.values(readBookmarks()).sort((a, b) => b.at - a.at));
    update();
    setLoaded(true);
    window.addEventListener("tb-bookmarks", update);
    return () => window.removeEventListener("tb-bookmarks", update);
  }, []);

  if (bookmarks.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[var(--accent-dim)] to-[var(--surface)] p-10 text-center">
        <p className="text-4xl" aria-hidden>☆</p>
        {loaded && <p className="mt-4 font-semibold">{emptyLabel}</p>}
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
