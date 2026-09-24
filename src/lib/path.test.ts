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

const { getStageGroups, stageOfChapter, STAGES } = await import("./path");
const { CHAPTER_ORDER } = await import("./kb-order");

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

  // /path 只渲染 STAGES 里登记的篇章，页脚却写着「N 篇章 × 3 阶段」（N 来自知识库）。
  // 分层表漏一篇，那一页就少一篇还照样报总数——这里先把两张表钉成同一批 slug。
  it("分层表覆盖 CHAPTER_ORDER 的每一篇，不漏不重", () => {
    const staged = STAGES.flatMap((stage) => stage.chapterNums);
    expect(new Set(staged).size).toBe(staged.length);
    expect([...staged].sort()).toEqual([...CHAPTER_ORDER].sort());
  });

  it("stageOfChapter 与 getStageGroups 归同一阶段", () => {
    for (const group of getStageGroups("zh")) {
      for (const chapter of group.chapters) {
        expect(stageOfChapter(chapter.slug)).toBe(group.stage.id);
      }
    }
    expect(stageOfChapter("no-such-chapter")).toBeNull();
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
