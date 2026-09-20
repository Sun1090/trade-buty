import { describe, expect, it } from "vitest";
import { localDateStr } from "./date-utils";
import { buildCourseCompletionTrend, normalizeCompletionLedger, readCompletionLedger } from "./course-completion-trend";

const chapters = [
  { slug: "getting-started", docCount: 2 },
  { slug: "technical-analysis", docCount: 2 },
];

const progress = {
  "getting-started": ["market-overview", "candlestick-basics"],
  "technical-analysis": ["indicators"],
};

describe("normalizeCompletionLedger", () => {
  it("keeps object ledger entries and drops malformed records", () => {
    const out = normalizeCompletionLedger({
      "ch:doc": { chapter: "ch", doc: "doc", at: 1 },
      "ch:empty": "",
      "ch:list": [{ doc: "ignored" }],
      "ch:null": null,
      "ch:number": 7,
    } as unknown as Record<string, unknown>);

    expect(out).toEqual({ "ch:doc": { chapter: "ch", doc: "doc", at: 1 } });
  });
});

describe("readCompletionLedger", () => {
  it("reads valid storage and returns an empty ledger for missing, invalid, or malformed JSON", () => {
    const valid = {
      getItem: (key: string) => key === "tb-progress-completions" ? JSON.stringify({ "ch:doc": { chapter: "ch", doc: "doc" } }) : null,
    } as unknown as Storage;
    const missing = { getItem: () => null } as unknown as Storage;
    const badJson = { getItem: () => "{not-json" } as unknown as Storage;

    expect(readCompletionLedger(valid)).toEqual({ "ch:doc": { chapter: "ch", doc: "doc" } });
    expect(readCompletionLedger(missing)).toEqual({});
    expect(readCompletionLedger(badJson)).toEqual({});
    const empty = { getItem: () => null, length: 0 } as unknown as Storage;
    expect(readCompletionLedger(empty)).toEqual({});
  });
});

describe("buildCourseCompletionTrend", () => {
  it("rejects impossible calendar dates used as today", () => {
    const result = buildCourseCompletionTrend({ chapters: [], today: "2026-02-31" });
    expect(result.days.at(-1)?.date).toBe(localDateStr());
    expect(result.days.at(-1)?.date).not.toBe("2026-02-31");
  });

  it("returns an empty trend without inventing dates when old progress has no ledger", () => {
    const trend = buildCourseCompletionTrend({ chapters, progress, days: 7, today: "2026-09-07" });

    expect(trend.version).toBe(1);
    expect(trend.latest).toEqual({
      readDocs: 3,
      totalDocs: 4,
      doneChapters: 1,
      totalChapters: 2,
      completionPct: 75,
    });
    expect(trend.hasLedger).toBe(false);
    expect(trend.dataSource).toBe("current-progress-only");
    expect(trend.warnings).toContain("no-completion-dates");
    expect(trend.days).toHaveLength(7);
    expect(trend.days.at(-1)).toMatchObject({ date: "2026-09-07", completionPct: 0 });
    expect(trend.summary.completionsInRange).toBe(0);
  });

  it("groups duplicate current progress into one trend event and reports chapter completion", () => {
    const trend = buildCourseCompletionTrend({
      chapters,
      progress,
      days: 7,
      today: "2026-09-07",
      completions: {
        "getting-started:market-overview": { chapter: "getting-started", doc: "market-overview", at: new Date(2026, 8, 3, 12).getTime() },
        "getting-started:candlestick-basics": { chapter: "getting-started", doc: "candlestick-basics", at: new Date(2026, 8, 3, 12).getTime() },
        "getting-started:market-overview:duplicate": { chapter: "getting-started", doc: "market-overview", at: new Date(2026, 8, 4, 12).getTime() },
        "technical-analysis:indicators": { chapter: "technical-analysis", doc: "indicators", at: new Date(2026, 8, 7, 12).getTime() },
      },
    });

    expect(trend.hasLedger).toBe(true);
    expect(trend.summary).toMatchObject({ completedDocs: 3, completionsInRange: 3, chaptersCompletedInRange: 1, activeDays: 2 });
    expect(trend.days[2]).toMatchObject({ date: "2026-09-03", completions: 2, newDocs: 2, newChapters: 1, cumulativeReadDocs: 2, completionPct: 50 });
    expect(trend.days.at(-1)).toMatchObject({ date: "2026-09-07", completions: 1, newChapters: 0, cumulativeReadDocs: 3, completionPct: 75 });
  });

  it("clamps ranges and sanitizes invalid chapter/document counts", () => {
    const trend = buildCourseCompletionTrend({
      chapters: [{ slug: "spot", docCount: Number.NaN }],
      progress: { spot: ["a"] },
      days: -1,
      today: "not-a-date",
      completions: { "spot:a": { chapter: "spot", doc: "a", at: -10 } },
    });

    expect(trend.days).toHaveLength(7);
    expect(trend.latest.totalDocs).toBe(0);
    expect(trend.latest.completionPct).toBe(0);
    expect(trend.summary.completionsInRange).toBe(0);
  });

  it("keeps ledger timestamps outside the selected range but excludes them from cumulative and summary counts", () => {
    const trend = buildCourseCompletionTrend({
      chapters,
      progress,
      days: 7,
      today: "2026-09-07",
      completions: {
        "getting-started:market-overview": { chapter: "getting-started", doc: "market-overview", at: new Date(2026, 8, 1, 12).getTime() },
        "technical-analysis:indicators": { chapter: "technical-analysis", doc: "indicators", at: new Date(2026, 8, 7, 12).getTime() },
      },
    });

    expect(trend.summary.completedDocs).toBe(2);
    expect(trend.summary.completionsInRange).toBe(2);
    expect(trend.days.at(-1)).toMatchObject({ completions: 1, cumulativeReadDocs: 2, completionPct: 50 });
  });

  it("filters ledger entries that are no longer in current progress while still reporting current chapter completion", () => {
    const trend = buildCourseCompletionTrend({
      chapters: [{ slug: "empty", docCount: 0 }, { slug: "getting-started", docCount: 1 }],
      progress: { "getting-started": ["market-overview"], gone: ["stale-doc"] },
      days: 7,
      today: "2026-09-07",
      completions: {
        "getting-started:market-overview": { chapter: "getting-started", doc: "market-overview", at: new Date(2026, 8, 7, 12).getTime() },
        "gone:stale-doc": { chapter: "gone", doc: "stale-doc", at: new Date(2026, 8, 7, 12).getTime() },
      },
    });

    expect(trend.latest.doneChapters).toBe(1);
    expect(trend.latest.readDocs).toBe(1);
    expect(trend.latest.totalDocs).toBe(1);
    expect(trend.summary.completedDocs).toBe(1);
    expect(trend.days.at(-1)).toMatchObject({ completions: 1, newChapters: 1, completionPct: 100 });
  });

  it("falls back to ledger keys when chapter or doc fields are missing", () => {
    const trend = buildCourseCompletionTrend({
      chapters: [{ slug: "ch", docCount: 1 }],
      progress: { ch: ["doc"] },
      days: 7,
      today: "2026-09-07",
      completions: { "ch:doc": { at: new Date(2026, 8, 7, 12).getTime() } },
    });

    expect(trend.summary.completedDocs).toBe(1);
    expect(trend.days.at(-1)).toMatchObject({ completions: 1, cumulativeReadDocs: 1, completionPct: 100 });
  });
});
