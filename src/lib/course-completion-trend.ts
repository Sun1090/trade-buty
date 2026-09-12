import { localDateStr, shiftDate } from "./date-utils";

export interface ChapterInput {
  slug: string;
  docCount: number;
}

export interface CompletionInput {
  key: string;
  chapter: string;
  doc: string;
  at: number;
}

export interface TrendBucket {
  date: string;
  completions: number;
  newDocs: number;
  newChapters: number;
  cumulativeReadDocs: number;
  completionPct: number;
}

export interface CourseCompletionTrend {
  version: 1;
  days: TrendBucket[];
  latest: {
    readDocs: number;
    totalDocs: number;
    doneChapters: number;
    totalChapters: number;
    completionPct: number;
  };
  summary: {
    completedDocs: number;
    completionsInRange: number;
    chaptersCompletedInRange: number;
    activeDays: number;
    dailyAverageCompletions: number;
  };
  dataSource: "local-completion-ledger" | "current-progress-only";
  hasLedger: boolean;
  warnings: string[];
}

interface CompletionMap {
  [key: string]: {
    chapter?: string;
    doc?: string;
    at?: number;
  };
}

const safeNonNegative = (value: unknown): number => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
};

const safePct = (numerator: number, denominator: number): number => {
  if (denominator <= 0) return 0;
  return Math.round(Math.min(100, Math.max(0, (numerator / denominator) * 100)));
};

const dateOfTimestamp = (value: number, fallback: string): string =>
  Number.isFinite(value) && value >= 0 ? localDateStr(new Date(value)) : fallback;

export function normalizeCompletionLedger(raw: Record<string, unknown> | undefined | null): CompletionMap {
  if (!raw) return {};
  const out: CompletionMap = {};
  for (const [key, entry] of Object.entries(raw)) {
    if (typeof key !== "string" || key.length === 0) continue;
    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      out[key] = entry as CompletionMap[string];
    }
  }
  return out;
}

export function readCompletionLedger(storage: Storage = globalThis.localStorage): CompletionMap {
  if (!storage) return {};
  try {
    return normalizeCompletionLedger(JSON.parse(storage.getItem("tb-progress-completions") ?? "{}") as Record<string, unknown>);
  } catch {
    return {};
  }
}

