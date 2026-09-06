import { describe, expect, it } from "vitest";
import {
  SITEMAP_LOCALES,
  diffSitemapCoverage,
  expectedKnowledgeUrls,
  isKnowledgeUrl,
} from "../../scripts/sitemap-lib.mjs";

describe("sitemap coverage lib (R10.8)", () => {
  it("scans zh and en locales", () => {
    expect(SITEMAP_LOCALES).toEqual(["zh", "en"]);
  });

  it("builds chapter + doc URLs with locale prefix", () => {
    const urls = expectedKnowledgeUrls("en", [
      { slug: "forex-trading", docs: ["forex-basics", "margin"] },
      { slug: "spot", docs: [] },
    ]);
    expect(urls).toEqual([
      "/en/knowledge/forex-trading",
      "/en/knowledge/forex-trading/forex-basics",
      "/en/knowledge/forex-trading/margin",
      "/en/knowledge/spot",
    ]);
  });

  it("recognizes only bilingual knowledge pathnames", () => {
    expect(isKnowledgeUrl("/zh/knowledge/spot/spot-basics")).toBe(true);
    expect(isKnowledgeUrl("/en/knowledge/forex-trading")).toBe(true);
    expect(isKnowledgeUrl("/zh/knowledge")).toBe(false);
    expect(isKnowledgeUrl("/knowledge/zh/spot")).toBe(false);
    expect(isKnowledgeUrl("/zh/chart")).toBe(false);
    expect(isKnowledgeUrl("/ja/knowledge/spot")).toBe(false);
  });

  it("reports a clean pass when actual covers expected exactly", () => {
    const expected = ["/zh/knowledge/spot", "/zh/knowledge/spot/spot-basics"];
    const actual = ["/zh", "/zh/knowledge/spot", "/zh/knowledge/spot/spot-basics", "/zh/chart"];
    expect(diffSitemapCoverage({ expected, actual })).toEqual({ missing: [], stale: [] });
  });

  it("flags a newly added doc missing from the sitemap", () => {
    const expected = ["/en/knowledge/career/trading-careers"];
    const diff = diffSitemapCoverage({ expected, actual: [] });
    expect(diff.missing).toEqual(["/en/knowledge/career/trading-careers"]);
    expect(diff.stale).toEqual([]);
  });

  it("flags stale knowledge URLs after a doc removal", () => {
    const expected = ["/zh/knowledge/spot/spot-basics"];
    const actual = [
      "/zh/knowledge/spot/spot-basics",
      "/zh/knowledge/spot/removed-doc",
      "/en/knowledge/options/legacy",
    ];
    expect(diffSitemapCoverage({ expected, actual })).toEqual({
      missing: [],
      stale: ["/en/knowledge/options/legacy", "/zh/knowledge/spot/removed-doc"],
    });
  });

  it("ignores non-knowledge actual URLs in stale detection", () => {
    const diff = diffSitemapCoverage({
      expected: ["/zh/knowledge/spot"],
      actual: ["/zh/knowledge/spot", "/", "/zh/chart", "/replay"],
    });
    expect(diff.stale).toEqual([]);
  });
});
