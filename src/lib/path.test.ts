import { describe, it, expect, vi } from "vitest";
import type { Chapter } from "./content";

// Mock content 模块
const mockChapters: Chapter[] = [
  { slug: "getting-started", title: "入门", tagline: "t", docCount: 7 },
  { slug: "spot", title: "现货", tagline: "t", docCount: 5 },
  { slug: "options-strategies", title: "期权", tagline: "t", docCount: 3 },
  { slug: "unknown-slug", title: "未知", tagline: "t", docCount: 1 },
];

vi.mock("./content", () => ({
  getChapters: () => mockChapters,
}));

const { getStageGroups, STAGES } = await import("./path");

describe("path stages", () => {
  it("三阶段：core / practice / deep", () => {
    expect(STAGES.map((s) => s.id)).toEqual(["core", "practice", "deep"]);
  });

  it("core 阶段含 getting-started", () => {
    const core = STAGES[0];
    expect(core.chapterNums).toContain("getting-started");
  });

  it("deep 阶段含 options-strategies", () => {
    const deep = STAGES[2];
    expect(deep.chapterNums).toContain("options-strategies");
  });
});

describe("getStageGroups", () => {
  it("返回三组，每组含 stage + chapters", () => {
    const groups = getStageGroups("zh");
    expect(groups.length).toBe(3);
    for (const g of groups) {
      expect(g.stage).toBeDefined();
      expect(Array.isArray(g.chapters)).toBe(true);
    }
  });

  it("未知 slug 被过滤掉（不报错）", () => {
    const groups = getStageGroups("zh");
    const allSlugs = groups.flatMap((g) => g.chapters.map((c) => c.slug));
    expect(allSlugs).not.toContain("unknown-slug");
  });

  it("known slug 出现在正确阶段", () => {
    const groups = getStageGroups("zh");
    const coreSlugs = groups[0].chapters.map((c) => c.slug);
    expect(coreSlugs).toContain("getting-started");
    expect(coreSlugs).toContain("spot");
  });
});
