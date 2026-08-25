import { describe, it, expect, beforeEach, vi } from "vitest";

const store = new Map<string, string>();
const localStorageMock = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => store.set(k, v),
  removeItem: (k: string) => store.delete(k),
  key: (i: number) => Array.from(store.keys())[i] ?? null,
  get length() {
    return store.size;
  },
  clear: () => store.clear(),
};
vi.stubGlobal("localStorage", localStorageMock);
vi.stubGlobal("window", { dispatchEvent: () => {} });

const { readBookmarks, isBookmarked, toggleBookmark } = await import("./bookmarks");

describe("bookmarks", () => {
  beforeEach(() => store.clear());

  it("空收藏", () => {
    expect(Object.keys(readBookmarks())).toHaveLength(0);
    expect(isBookmarked("spot", "a")).toBe(false);
  });

  it("toggleBookmark 切换", () => {
    expect(toggleBookmark("spot", "a", "标题A")).toBe(true);
    expect(isBookmarked("spot", "a")).toBe(true);
    expect(toggleBookmark("spot", "a", "标题A")).toBe(false);
    expect(isBookmarked("spot", "a")).toBe(false);
  });

  it("多章节独立", () => {
    toggleBookmark("spot", "a", "A");
    toggleBookmark("futures", "b", "B");
    expect(isBookmarked("spot", "a")).toBe(true);
    expect(isBookmarked("futures", "b")).toBe(true);
    expect(isBookmarked("spot", "b")).toBe(false);
  });

  it("readBookmarks 返回数据结构", () => {
    toggleBookmark("spot", "a", "标题A");
    const all = readBookmarks();
    const key = Object.keys(all)[0];
    expect(all[key].title).toBe("标题A");
    expect(typeof all[key].at).toBe("number");
  });
});
