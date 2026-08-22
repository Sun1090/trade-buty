"use client";

/** 测验成绩本地存储 + 云端双写（抽出原 quiz.tsx 内联逻辑） */

import { syncQuizUpsert } from "@/lib/sync-layer";

const KEY = (ch: string) => `tb-quiz-${ch}`;

export interface QuizProgress {
  best: number;
  done: boolean;
}

export function readQuizProgress(chapterNum: string): QuizProgress | null {
  try {
    const raw = localStorage.getItem(KEY(chapterNum));
    return raw ? (JSON.parse(raw) as QuizProgress) : null;
  } catch {
    return null;
  }
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
  // dispatch 让消费方刷新（quiz 原来不参与事件，加入后错题本/进度联动更顺）
  try {
    window.dispatchEvent(new Event("tb-progress"));
  } catch {
    // ignore
  }
  syncQuizUpsert(chapterNum, progress.best, total);
}
