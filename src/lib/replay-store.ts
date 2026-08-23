/** 回放训练历史 + 最佳连击：localStorage + 云端双写 */
import { tryDispatchProgressEvent } from "./progress-helpers";
import { syncReplayHistoryWrite, syncReplayBestUpsert } from "./sync-layer";

const KEY = "tb-replay-history";
const BEST_KEY = "tb-replay-best";

export interface ReplayRecord {
  at: number;
  symbol: string;
  interval: string;
  total: number;
  correct: number;
  bestStreak: number;
}

export function readReplayHistory(): ReplayRecord[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as ReplayRecord[];
  } catch {
    return [];
  }
}

export function saveReplayRecord(rec: Omit<ReplayRecord, "at">) {
  const all = readReplayHistory();
  all.push({ ...rec, at: Date.now() });
  const trimmed = all.slice(-100);
  try {
    localStorage.setItem(KEY, JSON.stringify(trimmed));
    tryDispatchProgressEvent();
  } catch {
    // ignore
  }
  syncReplayHistoryWrite(rec);
}

/** 读取历史最佳连击 */
export function readReplayBest(): number {
  try {
    const n = parseInt(localStorage.getItem(BEST_KEY) ?? "0", 10);
    return Number.isNaN(n) ? 0 : n;
  } catch {
    return 0;
  }
}

/** 保存历史最佳连击（仅当超过当前记录时调用） */
export function saveReplayBest(best: number) {
  try {
    localStorage.setItem(BEST_KEY, String(best));
  } catch {
    // ignore
  }
  syncReplayBestUpsert(best);
  tryDispatchProgressEvent();
}
