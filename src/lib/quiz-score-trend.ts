import { localDateStr, shiftDate } from "./date-utils";

export interface QuizChapterInput {
  slug: string;
  questions: number;
}

export interface QuizProgressInput {
  best?: unknown;
  done?: unknown;
}

export interface QuizAttemptEntry {
  chapter?: string;
  best?: unknown;
  total?: unknown;
  at?: unknown;
}

export interface QuizScoreBucket {
  date: string;
  attempts: number;
  bestPct: number;
  bestScoreText: string | null;
}

export interface QuizScoreTrend {
  version: 1;
  days: QuizScoreBucket[];
  latest: {
    doneQuizzes: number;
    totalQuizzes: number;
    bestPct: number | null;
    avgPct: number | null;
    perfectQuizzes: number;
  };
  summary: {
    attemptsInRange: number;
    bestInRangeScore: number | null;
    bestInRangeTotal: number | null;
    bestInRangePct: number | null;
    bestInRangeText: string | null;
    activeDays: number;
    averageAttemptsPerDay: number;
  };
  dataSource: "local-quiz-ledger" | "current-quiz-progress-only";
  hasLedger: boolean;
  warnings: string[];
}

const safeNonNegative = (value: unknown): number => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
};

const safePct = (best: number, total: number): number | null => {
  if (total <= 0 || best <= 0) return null;
  return Math.round(Math.min(100, Math.max(0, (best / total) * 100)));
};

export function normalizeQuizLedger(raw: Record<string, unknown> | undefined | null): Record<string, QuizAttemptEntry> {
  if (!raw) return {};
  const out: Record<string, QuizAttemptEntry> = {};
  for (const [key, entry] of Object.entries(raw)) {
    if (typeof key !== "string" || key.length === 0) continue;
    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      out[key] = entry as QuizAttemptEntry;
    }
  }
  return out;
}

export function readQuizLedger(storage: Storage = globalThis.localStorage): Record<string, QuizAttemptEntry> {
  if (!storage) return {};
  try {
    return normalizeQuizLedger(JSON.parse(storage.getItem("tb-quiz-attempts") ?? "{}") as Record<string, unknown>);
  } catch {
    return {};
  }
}

const dateOfTimestamp = (value: unknown, fallback: string): string =>
  Number.isFinite(safeNonNegative(value)) && safeNonNegative(value) > 0 ? localDateStr(new Date(safeNonNegative(value))) : fallback;

