import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
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
  BUILD_ID_PLACEHOLDER,
  neutralizeBuildId,
  readBuildId,
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

describe("bundle budget validation boundaries", () => {
  it("rejects malformed manifests before reading budgets", () => {
    expect(validateBudgetManifest(null)).toEqual(["manifest must be an object"]);
    expect(validateBudgetManifest([])).toEqual(["manifest must be an object"]);
    expect(validateBudgetManifest({ version: 2, budgets: [] })).toEqual([
      "version must be 1",
      "budgets must be a non-empty array",
    ]);
  });

  it("reports malformed budget entries and unknown metrics", () => {
    const errors = validateBudgetManifest({
      version: 1,
      budgets: [
        null,
        {
          id: "Bad ID",
          description: " ",
          match: " ",
          maxGzipKB: { js: 0, css: Infinity, html: -1, total: "1", extra: 1 },
        },
        { id: "duplicate", description: "ok", match: "^x$", maxGzipKB: { js: 1, css: 1, html: 1, total: 1 } },
        { id: "duplicate", description: "ok", match: "^y$", maxGzipKB: { js: 1, css: 1, html: 1, total: 1 } },
      ],
    });
    expect(errors).toEqual(expect.arrayContaining([
      "budgets[0] must be an object",
      "budgets[1].id must be a lowercase slug",
      "budgets[1].description must be non-empty",
      "budgets[1].match must be a non-empty regular expression",
      "budgets[1].maxGzipKB.js must be a positive number",
      "budgets[1].maxGzipKB.css must be a positive number",
      "budgets[1].maxGzipKB.html must be a positive number",
      "budgets[1].maxGzipKB.total must be a positive number",
      "budgets[1].maxGzipKB has unknown metric extra",
      "budgets[3].id duplicates duplicate",
    ]));
  });

  it("throws a useful error when compiling an invalid manifest", () => {
    expect(() => compileBudgetManifest({ version: 1, budgets: [] })).toThrow(
      "invalid bundle budget manifest",
    );
  });
});

describe("bundle matching and asset boundaries", () => {
  it("reports ambiguous route matches and rejects unsupported assets", () => {
    const ambiguous = [
      { id: "first", regex: /route/ },
      { id: "second", regex: /route/ },
    ];
    expect(matchRouteBudget("route", ambiguous)).toEqual({
      budget: null,
      error: "route matches multiple budgets: first, second",
    });
    expect(() => collectStaticAssetUrls("", "html")).toThrow("unsupported asset extension: html");
    expect(() => staticAssetRepoPath("/uploads/app.js")).toThrow(
      "asset is outside /_next/static: /uploads/app.js",
    );
    expect(() => staticAssetRepoPath("/_next/static/../../package.json")).toThrow(
      "asset is outside /_next/static: /_next/static/../../package.json",
    );
    expect(() => staticAssetRepoPath("/_next/static/..\\..\\package.json")).toThrow(
      "asset is outside /_next/static",
    );
  });
});

/**
 * R16.314：Next 每构建重新生成随机构建号，并把它内联进每一条页面 HTML。
 * 实测（同一份源码连构三次）：三个 BUILD_ID 互不相同，15 个分组的 gzip 原始字节
 * 每次都变 ±1~4 字节。预算门禁不在意这个，但「读数逐字登记进文档、再用同一份产物
 * 重算比对」的判据会被它随机打红——所以量尺寸之前必须先脱敏。
 */
describe("构建号脱敏（R16.314）", () => {
  const idOf = (seed) =>
    // 21 字符 base64url，与 Next 默认 BUILD_ID 同形状
    Buffer.from(seed.padEnd(16).slice(0, 16)).toString("base64url").slice(0, 21);

  it("替换全部出现处，且长度不变（不掺进「字符串变短」这种假收益）", () => {
    const id = idOf("abc");
    const html = `<script>self.__next_f.push(["1",{"b":"${id}"}])</script><a href="/x">重复 ${id}</a>`;
    const out = neutralizeBuildId(html, id);
    expect(out.replaced).toBe(2);
    expect(out.html.includes(id)).toBe(false);
    expect(out.html.length).toBe(html.length);
    expect(out.html.split(BUILD_ID_PLACEHOLDER).length - 1).toBe(2);
  });

  it("同一份内容换任何一批随机构建号，脱敏后逐字相同（这才是这条规矩要买的性质）", () => {
    const body = (id) => `<!doctype html><div>${"trading buty ".repeat(40)}</div><b>${id}</b>`;
    const variants = ["one", "two", "three", "four", "five"].map((seed) => neutralizeBuildId(body(idOf(seed)), idOf(seed)));
    for (const v of variants) expect(v.replaced).toBe(1);
    expect(new Set(variants.map((v) => v.html)).size, "脱敏后仍随构建号变化——这条等于没生效").toBe(1);
  });

  it("不做脱敏时同一份内容确实会随构建号抖动（证明这条判据不是恒等式）", () => {
    const payloads = ["one", "two", "three", "four", "five", "six", "seven", "eight"].map((seed) => {
      const id = idOf(seed);
      return zlib.gzipSync(`<!doctype html><div>${"trading buty ".repeat(300)}</div><b>${id}</b>`).length;
    });
    expect(new Set(payloads).size, "gzip 字节本来就不随构建号变——这条规矩没有靶子，得重新确认前提").toBeGreaterThan(1);
  });

  it("可疑的构建号一律拒收（拿 undefined 去替换等于静默不脱敏）", () => {
    const html = "<b>x</b>";
    for (const bad of ["", "short", "有 空 格", null, undefined, 42]) {
      expect(() => neutralizeBuildId(html, bad), `接受了可疑构建号 ${JSON.stringify(bad)}`).toThrow();
    }
    expect(() => neutralizeBuildId(null, idOf("ok"))).toThrow();
  });

  it("readBuildId 读的是 .next/BUILD_ID，且形状不对就抛", async () => {
    const os = await import("node:os");
    const fsp = await import("node:fs/promises");
    const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "bid-"));
    try {
      const nextDir = path.join(dir, ".next");
      await fsp.mkdir(nextDir, { recursive: true });
      const id = idOf("real");
      await fsp.writeFile(path.join(nextDir, "BUILD_ID"), `${id}\n`);
      expect(readBuildId(dir)).toBe(id); // 尾部换行必须被剥掉
      await fsp.writeFile(path.join(nextDir, "BUILD_ID"), "  \n");
      expect(() => readBuildId(dir)).toThrow("形状不对");
      await fsp.rm(path.join(nextDir, "BUILD_ID"));
      expect(() => readBuildId(dir)).toThrow(); // 缺文件也抛，不返回 undefined
    } finally {
      await fsp.rm(dir, { recursive: true, force: true });
    }
  });
});