export function buildCourseCompletionTrend(input: {
  chapters: ChapterInput[];
  progress?: Record<string, string[]>;
  completions?: Record<string, unknown>;
  days?: number;
  today?: string;
}): CourseCompletionTrend {
  const chapters = input.chapters.filter((chapter) => chapter && typeof chapter.slug === "string" && chapter.slug.length > 0);
  const totalDocs = chapters.reduce((sum, chapter) => sum + safeNonNegative(chapter.docCount), 0);
  const progress = input.progress ?? {};
  const ledger = normalizeCompletionLedger(input.completions);
  const hasLedger = Object.keys(ledger).length > 0;
  const today = input.today && /^\d{4}-\d{2}-\d{2}$/.test(input.today) ? input.today : localDateStr();
  const requestedDays = Number(input.days);
  const days = Math.min(365, Math.max(7, Number.isFinite(requestedDays) && requestedDays > 0 ? Math.round(requestedDays) : 7));

  const currentDocSet = new Set<string>();
  const currentChapterCounts = new Map<string, number>();
  let readDocs = 0;
  for (const chapter of chapters) {
    const validDocs = new Set(
      (progress[chapter.slug] ?? []).filter((doc): doc is string => typeof doc === "string" && doc.length > 0),
    );
    const count = Math.min(validDocs.size, safeNonNegative(chapter.docCount));
    currentChapterCounts.set(chapter.slug, count);
    readDocs += count;
    for (const doc of validDocs) currentDocSet.add(`${chapter.slug}:${doc}`);
  }

  const warnings: string[] = [];
  if (!hasLedger) warnings.push("no-completion-dates");

  const orderedCompletions = Object.entries(ledger).flatMap(([key, rawEntry]) => {
    const chapter = typeof rawEntry.chapter === "string" && rawEntry.chapter ? rawEntry.chapter : key.split(":")[0];
    const doc = typeof rawEntry.doc === "string" && rawEntry.doc ? rawEntry.doc : key.split(":")[1] ?? "";
    if (!chapter || !doc) return [];
    const normalizedKey = `${chapter}:${doc}`;
    if (!currentDocSet.has(normalizedKey)) return [];
    const entryDay = dateOfTimestamp(safeNonNegative(rawEntry.at), today);
    return [{ normalizedKey, chapter, doc, at: safeNonNegative(rawEntry.at), date: entryDay }];
  }).sort((a, b) => (a.at - b.at) || a.normalizedKey.localeCompare(b.normalizedKey));

  const seen = new Set<string>();
  const dayCounts = new Map<string, { completions: number; newDocs: number; chapterFirstCompleted: string[]; docs: number }>();
  const cumulativeDocsByChapter = new Map<string, number>();
  const chapterCompleted = new Set<string>();
  let cumulativeReadDocs = 0;

  const startDate = shiftDate(today, -(days - 1));
  const buckets: TrendBucket[] = [];
  for (let i = 0; i < days; i++) {
    const date = shiftDate(startDate, i);
    const bucketEvents = orderedCompletions.filter((event) => event.date === date);
    for (const event of bucketEvents) {
      if (seen.has(event.normalizedKey)) continue;
      seen.add(event.normalizedKey);
      cumulativeReadDocs += 1;
      const entry = dayCounts.get(date) ?? { completions: 0, newDocs: 0, chapterFirstCompleted: [], docs: 0 };
      entry.completions += 1;
      entry.newDocs += 1;
      entry.docs += 1;
      cumulativeDocsByChapter.set(event.chapter, (cumulativeDocsByChapter.get(event.chapter) ?? 0) + 1);
      const chapter = chapters.find((candidate) => candidate.slug === event.chapter);
      const chapterTotal = chapter ? Math.max(0, safeNonNegative(chapter.docCount)) : Infinity;
      const chapterCount = Math.min(cumulativeDocsByChapter.get(event.chapter) ?? 0, chapterTotal);
      if (chapterTotal > 0 && chapterCount >= chapterTotal && !chapterCompleted.has(event.chapter)) {
        chapterCompleted.add(event.chapter);
        entry.chapterFirstCompleted.push(event.chapter);
      }
      dayCounts.set(date, entry);
    }
    dayCounts.set(date, dayCounts.get(date) ?? { completions: 0, newDocs: 0, chapterFirstCompleted: [], docs: 0 });

    buckets.push({
      date,
      completions: dayCounts.get(date)!.completions,
      newDocs: dayCounts.get(date)!.newDocs,
      newChapters: dayCounts.get(date)!.chapterFirstCompleted.length,
      cumulativeReadDocs,
      completionPct: safePct(cumulativeReadDocs, totalDocs),
    });
  }

  const currentDoneChapters = chapters.filter((chapter) => (currentChapterCounts.get(chapter.slug) ?? 0) >= safeNonNegative(chapter.docCount) && safeNonNegative(chapter.docCount) > 0).length;

  return {
    version: 1,
    days: buckets,
    latest: {
      readDocs,
      totalDocs,
      doneChapters: currentDoneChapters,
      totalChapters: chapters.length,
      completionPct: safePct(readDocs, totalDocs),
    },
    summary: {
      completedDocs: seen.size,
      completionsInRange: buckets.reduce((sum, bucket) => sum + bucket.completions, 0),
      chaptersCompletedInRange: buckets.reduce((sum, bucket) => sum + bucket.newChapters, 0),
      activeDays: buckets.filter((bucket) => bucket.completions > 0).length,
      dailyAverageCompletions: Math.round((buckets.reduce((sum, bucket) => sum + bucket.completions, 0) / days) * 10) / 10,
    },
    dataSource: hasLedger ? "local-completion-ledger" : "current-progress-only",
    hasLedger,
    warnings,
  };
}
