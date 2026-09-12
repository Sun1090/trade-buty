import type { ReviewAttemptEntry } from "./wrongbook-efficiency";

const KEY = "tb-review-attempts";
/** 体积上限：只保留最近 300 条复习应答（best-effort 历史，权威状态仍在 tb-wrong） */
const MAX_ENTRIES = 300;

type ReviewLedger = Record<string, ReviewAttemptEntry>;

export function readReviewAttemptLedger(
  storage: Storage = globalThis.localStorage,
): ReviewLedger {
  if (!storage) return {};
  try {
    const parsed = JSON.parse(storage.getItem(KEY) ?? "{}") as Record<string, unknown>;
    const out: ReviewLedger = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        out[key] = value as ReviewAttemptEntry;
      }
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * 记录一次 SRS 复习应答。幂等：同 `chapter:questionIdx:at` 键覆盖不重复；
 * 超限裁剪最旧条目。best-effort：写失败不影响错题本权威状态。
 */
export function writeReviewAttempt(
  storage: Storage = globalThis.localStorage,
  chapter: string,
  questionIdx: number,
  correct: boolean,
  mastered: boolean,
  stage: number,
  at = Date.now(),
): void {
  try {
    const safeAt = Number.isFinite(at) && at > 0 ? Math.round(at) : Date.now();
    const safeIdx = Number.isFinite(questionIdx) && questionIdx >= 0 ? Math.round(questionIdx) : -1;
    const safeChapter = typeof chapter === "string" ? chapter.trim() : "";
    if (!safeChapter || safeIdx < 0) return;
    const ledger = readReviewAttemptLedger(storage);
    const key = `${safeChapter}:${safeIdx}:${safeAt}`;
    if (ledger[key]) return; // 同一题同一时间戳不重复记录
    ledger[key] = {
      chapter: safeChapter,
      questionIdx: safeIdx,
      correct: correct === true,
      mastered: mastered === true,
      stage: Math.max(0, Math.round(stage)),
      at: safeAt,
    };
    // 只保留最近 MAX_ENTRIES 条，控制 localStorage 体积
    const keys = Object.keys(ledger);
    if (keys.length > MAX_ENTRIES) {
      const sorted = keys.sort((a, b) => (ledger[a].at as number) - (ledger[b].at as number));
      for (const old of sorted.slice(0, keys.length - MAX_ENTRIES)) delete ledger[old];
    }
    storage.setItem(KEY, JSON.stringify(ledger));
  } catch {
    // 台账仅为统计元数据；错题本状态（tb-wrong）才是权威。
  }
}
