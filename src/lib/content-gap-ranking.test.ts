import { describe, expect, it } from "vitest";
import { rankContentGaps, renderContentGapMarkdown } from "../../scripts/content-gap-ranking-lib.mjs";

describe("content gap ranking (R10.2)", () => {
  it("uses weighted importance and demand, then stable alphabetical ties", () => {
    const ranked = rankContentGaps([
      { chapter: "beta", document: "b", importance: 80, searchDemand: 20 },
      { chapter: "alpha", document: "z", importance: 50, searchDemand: 50 },
      { chapter: "alpha", document: "a", importance: 50, searchDemand: 50 },
    ]);
    expect(ranked.map((gap: { chapter: string; document: string; score: number }) => [gap.chapter, gap.document, gap.score])).toEqual([
      ["beta", "b", 56],
      ["alpha", "a", 50],
      ["alpha", "z", 50],
    ]);
  });

  it("renders a ranked non-empty markdown table", () => {
    const markdown = renderContentGapMarkdown({
      generatedAt: "2026-09-19",
      gaps: [{ chapter: "risk", document: "position-size", importance: 80, searchDemand: 60, score: 72 }],
    });
    expect(markdown).toContain("| 优先级 | 章节 | 课程 | 章节重要性 | 搜索需求 | 综合分");
    expect(markdown).toContain("| 1 | risk | position-size | 80 | 60 | 72 |");
  });

  it("treats non-numeric scores as zero", () => {
    const ranked = rankContentGaps([{ chapter: "z", document: "x", importance: "not-a-number", searchDemand: Number.NaN }]);
    expect(ranked[0]).toMatchObject({ importance: 0, searchDemand: 0, score: 0 });
  });

  it("clamps invalid scores and renders the empty report", () => {
    const ranked = rankContentGaps([{ chapter: "z", document: "x", importance: 120, searchDemand: -4 }]);
    expect(ranked[0]).toMatchObject({ importance: 100, searchDemand: 0, score: 60 });
    expect(renderContentGapMarkdown({ generatedAt: "2026-09-06", gaps: [] })).toContain("没有待补的中英内容缺口");
  });
});
