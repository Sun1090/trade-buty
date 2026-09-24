import fs from "node:fs";
import path from "node:path";
import {
  SITEMAP_LOCALES,
  expectedKnowledgeUrls,
} from "./sitemap-lib.mjs";
import { classifyIndexDeltas } from "./search-index-lib.mjs";

/**
 * 搜索索引对账（R6.x + R10.9）：
 * 1. KB → 索引：知识库 zh/en 每篇文档（章节 README + 课程）都必须有索引条目——
 *    新文档漏索引即使页面也没建出来也会被抓到（R10.9 新增文档回归）。
 * 2. 索引 ↔ 构建页面 1:1：双向孤儿都算失败（R6 原有）。
 * 纯 delta 计算见 search-index-lib.mjs。
 * 用法: npm run build && npm run check:search-index
 */
const root = process.cwd();
const KB = path.join(root, "content/kline-buty/docs/knowledge");
const manifestFile = path.join(root, ".next/prerender-manifest.json");
const indexFile = path.join(root, "public/search-index.json");

/**
 * 「构建页面」取的是 `prerender-manifest.json` 的 routes，不是 `.next/server/app/**` 的文件树。
 * 差别不是风格问题：`next start` 在收到一个不存在的课文 URL 时会把那份 404 的渲染结果
 * 顺手写进 `.next/server/app/…/nonexistent-lesson.html`，e2e 里就有这类断言。于是跑过一次
 * 本地生产冒烟之后， walk 出来的「构建页面」会多出几个从不存在的路由，门禁在干净的 CI 里
 * 绿、在开发机上红——它数的从来不是构建产物，而是「这台机器上曾经请求过什么」。
 */
function builtKnowledgeUrls() {
  const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  return Object.keys(manifest.routes ?? {}).filter((url) => url.includes("/knowledge/"));
}

/** 与 generate-search-index / sitemap 同口径：README 章节 + 章内课程。 */
function expectedFromKb() {
  const expected = [];
  for (const locale of SITEMAP_LOCALES) {
    const locRoot = path.join(KB, locale);
    const chapters = [];
    for (const ch of fs.readdirSync(locRoot, { withFileTypes: true })) {
      if (!ch.isDirectory()) continue;
      const dir = path.join(locRoot, ch.name);
      if (!fs.existsSync(path.join(dir, "README.md"))) continue;
      const docs = fs
        .readdirSync(dir)
        .filter((f) => f.endsWith(".md") && f !== "README.md")
        .map((f) => f.replace(/\.md$/, ""));
      chapters.push({ slug: ch.name, docs });
    }
    expected.push(...expectedKnowledgeUrls(locale, chapters));
  }
  return expected;
}

function main() {
  if (!fs.existsSync(manifestFile) || !fs.existsSync(indexFile)) {
    console.error("[search-index-check] 缺少构建产物或索引文件：请先 npm run build");
    process.exit(1);
  }
  const entries = JSON.parse(fs.readFileSync(indexFile, "utf8"));
  const indexUrls = new Set(
    entries.filter((e) => e.url.includes("/knowledge/")).map((e) => e.url)
  );

  // 构建清单里的 knowledge 路由
  const built = new Set(builtKnowledgeUrls());

  // R10.9：KB 期望文档 → 索引覆盖（不依赖页面是否建出）
  const expected = expectedFromKb();
  const { notIndexed, orphanIndex, unindexed } = classifyIndexDeltas({
    expected,
    indexUrls: [...indexUrls],
    builtUrls: [...built],
  });

  console.log(
    `[search-index-check] KB 文档 ${expected.length} / 索引条目 ${indexUrls.size} / 构建页面 ${built.size}`
  );
  let fail = false;
  if (notIndexed.length > 0) {
    console.error(`[search-index-check] 知识库文档缺索引 ${notIndexed.length} 篇（新增文档漏收录）：`);
    for (const u of notIndexed.slice(0, 20)) console.error(`  ✗ ${u}`);
    fail = true;
  }
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
  console.log("[search-index-check] ✓ 索引覆盖 KB 全部文档，且与页面 1:1 对账通过");
}

main();
