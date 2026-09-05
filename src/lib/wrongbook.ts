/** 本地错题本 + 云端双写：key = `${chapterNum}:${questionIdx}`，答对后移出 */

import { syncWrongbookWrite, syncWrongbookDelete } from "./sync-layer";
import { touchStreak } from "./streak";
import { srsOnAnswer, type SrsOutcome } from "./srs";

const KEY = "tb-wrong";

export interface WrongEntry {
  chapterNum: string;
  questionIdx: number;
  picked: number;
  at: number;
  /** R5：SRS 阶段（缺省 = 旧数据，读取时按 at 回填） */
  srsStage?: number;
  /** R5：下次复习日期 YYYY-MM-DD（缺省同上） */
  srsDue?: string;
}

/**
 * R5.5：复习应答转移——答对推进/掌握，答错重置。
 * mastered 时移出错题本（返回 "mastered"）。
 * 幂等：同 key 覆盖，重复调用不产生重复记录。
 */
export function applySrsResult(
  chapterNum: string,
  questionIdx: number,
  correct: boolean,
  picked = -1,
): SrsOutcome {
  const w = readWrong();
  const key = `${chapterNum}:${questionIdx}`;
  const entry = w[key];
  const outcome = srsOnAnswer(
    entry?.srsDue ? { stage: entry.srsStage ?? 0, due: entry.srsDue } : null,
    correct,
  );
  if (outcome === "mastered") {
    delete w[key];
    try {
      localStorage.setItem(KEY, JSON.stringify(w));
    } catch {
      // ignore
    }
    syncWrongbookDelete(chapterNum, questionIdx);
    try {
      touchStreak();
      window.dispatchEvent(new Event("tb-progress"));
    } catch {
      // ignore
    }
    return "mastered";
  }
  w[key] = {
    chapterNum,
    questionIdx,
    picked: picked >= 0 ? picked : (entry?.picked ?? -1),
    at: entry?.at ?? Date.now(),
    srsStage: outcome.stage,
    srsDue: outcome.due,
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(w));
  } catch {
    // ignore
  }
  syncWrongbookWrite(chapterNum, questionIdx, w[key].picked, outcome.stage, outcome.due);
  try {
    touchStreak();
    window.dispatchEvent(new Event("tb-progress"));
  } catch {
    // ignore
  }
  return outcome;
}

/**
 * R5.10：孤儿复习项清理——题库删除/章节改名后，映射不到题目的条目移除。
 */
export function pruneOrphanWrong(validKeys: Set<string>): number {
  const w = readWrong();
  let removed = 0;
  for (const key of Object.keys(w)) {
    if (!validKeys.has(key)) {
      const { chapterNum, questionIdx } = w[key];
      delete w[key];
      removed++;
      syncWrongbookDelete(chapterNum, questionIdx);
    }
  }
  if (removed > 0) {
    try {
      localStorage.setItem(KEY, JSON.stringify(w));
    } catch {
      // ignore
    }
    try {
      window.dispatchEvent(new Event("tb-progress"));
    } catch {
      // ignore
    }
  }
  return removed;
}

export function readWrong(): Record<string, WrongEntry> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<
      string,
      WrongEntry
    >;
  } catch {
    return {};
  }
}

export function recordWrong(chapterNum: string, questionIdx: number, picked: number) {
  const w = readWrong();
  w[`${chapterNum}:${questionIdx}`] = { chapterNum, questionIdx, picked, at: Date.now() };
  try {
    localStorage.setItem(KEY, JSON.stringify(w));
  } catch {
    // ignore
  }
  try {
    touchStreak();
    window.dispatchEvent(new Event("tb-progress"));
  } catch {
    // ignore
  }
  syncWrongbookWrite(chapterNum, questionIdx, picked);
}

export function resolveWrong(chapterNum: string, questionIdx: number) {
  const w = readWrong();
  delete w[`${chapterNum}:${questionIdx}`];
  try {
    localStorage.setItem(KEY, JSON.stringify(w));
  } catch {
    // ignore
  }
  try {
    touchStreak();
    window.dispatchEvent(new Event("tb-progress"));
  } catch {
    // ignore
  }
  syncWrongbookDelete(chapterNum, questionIdx);
}

/** 清空所有错题 */
export function clearAllWrong() {
  try {
    localStorage.removeItem(KEY);
    window.dispatchEvent(new Event("tb-progress"));
  } catch {
    // ignore
  }
  // 云端清空由 sync-layer 统一处理
}
