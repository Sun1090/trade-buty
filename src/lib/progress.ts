"use client";

/** 学习进度：localStorage 记录已读的 {章节号: [文档号]}，登录后双写云端 */

import { syncProgressWrite } from "./sync-layer";
import { touchStreak } from "./streak";

const KEY = "tb-progress";
const COMPLETIONS_KEY = "tb-progress-completions";

export type ProgressMap = Record<string, string[]>;
export type ProgressCompletionEntry = { chapter?: string; doc?: string; at?: number };
export type ProgressCompletionMap = Record<string, ProgressCompletionEntry>;

export function readProgress(): ProgressMap {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as ProgressMap;
  } catch {
    return {};
  }
}

export function readProgressCompletions(): ProgressCompletionMap {
  try {
    const parsed = JSON.parse(localStorage.getItem(COMPLETIONS_KEY) ?? "{}") as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as ProgressCompletionMap;
  } catch {
    return {};
  }
}

export function markRead(chapterNum: string, docSlug: string) {
  const p = readProgress();
  const list = new Set(p[chapterNum] ?? []);
  const isNew = !list.has(docSlug);
  list.add(docSlug);
  p[chapterNum] = [...list];
  write(p);
  if (isNew) writeProgressCompletion(chapterNum, docSlug);
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

function writeProgressCompletion(chapterNum: string, docSlug: string, at = Date.now()) {
  try {
    const completions = readProgressCompletions();
    const key = `${chapterNum}:${docSlug}`;
    if (completions[key]) return;
    completions[key] = { chapter: chapterNum, doc: docSlug, at };
    localStorage.setItem(COMPLETIONS_KEY, JSON.stringify(completions));
  } catch {
    // 存储不可用时静默降级
  }
}
