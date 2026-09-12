import { describe, it, expect } from "vitest";
import {
  MILESTONE_LADDER,
  buildShareUrl,
  fillShareText,
  selectMilestone,
  type MilestoneStats,
} from "./milestone-share";

const base: MilestoneStats = {
  readDocs: 0,
  totalDocs: 173,
  doneChapters: 0,
  totalChapters: 27,
  currentStreak: 0,
};

const stats = (patch: Partial<MilestoneStats> = {}): MilestoneStats => ({ ...base, ...patch });

describe("selectMilestone", () => {
  it("returns null until the first lesson is read", () => {
    expect(selectMilestone(stats())).toBeNull();
  });

  it("walks the lesson ladder in order", () => {
    expect(selectMilestone(stats({ readDocs: 1 }))?.key).toBe("first-lesson");
    expect(selectMilestone(stats({ readDocs: 9 }))?.key).toBe("first-lesson");
    expect(selectMilestone(stats({ readDocs: 10 }))?.key).toBe("ten-lessons");
  });

  it("picks chapter, streak and path milestones by rank", () => {
    expect(selectMilestone(stats({ readDocs: 1, doneChapters: 1 }))?.key).toBe("first-chapter");
    expect(selectMilestone(stats({ readDocs: 1, doneChapters: 1, currentStreak: 7 }))?.key).toBe("streak-7");
    expect(selectMilestone(stats({ readDocs: 87 }))?.key).toBe("half-path");
    expect(selectMilestone(stats({ readDocs: 173 }))?.key).toBe("all-lessons");
  });

  it("keeps the ladder ranks strictly increasing", () => {
    const ranks = MILESTONE_LADDER.map((m) => m.rank);
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
    expect(new Set(MILESTONE_LADDER.map((m) => m.key)).size).toBe(MILESTONE_LADDER.length);
  });

  it("treats an unknown/empty corpus as no path milestones", () => {
    const empty = stats({ totalDocs: 0, readDocs: 0, totalChapters: 0 });
    expect(selectMilestone(empty)).toBeNull();
  });
});

describe("fillShareText", () => {
  it("replaces every whitelisted placeholder with the aggregate count", () => {
    const text = fillShareText(
      "{read}/{total} · {done}/{chapters} · {streak}",
      stats({ readDocs: 12, totalDocs: 173, doneChapters: 3, totalChapters: 27, currentStreak: 4 }),
    );
    expect(text).toBe("12/173 · 3/27 · 4");
  });

  it("clamps negative and non-finite counts to zero", () => {
    const text = fillShareText(
      "{read}/{total}/{done}/{chapters}/{streak}",
      stats({ readDocs: -5, totalDocs: Number.NaN, doneChapters: 1.9, totalChapters: Infinity, currentStreak: -1 }),
    );
    expect(text).toBe("0/0/1/0/0");
  });

  it("leaves unknown placeholders untouched so templates cannot inject data", () => {
    expect(fillShareText("hi {unknown} {read}", stats({ readDocs: 2 }))).toBe("hi {unknown} 2");
  });
});

describe("buildShareUrl", () => {
  it("points at the public learning path and carries no progress data", () => {
    const url = buildShareUrl("https://trade-buty.vercel.app", "zh");
    expect(url).toBe("https://trade-buty.vercel.app/zh/path");
    expect(url).not.toMatch(/\?|read=|streak=|ref=/);
  });

  it("normalizes a trailing slash", () => {
    expect(buildShareUrl("https://example.com/", "en")).toBe("https://example.com/en/path");
  });
});