export function buildQuizScoreTrend(input: {
  chapters: QuizChapterInput[];
  progress?: Record<string, QuizProgressInput | null | undefined>;
  attempts?: Record<string, unknown>;
  days?: number;
  today?: string;
}): QuizScoreTrend {
  const chapters = input.chapters.filter((chapter) => chapter && typeof chapter.slug === "string" && chapter.slug.length > 0);
  const progress = input.progress ?? {};
  const attempts = normalizeQuizLedger(input.attempts);
  const hasLedger = Object.keys(attempts).length > 0;
  const today = input.today && /^\d{4}-\d{2}-\d{2}$/.test(input.today) ? input.today : localDateStr();
  const requestedDays = Number(input.days);
  const days = Math.min(365, Math.max(7, Number.isFinite(requestedDays) && requestedDays > 0 ? Math.round(requestedDays) : 7));

  const currentByChapter = new Map<string, { best: number; total: number; done: boolean }>();
  for (const chapter of chapters) {
    const raw = progress[chapter.slug];
    const best = raw ? safeNonNegative(raw.best) : 0;
    const total = safeNonNegative(chapter.questions);
    const done = Boolean(raw?.done) || best > 0;
    currentByChapter.set(chapter.slug, { best: Math.min(best, total || best), total: total || Math.max(1, best), done });
  }

  const warnings: string[] = [];
  if (!hasLedger) warnings.push("no-quiz-attempt-dates");

  const orderedAttempts = Object.entries(attempts).flatMap(([key, rawEntry]) => {
    const chapter = typeof rawEntry.chapter === "string" && rawEntry.chapter ? rawEntry.chapter : key.split(":")[0];
    if (!chapter || !currentByChapter.has(chapter)) return [];
    const total = Math.max(1, safeNonNegative(rawEntry.total) || safeNonNegative(currentByChapter.get(chapter)!.total));
    const best = Math.min(safeNonNegative(rawEntry.best), total);
    if (best <= 0) return [];
    return [{ chapter, best, total, at: safeNonNegative(rawEntry.at), date: dateOfTimestamp(rawEntry.at, today) }];
  }).sort((a, b) => (a.at - b.at) || a.chapter.localeCompare(b.chapter));

  const dayScores = new Map<string, { attempts: number; bestPct: number; bestScoreText: string | null }>();
  const startDate = shiftDate(today, -(days - 1));
  const buckets: QuizScoreBucket[] = [];
  let bestInRangeScore: number | null = null;
  let bestInRangeTotal: number | null = null;
  let bestInRangePct: number | null = null;
  let bestInRangeText: string | null = null;

  for (let i = 0; i < days; i++) {
    const date = shiftDate(startDate, i);
    const events = orderedAttempts.filter((event) => event.date === date);
    let bestPct: number | null = null;
    let bestScoreText: string | null = null;
    for (const event of events) {
      const pct = safePct(event.best, event.total);
      if (pct !== null && (bestPct === null || pct > bestPct || (pct === bestPct && event.best > event.total - event.best))) {
        bestPct = pct;
        bestScoreText = `${event.best}/${event.total}`;
      }
    }
    if (bestPct !== null && events.length > 0) {
      dayScores.set(date, { attempts: events.length, bestPct, bestScoreText });
      const dayBest = events.reduce((top, event) => (event.best > (top?.best ?? -1) ? event : top), null as { best: number; total: number } | null);
      if (dayBest && (bestInRangeScore === null || dayBest.best > bestInRangeScore)) {
        bestInRangeScore = dayBest.best;
        bestInRangeTotal = dayBest.total;
        bestInRangePct = safePct(dayBest.best, dayBest.total);
        bestInRangeText = `${dayBest.best}/${dayBest.total}`;
      }
    }
    const current = dayScores.get(date);
    buckets.push({
      date,
      attempts: current?.attempts ?? 0,
      bestPct: current?.bestPct ?? 0,
      bestScoreText: current?.bestScoreText ?? null,
    });
  }

  const currentScores = [...currentByChapter.values()].filter((item) => item.done && item.best > 0).map((item) => ({
    ...item,
    pct: safePct(item.best, item.total) ?? 0,
  }));
  const doneQuizzes = currentScores.length;
  const bestPct = currentScores.length ? Math.max(...currentScores.map((item) => item.pct)) : null;
  const avgPct = currentScores.length ? Math.round(currentScores.reduce((sum, item) => sum + item.pct, 0) / currentScores.length) : null;

  return {
    version: 1,
    days: buckets,
    latest: {
      doneQuizzes,
      totalQuizzes: chapters.length,
      bestPct,
      avgPct,
      perfectQuizzes: currentScores.filter((item) => item.best >= item.total).length,
    },
    summary: {
      attemptsInRange: buckets.reduce((sum, bucket) => sum + bucket.attempts, 0),
      bestInRangeScore,
      bestInRangeTotal,
      bestInRangePct: bestInRangePct,
      bestInRangeText: bestInRangeText,
      activeDays: buckets.filter((bucket) => bucket.attempts > 0).length,
      averageAttemptsPerDay: Math.round((buckets.reduce((sum, bucket) => sum + bucket.attempts, 0) / days) * 10) / 10,
    },
    dataSource: hasLedger ? "local-quiz-ledger" : "current-quiz-progress-only",
    hasLedger,
    warnings,
  };
}
