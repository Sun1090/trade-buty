import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  collectStaticAssetUrls,
  compileBudgetManifest,
  matchRouteBudget,
  measureRoute,
  metricFailures,
  staticAssetRepoPath,
  validateBudgetManifest,
} from "./bundle-budget.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(fs.readFileSync(path.join(here, "bundle-budgets.json"), "utf8"));
const budgets = compileBudgetManifest(manifest).budgets;

describe("bundle budget manifest", () => {
  it("validates the tracked manifest and every route group", () => {
    expect(validateBudgetManifest(manifest)).toEqual([]);
    expect(new Set(budgets.map((budget) => budget.id)).size).toBe(budgets.length);
  });

  it.each([
    ["zh", "home"],
    ["en", "home"],
    ["zh/path", "path"],
    ["en/knowledge/getting-started", "knowledge-chapter"],
    ["zh/knowledge/getting-started/market-overview", "knowledge-lesson"],
    ["en/search", "search"],
    ["zh/review", "review"],
    ["en/bookmarks", "bookmarks"],
    ["zh/stats", "stats"],
    ["en/ai", "ai"],
    ["zh/chart", "chart"],
    ["en/replay", "replay"],
    ["zh/privacy", "privacy"],
    ["en/glossary", "glossary"],
    ["zh/about", "static-info"],
    ["en/changelog", "static-info"],
    ["zh/auth/callback", "auth"],
  ])("assigns %s to %s", (route, expectedId) => {
    const match = matchRouteBudget(route, budgets);
    expect(match.error).toBeNull();
    expect(match.budget?.id).toBe(expectedId);
  });

  it("reports unknown routes instead of silently skipping them", () => {
    expect(matchRouteBudget("zh/not-in-the-manifest", budgets)).toEqual({
      budget: null,
      error: "no route budget matches zh/not-in-the-manifest",
    });
  });

  it("rejects duplicate ids, invalid regexes, and incomplete metrics", () => {
    const copy = structuredClone(manifest);
    copy.budgets[1].id = copy.budgets[0].id;
    copy.budgets[1].match = "[";
    delete copy.budgets[1].maxGzipKB.css;
    const errors = validateBudgetManifest(copy);
    expect(errors).toContain("budgets[1].id duplicates home");
    expect(errors).toContain("budgets[1].match is not a valid regular expression");
    expect(errors).toContain("budgets[1].maxGzipKB.css must be a positive number");
  });
});

describe("bundle measurement", () => {
  const html = `
    <link rel="stylesheet" href="/_next/static/chunks/app.css">
    <link rel="stylesheet" href="/_next/static/chunks/app.css">
    <script src="/_next/static/chunks/framework.js" async></script>
    <script src="/_next/static/chunks/page.js"></script>
    <script src="https://example.com/not-counted.js"></script>
  `;

  it("extracts only deduplicated Next static assets", () => {
    expect(collectStaticAssetUrls(html, "css")).toEqual(["/_next/static/chunks/app.css"]);
    expect(collectStaticAssetUrls(html, "js")).toEqual([
      "/_next/static/chunks/framework.js",
      "/_next/static/chunks/page.js",
    ]);
    expect(staticAssetRepoPath("/_next/static/chunks/page.js")).toBe(
      path.join(".next", "static", "chunks", "page.js")
    );
  });

  it("measures JS, CSS, HTML, and total gzip bytes", () => {
    const gzipByUrl = {
      "/_next/static/chunks/app.css": 120,
      "/_next/static/chunks/framework.js": 300,
      "/_next/static/chunks/page.js": 500,
    };
    const measurement = measureRoute({
      route: "zh/example",
      html,
      assetGzip: (url) => gzipByUrl[url],
      htmlGzip: () => 80,
    });
    expect(measurement.metrics).toEqual({ js: 800, css: 120, html: 80, total: 1000 });
    expect(measurement.assets.js.map((asset) => asset.url)).toEqual([
      "/_next/static/chunks/framework.js",
      "/_next/static/chunks/page.js",
    ]);
  });

  it("returns every metric that crosses its budget", () => {
    const measurement = {
      metrics: { js: 200, css: 50, html: 30, total: 280 },
    };
    const budget = { maxGzipKB: { js: 0.01, css: 0.01, html: 0.01, total: 0.01 } };
    expect(metricFailures(measurement, budget)).toEqual(["js", "css", "html", "total"]);
  });
});
