/**
 * 课程书签收藏：localStorage 存储 + 云端双写
 * key = chapterSlug/docSlug
 */
const KEY = "tb-bookmarks";

export interface BookmarkEntry {
  chapter: string;
  doc: string;
  title: string;
  at: number;
}

export function readBookmarks(): Record<string, BookmarkEntry> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, BookmarkEntry>;
  } catch {
    return {};
  }
}

export function isBookmarked(chapter: string, doc: string): boolean {
  return `${chapter}/${doc}` in readBookmarks();
}

export function toggleBookmark(chapter: string, doc: string, title: string): boolean {
  const key = `${chapter}/${doc}`;
  const all = readBookmarks();
  if (key in all) {
    delete all[key];
    try {
      localStorage.setItem(KEY, JSON.stringify(all));
      window.dispatchEvent(new Event("tb-bookmarks"));
    } catch {
      // ignore
    }
    return false;
  }
  all[key] = { chapter, doc, title, at: Date.now() };
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
    window.dispatchEvent(new Event("tb-bookmarks"));
  } catch {
    // ignore
  }
  return true;
}
