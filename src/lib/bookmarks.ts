/**
 * 课程书签收藏：只存这台设备的 localStorage，不进云端
 * （同步层与 Supabase 迁移里都没有 bookmarks 这张表，别照着「双写」去理解）。
 * key = chapterSlug/docSlug
 */
import { isRecord, readStorageJson, readNonNegativeNumber } from "./storage-json";

const KEY = "tb-bookmarks";

export interface BookmarkEntry {
  chapter: string;
  doc: string;
  title: string;
  at: number;
}

export function readBookmarks(): Record<string, BookmarkEntry> {
  const parsed = readStorageJson(KEY);
  if (!isRecord(parsed)) return {};

  const out: Record<string, BookmarkEntry> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (!isRecord(value)) continue;
    if (
      typeof value.chapter !== "string" ||
      typeof value.doc !== "string" ||
      typeof value.title !== "string"
    ) {
      continue;
    }
    const at = readNonNegativeNumber(value.at, Number.NaN);
    if (!Number.isFinite(at)) continue;
    out[key] = {
      chapter: value.chapter,
      doc: value.doc,
      title: value.title,
      at,
    };
  }
  return out;
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
