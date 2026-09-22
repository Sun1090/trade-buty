/** 回放训练历史 + 最佳连击：localStorage + 云端双写 */
import { tryDispatchProgressEvent } from "./progress-helpers";
import { REPLAY_HISTORY_KEEP } from "./replay-history-limit";
import { isRecord, readStorageJson } from "./storage-json";
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
  /** R12.5：本轮耗时（秒）。旧记录缺省，统计时按无时长处理，不回推 */
  durationSec?: number;
}

export function readReplayHistory(): ReplayRecord[] {
  const parsed = readStorageJson(KEY);
  if (!Array.isArray(parsed)) return [];

  const out: ReplayRecord[] = [];
  for (const value of parsed) {
    if (!isRecord(value)) continue;
    if (typeof value.symbol !== "string" || typeof value.interval !== "string") {
      continue;
    }
    const at = value.at;
    const total = value.total;
    const correct = value.correct;
    const bestStreak = value.bestStreak;
    if (
      typeof at !== "number" || !Number.isFinite(at) || at < 0 ||
      typeof total !== "number" || !Number.isFinite(total) || total < 0 ||
      typeof correct !== "number" || !Number.isFinite(correct) || correct < 0 ||
      typeof bestStreak !== "number" || !Number.isFinite(bestStreak) || bestStreak < 0
    ) {
      continue;
    }
    const normalizedTotal = Math.round(total);
    const record: ReplayRecord = {
      at: Math.round(at),
      symbol: value.symbol,
      interval: value.interval,
      total: normalizedTotal,
      correct: Math.min(Math.round(correct), normalizedTotal),
      bestStreak: Math.min(Math.round(bestStreak), normalizedTotal),
    };
    if (
      typeof value.durationSec === "number" &&
      Number.isFinite(value.durationSec) &&
      value.durationSec >= 0
    ) {
      record.durationSec = Math.round(value.durationSec);
    }
    out.push(record);
  }
  return out;
}

export function saveReplayRecord(rec: Omit<ReplayRecord, "at">) {
  const all = readReplayHistory();
  const record: ReplayRecord = { ...rec, at: Date.now() };
  const trimmed = [...all, record].slice(-REPLAY_HISTORY_KEEP);
  try {
    localStorage.setItem(KEY, JSON.stringify(trimmed));
    tryDispatchProgressEvent();
  } catch {
    // ignore
  }
  // 把本地这条的 `at` 一起交给云端：`recorded_at` 有 `default now()`，若让它取服务器
  // 落库时刻，云端时间与本地时间永远差一段网络延迟，合并时认不出是同一轮（每轮被记两次）。
  syncReplayHistoryWrite({ ...rec, at: record.at });
}

/** 读取历史最佳连击 */
export function readReplayBest(): number {
  try {
    const n = Number(localStorage.getItem(BEST_KEY) ?? "0");
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
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
