import { describe, expect, it } from "vitest";
import {
  diffSitemapCoverage,
  expectedKnowledgeUrls,
  isKnowledgeUrl,
} from "./sitemap-lib.mjs";

describe("sitemap-lib", () => {
  it("builds chapter and lesson URLs for both locales", () => {
    expect(
      expectedKnowledgeUrls("zh", [
        { slug: "spot", docs: ["spot-basics", "spot-strategies"] },
        { slug: "futures", docs: [] },
      ])
    ).toEqual([
      "/zh/knowledge/spot",
      "/zh/knowledge/spot/spot-basics",
      "/zh/knowledge/spot/spot-strategies",
      "/zh/knowledge/futures",
    ]);
  });

  it("detects a newly added lesson missing from the built sitemap", () => {
    const expected = expectedKnowledgeUrls("zh", [
      { slug: "spot", docs: ["spot-basics", "new-lesson"] },
    ]);
    const actual = ["/zh/knowledge/spot", "/zh/knowledge/spot/spot-basics"];

    expect(diffSitemapCoverage({ expected, actual })).toEqual({
      missing: ["/zh/knowledge/spot/new-lesson"],
      stale: [],
    });
  });

  it("detects a removed lesson left in the sitemap", () => {
    const expected = expectedKnowledgeUrls("en", [{ slug: "spot", docs: ["spot-basics"] }]);
    const actual = [
      "/en/knowledge/spot",
      "/en/knowledge/spot/spot-basics",
      "/en/knowledge/spot/removed-lesson",
    ];

    expect(diffSitemapCoverage({ expected, actual })).toEqual({
      missing: [],
      stale: ["/en/knowledge/spot/removed-lesson"],
    });
  });

  it("does not classify non-knowledge URLs as stale", () => {
    const expected = ["/zh/knowledge/spot"];
    const actual = ["/zh/knowledge/spot", "/zh", "/zh/chart", "/en/about"];

    expect(diffSitemapCoverage({ expected, actual }).stale).toEqual([]);
    expect(isKnowledgeUrl("/zh/knowledge/spot")).toBe(true);
    expect(isKnowledgeUrl("/zh/chart")).toBe(false);
  });
});
