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
// R9.6：auth-provider 引入了 sync-layer + flushPersistedQueue 等登录态代码，
// 即使按需 dynamic import，Next/React 框架 chunk 也会被带入；实测内容页 +12KB。
const BUDGETS = [
  { page: "zh", budgetKB: 295 },
  { page: "en", budgetKB: 295 },
  { page: "zh/knowledge/getting-started/market-overview", budgetKB: 305 },
  { page: "zh/search", budgetKB: 295 },
  { page: "zh/ai", budgetKB: 310 }, // R7.1：AI 页单独预算（问答 UI，无模型 SDK）
  { page: "zh/chart", budgetKB: 360 },
  { page: "zh/replay", budgetKB: 360 },
];

// R7.1：AI 专属 chunk 不得进内容页——以 ai-chat 独有的 ASCII 字符串（配额头名）为指纹
const CONTENT_PAGES = ["zh", "en", "zh/knowledge/getting-started/market-overview", "zh/search"];
function findAiChunk() {
  const chunksDir = path.join(root, ".next/static/chunks");
  if (!fs.existsSync(chunksDir)) return null;
  const stack = [chunksDir];
  while (stack.length > 0) {
    const dir = stack.pop();
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (e.name.endsWith(".js")) {
        const body = fs.readFileSync(p, "utf8");
        if (body.includes("X-Quota-Limit")) return path.relative(root, p);
      }
    }
  }
  return null;
}

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
  return {
    chunks: files.size,
    kb: Math.round(total / 1024),
    leaked: typeof aiChunkRef !== "undefined" && aiChunkRef.value !== null && files.has(aiChunkRef.value),
  };
}

// 供 pageJsGzip 引用的可变容器（findAiChunk 在 main 里赋值）
const aiChunkRef = { value: null };

function main() {
  if (!fs.existsSync(appOut)) {
    console.error("[bundle] 缺少构建产物：请先 npm run build");
    process.exit(1);
  }
  let fail = false;
  aiChunkRef.value = findAiChunk();
  const aiChunkRel = aiChunkRef.value ? aiChunkRef.value.replace(/^\.next\//, "_next/") : null;
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
  // R7.1：AI chunk 泄漏检查——内容页的 script 集合不得包含 AI 专属 chunk
  if (aiChunkRef.value && aiChunkRel) {
    for (const page of CONTENT_PAGES) {
      const html = fs.readFileSync(path.join(appOut, page + ".html"), "utf8");
      if (html.includes(aiChunkRel)) {
        console.error(`[bundle] ✗ AI chunk 泄漏进内容页 ${page}: ${aiChunkRef.value}`);
        fail = true;
      }
    }
    console.log(`[bundle] ✓ AI chunk 隔离检查（${path.basename(aiChunkRef.value)} 未进内容页）`);
  }

  if (fail) {
    console.error("[bundle] 超预算或 AI chunk 泄漏：请检查是否误把重库打进内容页");
    process.exit(1);
  }
  console.log("[bundle] ✓ 体积预算全部通过");
}

main();
