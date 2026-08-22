"use client";

/** 学习进度：localStorage 记录已读的 {章节号: [文档号]}，纯本地无账号 */

const KEY = "tb-progress";

export type ProgressMap = Record<string, string[]>;

export function readProgress(): ProgressMap {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as ProgressMap;
  } catch {
    return {};
  }
}

export function markRead(chapterNum: string, docSlug: string) {
  const p = readProgress();
  const list = new Set(p[chapterNum] ?? []);
  list.add(docSlug);
  p[chapterNum] = [...list];
  write(p);
}

export function clearProgress() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

function write(p: ProgressMap) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
    window.dispatchEvent(new Event("tb-progress"));
  } catch {
    // 存储不可用时静默降级
  }
}
