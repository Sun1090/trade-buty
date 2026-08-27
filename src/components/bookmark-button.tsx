"use client";

import { useSyncExternalStore } from "react";
import { isBookmarked, toggleBookmark } from "@/lib/bookmarks";

function subscribeBookmarks(callback: () => void) {
  window.addEventListener("tb-bookmarks", callback);
  return () => window.removeEventListener("tb-bookmarks", callback);
}

export function BookmarkButton({
  chapter,
  doc,
  title,
  label,
  labeled,
}: {
  chapter: string;
  doc: string;
  title: string;
  label: { bookmark: string; bookmarked: string };
  labeled?: boolean;
}) {
  const active = useSyncExternalStore(
    subscribeBookmarks,
    () => isBookmarked(chapter, doc),
    () => false, // SSR/SSG snapshot: assume not bookmarked until hydrated on the client.
  );

  return (
    <button
      onClick={() => toggleBookmark(chapter, doc, title)}
      aria-label={active ? label.bookmarked : label.bookmark}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs transition ${
        active
          ? "text-accent border border-accent/40 bg-[var(--accent-dim)]"
          : "text-faint hover:text-accent border border-[var(--border)] hover:border-accent/30"
      }`}
    >
      <span aria-hidden>{active ? "★" : "☆"}</span>
      {labeled && <span>{active ? label.bookmarked : label.bookmark}</span>}
    </button>
  );
}
