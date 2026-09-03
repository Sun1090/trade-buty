import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

/**
 * Bundle 体积预算：统计代表页面的首屏 JS（gzip），超预算则失败（CI 阻断）。
 * 用法: npm run build && npm run check:bundle
 */
const root = process.cwd();
const appOut = path.join(root, ".next/server/app");
const staticDir = path.join(root, ".next/static");

// 代表页面 → gzip 上限（KB）。chart/replay 含 lightweight-charts，预算放宽。
// 基线说明（2026-09 实测）：Next/React 框架 chunk 约 217KB gzip，内容页 ~250KB。
// 预算 = 实测 + 余量，目标是拦截"误把重库打进内容页"类回归，而非压基线。
const BUDGETS = [
  { page: "zh", budgetKB: 280 },
  { page: "en", budgetKB: 280 },
  { page: "zh/knowledge/getting-started/market-overview", budgetKB: 290 },
  { page: "zh/search", budgetKB: 280 },
  { page: "zh/chart", budgetKB: 360 },
  { page: "zh/replay", budgetKB: 360 },
];

function pageJsGzip(rel) {
  const html = fs.readFileSync(path.join(appOut, rel + ".html"), "utf8");
  const files = new Set();
  for (const m of html.matchAll(/_next\/static\/chunks\/[^"']+\.js/g)) {
    files.add(m[0]);
  }
  let total = 0;
  for (const f of files) {
    // _next/static/... → .next/static/...
    const p = path.join(root, ".next", f.replace(/^_next\//, ""));
    if (fs.existsSync(p)) total += zlib.gzipSync(fs.readFileSync(p)).length;
  }
  void staticDir;
  return { chunks: files.size, kb: Math.round(total / 1024) };
}

function main() {
  if (!fs.existsSync(appOut)) {
    console.error("[bundle] 缺少构建产物：请先 npm run build");
    process.exit(1);
  }
  let fail = false;
  for (const { page, budgetKB } of BUDGETS) {
    let info;
    try {
      info = pageJsGzip(page);
    } catch {
      console.error(`[bundle] ✗ ${page}: 页面产物缺失`);
      fail = true;
      continue;
    }
    const ok = info.kb <= budgetKB;
    if (!ok) fail = true;
    console.log(
      `[bundle] ${ok ? "✓" : "✗"} ${page}: ${info.kb}KB gzip (${info.chunks} chunks, 上限 ${budgetKB}KB)`
    );
  }
  if (fail) {
    console.error("[bundle] 超预算：请检查是否误把重库打进内容页");
    process.exit(1);
  }
  console.log("[bundle] ✓ 体积预算全部通过");
}

main();
