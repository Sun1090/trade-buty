import { describe, expect, it } from "vitest";
import { classifyIndexDeltas } from "../../scripts/search-index-lib.mjs";

const KB_EXPECTED = [
  "/zh/knowledge/spot",
  "/zh/knowledge/spot/spot-basics",
  "/zh/knowledge/spot/spot-intermediate",
  "/en/knowledge/career/trading-careers",
];

describe("search-index delta lib (R10.9)", () => {
  it("passes when KB docs, index, and built pages all agree", () => {
    const delta = classifyIndexDeltas({
      expected: KB_EXPECTED,
      indexUrls: KB_EXPECTED,
      builtUrls: KB_EXPECTED,
    });
    expect(delta).toEqual({ notIndexed: [], orphanIndex: [], unindexed: [] });
  });

  it("flags a new KB doc missing from the index even without a built page", () => {
    const delta = classifyIndexDeltas({
      expected: [...KB_EXPECTED, "/en/knowledge/career/new-doc"],
      indexUrls: KB_EXPECTED,
      builtUrls: KB_EXPECTED,
    });
    expect(delta.notIndexed).toEqual(["/en/knowledge/career/new-doc"]);
    expect(delta.orphanIndex).toEqual([]);
    expect(delta.unindexed).toEqual([]);
  });

  it("flags orphan index entries pointing to no built page", () => {
    const delta = classifyIndexDeltas({
      expected: KB_EXPECTED,
      indexUrls: [...KB_EXPECTED, "/zh/knowledge/spot/ghost"],
      builtUrls: KB_EXPECTED,
    });
    expect(delta.orphanIndex).toEqual(["/zh/knowledge/spot/ghost"]);
    expect(delta.notIndexed).toEqual([]);
    expect(delta.unindexed).toEqual([]);
  });

  it("flags built knowledge pages that lack an index entry", () => {
    const delta = classifyIndexDeltas({
      expected: KB_EXPECTED,
      indexUrls: KB_EXPECTED,
      builtUrls: [...KB_EXPECTED, "/zh/knowledge/spot/unindexed-page"],
    });
    expect(delta.unindexed).toEqual(["/zh/knowledge/spot/unindexed-page"]);
    expect(delta.notIndexed).toEqual([]);
    expect(delta.orphanIndex).toEqual([]);
  });

  it("ignores non-knowledge built pages (static routes) in unindexed detection", () => {
    const delta = classifyIndexDeltas({
      expected: KB_EXPECTED,
      indexUrls: KB_EXPECTED,
      builtUrls: [...KB_EXPECTED, "/zh/chart", "/replay"],
    });
    expect(delta.unindexed).toEqual([]);
  });

  it("sorts every bucket deterministically", () => {
    const delta = classifyIndexDeltas({
      expected: ["/zh/knowledge/a/b", "/zh/knowledge/c/d"],
      indexUrls: ["/zh/knowledge/c/d", "/zh/knowledge/a/b", "/zh/knowledge/x/stale"],
      builtUrls: ["/zh/knowledge/c/d", "/zh/knowledge/a/b"],
    });
    expect(delta.notIndexed).toEqual([]);
    expect(delta.orphanIndex).toEqual(["/zh/knowledge/x/stale"]);
    expect(delta.unindexed).toEqual([]);
  });
});
