import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import {
  BUDGET_METRICS,
  compileBudgetManifest,
  formatKB,
  matchRouteBudget,
  measureRoute,
  metricFailures,
  staticAssetRepoPath,
} from "./bundle-budget.mjs";

const root = process.cwd();
const appOut = path.join(root, ".next/server/app");
const chunksDir = path.join(root, ".next/static/chunks");
const manifestPath = path.join(root, "scripts/bundle-budgets.json");
const gzipCache = new Map();

function readGzip(file) {
  if (!gzipCache.has(file)) {
    gzipCache.set(file, zlib.gzipSync(fs.readFileSync(file)).length);
  }
  return gzipCache.get(file);
}

function listHtmlRoutes(dir = appOut) {
  const routes = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      routes.push(...listHtmlRoutes(file));
    } else if (entry.name.endsWith(".html")) {
      routes.push(path.relative(appOut, file).split(path.sep).join("/").replace(/\.html$/, ""));
    }
  }
  return routes.sort();
}

function findAiChunk() {
  if (!fs.existsSync(chunksDir)) return null;
  const stack = [chunksDir];
  const matches = [];
  while (stack.length > 0) {
    const dir = stack.pop();
    const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(file);
      } else if (entry.name.endsWith(".js") && fs.readFileSync(file, "utf8").includes("X-Quota-Limit")) {
        matches.push(`/_next/${path.relative(path.join(root, ".next"), file).split(path.sep).join("/")}`);
      }
    }
  }
  return matches.length > 0 ? matches[0] : null;
}

function printRouteFailure(measurement, budget, failedMetrics) {
  console.error(
    `[bundle]   ✗ ${measurement.route}: ${failedMetrics
      .map(
        (metric) =>
          `${metric} ${formatKB(measurement.metrics[metric])}KB > ${budget.maxGzipKB[metric]}KB`
      )
      .join(", ")}`
  );
  const assets = [...measurement.assets.js, ...measurement.assets.css].sort((a, b) => b.bytes - a.bytes);
  for (const asset of assets.slice(0, 10)) {
    console.error(`[bundle]     ${formatKB(asset.bytes).padStart(6)}KB  ${asset.url}`);
  }
  if (assets.length > 10) {
    console.error(`[bundle]     … ${assets.length - 10} more assets`);
  }
}

function main() {
  if (!fs.existsSync(appOut)) {
    console.error("[bundle] 缺少构建产物：请先 npm run build");
    process.exit(1);
  }

  let manifest;
  try {
    manifest = compileBudgetManifest(JSON.parse(fs.readFileSync(manifestPath, "utf8")));
  } catch (error) {
    console.error(`[bundle] 预算清单无效：${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }

  const aiChunk = findAiChunk();
  const measurements = [];
  let fail = false;

  for (const route of listHtmlRoutes().filter((route) => /^(?:zh|en)(?:\/|$)/.test(route))) {
    const html = fs.readFileSync(path.join(appOut, route + ".html"), "utf8");
    const measurement = measureRoute({
      route,
      html,
      assetGzip: (url) => readGzip(path.join(root, staticAssetRepoPath(url))),
      htmlGzip: (value) => zlib.gzipSync(value).length,
    });
    const match = matchRouteBudget(route, manifest.budgets);
    if (match.error) {
      console.error(`[bundle] ✗ ${match.error}`);
      fail = true;
      continue;
    }
    measurement.budget = match.budget;
    measurements.push(measurement);
  }

  for (const budget of manifest.budgets) {
    const group = measurements.filter((measurement) => measurement.budget.id === budget.id);
    if (group.length === 0) {
      console.error(`[bundle] ✗ ${budget.id}: 预算已定义但没有匹配任何构建路由`);
      fail = true;
      continue;
    }

    const failures = group
      .map((measurement) => ({ measurement, failedMetrics: metricFailures(measurement, budget) }))
      .filter(({ failedMetrics }) => failedMetrics.length > 0);
    const worst = group.reduce((current, candidate) =>
      candidate.metrics.total > current.metrics.total ? candidate : current
    );
    const ok = failures.length === 0;
    if (!ok) fail = true;
    console.log(
      `[bundle] ${ok ? "✓" : "✗"} ${budget.id}: ${group.length} routes, max total ${formatKB(worst.metrics.total)}/${budget.maxGzipKB.total}KB (${worst.route})`
    );
    for (const { measurement, failedMetrics } of failures) {
      printRouteFailure(measurement, budget, failedMetrics);
    }
  }

  if (!aiChunk) {
    console.error("[bundle] ✗ 未找到带 X-Quota-Limit 指纹的 AI 专属 chunk");
    fail = true;
  } else {
    const leaks = measurements.filter(
      (measurement) => measurement.budget.id !== "ai" && measurement.assets.js.some((asset) => asset.url === aiChunk)
    );
    for (const measurement of leaks) {
      console.error(`[bundle] ✗ AI chunk 泄漏进 ${measurement.route}: ${aiChunk}`);
      fail = true;
    }
    if (leaks.length === 0) {
      const checked = measurements.length - measurements.filter((measurement) => measurement.budget.id === "ai").length;
      console.log(`[bundle] ✓ AI chunk 隔离：${checked} 条非 AI 路由均未引用 ${path.basename(aiChunk)}`);
    }
  }

  const unmatched = measurements.filter((measurement) => !measurement.budget);
  if (unmatched.length > 0) fail = true;

  if (fail) {
    console.error("[bundle] 超预算、路由缺预算或 AI chunk 泄漏：请检查 scripts/bundle-budgets.json");
    process.exit(1);
  }
  console.log(`[bundle] ✓ 全部 ${measurements.length} 条 zh/en 路由通过 ${BUDGET_METRICS.join(" / ")} gzip 预算`);
}

main();
