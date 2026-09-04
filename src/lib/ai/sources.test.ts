import { describe, it, expect } from "vitest";
import { enrichSourcesWithTitles } from "./sources";

describe("enrichSourcesWithTitles", () => {
  it("命中课程时返回课程标题", () => {
    const out = enrichSourcesWithTitles(
      [{ chapter: "getting-started", doc: "market-overview", chunk: "x", similarity: 0.9 }],
      "zh"
    );
    expect(out).toHaveLength(1);
    expect(out[0].chapter).toBe("getting-started");
    expect(out[0].title).not.toBe("getting-started/market-overview");
    expect(out[0].title.length).toBeGreaterThan(0);
  });

  it("缺失课程时回退 slug 不断链", () => {
    const out = enrichSourcesWithTitles(
      [{ chapter: "nope", doc: "missing", chunk: "x", similarity: 0.9 }],
      "zh"
    );
    expect(out[0].title).toBe("nope/missing");
  });

  it("空输入返回空数组", () => {
    expect(enrichSourcesWithTitles([], "zh")).toEqual([]);
  });
});
