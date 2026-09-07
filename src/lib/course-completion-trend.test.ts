import { describe, expect, it } from "vitest";
import { buildCourseCompletionTrend } from "./course-completion-trend";

const chapters = [
  { slug: "getting-started", docCount: 2 },
  { slug: "technical-analysis", docCount: 2 },
];

const progress = {
  "getting-started": ["market-overview", "candlestick-basics"],
  "technical-analysis": ["indicators"],
};

describe("buildCourseCompletionTrend", () => {
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
});
