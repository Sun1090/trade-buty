import type { QuizAttemptEntry } from "./quiz-score-trend";

const KEY = "tb-quiz-attempts";
type QuizLedger = Record<string, QuizAttemptEntry>;

export function readQuizAttemptLedger(storage: Storage = globalThis.localStorage): QuizLedger {
  if (!storage) return {};
  try {
    const parsed = JSON.parse(storage.getItem(KEY) ?? "{}") as Record<string, unknown>;
    const out: QuizLedger = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (value && typeof value === "object" && !Array.isArray(value)) out[key] = value as QuizAttemptEntry;
    }
    return out;
  } catch {
    return {};
  }
}

export function writeQuizAttempt(storage: Storage = globalThis.localStorage, chapter: string, best: number, total: number, at = Date.now()): void {
  try {
    const ledger = readQuizAttemptLedger(storage);
    const safeAt = Number.isFinite(at) && at > 0 ? Math.round(at) : Date.now();
    const safeBest = Math.max(0, Math.round(best));
    const safeTotal = Math.max(1, Math.round(total));
    const key = `${chapter}:${safeAt}`;
    if (safeBest > 0 && !ledger[key]) {
      ledger[key] = { chapter, best: safeBest, total: safeTotal, at: safeAt };
      storage.setItem(KEY, JSON.stringify(ledger));
    }
  } catch {
    // Best-effort local history; current best remains authoritative in tb-quiz-{chapter}.
  }
}
