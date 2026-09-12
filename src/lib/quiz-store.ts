"use client";

/** 测验成绩本地存储 + 云端双写（抽出原 quiz.tsx 内联逻辑） */

import { syncQuizUpsert } from "@/lib/sync-layer";
import { writeQuizAttempt } from "@/lib/quiz-attempt-ledger";
import { isRecord, readStorageJson } from "@/lib/storage-json";

const KEY = (ch: string) => `tb-quiz-${ch}`;

export interface QuizProgress {
  best: number;
  done: boolean;
}

export function readQuizProgress(chapterNum: string): QuizProgress | null {
  const parsed = readStorageJson(KEY(chapterNum));
  if (!isRecord(parsed)) return null;
  if (
    typeof parsed.best !== "number" ||
    !Number.isFinite(parsed.best) ||
    parsed.best < 0 ||
    typeof parsed.done !== "boolean"
  ) {
    return null;
  }
  return { best: Math.round(parsed.best), done: parsed.done };
}

/**
 * 保存测验成绩：写 localStorage + 双写云端
 * @param total 该章题目总数（云端记录用）
 */
export function saveQuizProgress(
  chapterNum: string,
  progress: QuizProgress,
  total: number,
) {
  try {
    localStorage.setItem(KEY(chapterNum), JSON.stringify(progress));
  } catch {
    // 存储不可用时仅内存保留
  }
  // R12.3：记录测验历史台账；仅新完成记录，不去重更新旧日期
  if (progress.done && progress.best > 0) {
    writeQuizAttempt(localStorage, chapterNum, progress.best, total);
  }
  // dispatch 让消费方刷新（quiz 原来不参与事件，加入后错题本/进度联动更顺）
  try {
    window.dispatchEvent(new Event("tb-progress"));
  } catch {
    // ignore
  }
  syncQuizUpsert(chapterNum, progress.best, total);
}
