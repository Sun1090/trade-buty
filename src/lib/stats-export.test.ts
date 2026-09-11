// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import {
  STATS_EXPORT_FORMAT,
  STATS_EXPORT_VERSION,
  buildStatsExport,
  downloadStatsExport,
  serializeStatsExport,
} from "./stats-export";

const fullInput = {
  locale: "zh",
  courses: { readDocs: 8, totalDocs: 20, doneChapters: 2, totalChapters: 5, completionPct: 40 },
  quizzes: { done: 3, total: 5, bestPct: 90 },
  replay: { rounds: 12, accuracyPct: 67, bestStreak: 6 },
  review: { pending: 4, dueToday: 2, overdue: 1 },
  engagement: { totalStudySeconds: 7500, currentStreak: 3, longestStreak: 9 },
  goals: { dailyGoalMinutes: 20 },
};

describe("buildStatsExport", () => {
  it("produces a versioned, identifiable payload with stable field names", () => {
    const payload = buildStatsExport(fullInput, new Date("2026-09-11T12:00:00Z"));
    expect(payload.format).toBe(STATS_EXPORT_FORMAT);
    expect(payload.version).toBe(STATS_EXPORT_VERSION);
    expect(payload.exportedAt).toBe("2026-09-11T12:00:00.000Z");
    expect(payload.locale).toBe("zh");
    expect(Object.keys(payload.data).sort()).toEqual(["courses", "engagement", "goals", "quizzes", "replay", "review"]);
    expect(payload.data.courses).toEqual(fullInput.courses);
    expect(payload.data.goals).toEqual(fullInput.goals);
  });

  it("sanitizes corrupt numeric inputs and nullable percentages", () => {
    const dirty = JSON.parse(JSON.stringify(fullInput));
    dirty.courses.readDocs = Number.NaN;
    dirty.quizzes.bestPct = 150;
    dirty.replay.accuracyPct = -5;
    dirty.engagement.currentStreak = Number.POSITIVE_INFINITY;
    dirty.goals.dailyGoalMinutes = -1;
    const payload = buildStatsExport(dirty);
    expect(payload.data.courses.readDocs).toBe(0);
    expect(payload.data.quizzes.bestPct).toBe(100);
    expect(payload.data.replay.accuracyPct).toBe(0);
    expect(payload.data.engagement.currentStreak).toBe(0);
    expect(payload.data.goals.dailyGoalMinutes).toBe(0);
  });

  it("nulls missing percentages and coerces unexpected locales to zh", () => {
    const input = {
      ...fullInput,
      locale: "zh-TW",
      quizzes: { ...fullInput.quizzes, bestPct: null },
    };
    const payload = buildStatsExport(input);
    expect(payload.data.quizzes.bestPct).toBeNull();
    expect(payload.locale).toBe("zh");
  });

  it("round-trips through JSON without loss", () => {
    const payload = buildStatsExport(fullInput, new Date("2026-09-11T12:00:00Z"));
    expect(JSON.parse(serializeStatsExport(payload))).toEqual(JSON.parse(JSON.stringify(payload)));
  });
});

describe("downloadStatsExport", () => {
  it("creates a dated json blob and clicks a temporary anchor", () => {
    const createObjectURL = vi.fn(() => "blob:mock");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });
    const payload = buildStatsExport(fullInput, new Date("2026-09-11T12:00:00Z"));
    const anchor = document.createElement("a");
    let clicked = false;
    Object.defineProperty(anchor, "click", { value: () => { clicked = true; } });
    const createSpy = vi.spyOn(document, "createElement").mockReturnValue(anchor);
    const name = downloadStatsExport(payload);
    expect(name).toBe("trade-buty-stats-2026-09-11.json");
    expect(clicked).toBe(true);
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(anchor.download).toBe(name);
    createSpy.mockRestore();
  });
});
