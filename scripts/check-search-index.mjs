import fs from "node:fs";
import path from "node:path";

/**
 * 搜索索引对账：public/search-index.json 的 knowledge 条目
 * 与构建产物页面 1:1 对账。双向孤儿都算失败（CI 阻断）。
 * 用法: npm run build && npm run check:search-index
 */
const root = process.cwd();
const appOut = path.join(root, ".next/server/app");
const indexFile = path.join(root, "public/search-index.json");

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".html") && !e.name.startsWith("_")) out.push(p);
  }
  return out;
}

function main() {
  if (!fs.existsSync(appOut) || !fs.existsSync(indexFile)) {
    console.error("[search-index-check] 缺少构建产物或索引文件：请先 npm run build");
    process.exit(1);
  }
  const entries = JSON.parse(fs.readFileSync(indexFile, "utf8"));
  const indexUrls = new Set(
    entries.filter((e) => e.url.includes("/knowledge/")).map((e) => e.url)
  );

  // 构建产物中的 knowledge 页面
  const built = new Set();
  for (const f of walk(appOut)) {
    const rel = path.relative(appOut, f).replace(/\.html$/, "");
    if (!rel.includes("knowledge")) continue;
    const parts = rel.split(path.sep);
    // [locale] 目录是构建时的字面名？检查实际布局
    built.add("/" + parts.join("/"));
  }

  // 索引 URL urchin: /zh/knowledge/x[/y]
  const orphanIndex = [...indexUrls].filter((u) => {
    const rel = u.replace(/^\/+/, "");
    return !fs.existsSync(path.join(appOut, rel + ".html"));
  });
  const unindexed = [...built].filter((u) => !indexUrls.has(u));

  console.log(
    `[search-index-check] 索引 knowledge 条目 ${indexUrls.size} / 构建页面 ${built.size}`
  );
  let fail = false;
  if (orphanIndex.length > 0) {
    console.error(`[search-index-check] 索引指向不存在页面 ${orphanIndex.length} 条：`);
    for (const u of orphanIndex.slice(0, 20)) console.error(`  ✗ ${u}`);
    fail = true;
  }
  if (unindexed.length > 0) {
    console.error(`[search-index-check] 页面缺索引 ${unindexed.length} 个：`);
    for (const u of unindexed.slice(0, 20)) console.error(`  ✗ ${u}`);
    fail = true;
  }
  if (fail) process.exit(1);
  console.log("[search-index-check] ✓ 索引与页面 1:1 对账通过");
}

main();
