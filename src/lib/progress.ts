"use client";

/** 学习进度：localStorage 记录已读的 {章节号: [文档号]}，登录后双写云端 */

import { syncProgressWrite } from "./sync-layer";
import { touchStreak } from "./streak";

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
  syncProgressWrite(chapterNum, docSlug);
}

function write(p: ProgressMap) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
    touchStreak();
    window.dispatchEvent(new Event("tb-progress"));
  } catch {
    // 存储不可用时静默降级
  }
}
