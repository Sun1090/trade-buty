/** 回放训练历史：每轮猜涨跌成绩存 localStorage，最多保留 100 条 */
import { tryDispatchProgressEvent } from "./progress-helpers";

const KEY = "tb-replay-history";

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
}
