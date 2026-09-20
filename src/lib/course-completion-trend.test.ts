import { describe, expect, it } from "vitest";
import { localDateStr } from "./date-utils";
import { buildCourseCompletionTrend, readCompletionLedger, type ChapterInput } from "./course-completion-trend";

const chapters = [
  { slug: "getting-started", docCount: 2 },
  { slug: "technical-analysis", docCount: 2 },
];

const progress = {
  "getting-started": ["market-overview", "candlestick-basics"],
  "technical-analysis": ["indicators"],
};

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

  it("reads and tolerates malformed completion ledgers from storage", () => {
    function storage(value: string | null) {
      return { getItem: () => value } as unknown as Storage;
    }

    expect(readCompletionLedger(undefined)).toEqual({});
    expect(readCompletionLedger(storage(null))).toEqual({});
    expect(readCompletionLedger(storage("not-json"))).toEqual({});
    expect(readCompletionLedger(storage('{"a": {}, "b": null, "c": []}'))).toEqual({ a: {} });
    expect(readCompletionLedger(storage('{"a": {"chapter": "a", "doc": "1", "at": 3}}'))).toEqual({
      a: { chapter: "a", doc: "1", at: 3 },
    });
  });

  it("drops invalid chapter entries and non-string progress documents", () => {
    const trend = buildCourseCompletionTrend({
      chapters: [
        undefined as unknown as ChapterInput,
        { slug: "spot", docCount: 1 },
        { slug: "empty", docCount: 2 },
      ],
      progress: { spot: [null as unknown as string, "", "a", "a"] },
      days: 900,
      today: "2026-09-07",
      completions: {
        "spot:a": { at: new Date(2026, 8, 7, 12).getTime() },
      },
    });

    expect(trend.days).toHaveLength(365);
    expect(trend.latest.totalChapters).toBe(2);
    expect(trend.latest.readDocs).toBe(1);
    expect(trend.summary.completionsInRange).toBe(1);
    expect(trend.days.at(-1)).toMatchObject({ completions: 1, cumulativeReadDocs: 1, completionPct: 33 });
  });

  it("clamps negative timestamp completions to epoch day", () => {
    const trend = buildCourseCompletionTrend({
      chapters: [{ slug: "spot", docCount: 1 }],
      progress: { spot: ["a"] },
      days: 7,
      today: "1970-01-07",
      completions: { "spot:a": { chapter: "spot", doc: "a", at: -10 } },
    });

    expect(trend.hasLedger).toBe(true);
    expect(trend.summary.completionsInRange).toBe(1);
    expect(trend.days.at(-1)).toMatchObject({ completions: 0, cumulativeReadDocs: 1 });
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
});
