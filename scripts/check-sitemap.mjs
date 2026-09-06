/**
 * R6.2 + R10.8：sitemap 课程覆盖冒烟与新增 URL 回归。
 * 需要先 build（与 check:links 相同前提）。
 * - 遍历知识库 zh + en 计算期望 URL（章节 README 存在才算合法章节）
 * - 与构建产物 sitemap 双向交叉验证：
 *     missing = KB 有而 sitemap 无（新文档漏收录）→ exit 1
 *     stale   = sitemap knowledge 命名空间下 KB 已不存在的 URL → exit 1
 * 用法：npm run build && npm run check:sitemap
 */
import fs from "node:fs";
import path from "node:path";
import {
  SITEMAP_LOCALES,
  diffSitemapCoverage,
  expectedKnowledgeUrls,
} from "./sitemap-lib.mjs";

const root = process.cwd();
const KB = path.join(root, "content/kline-buty/docs/knowledge");

// 期望 URL：README 存在的章节 + 章内全部课程 md（与 lib/content 宽松渲染同口径）
const expected = [];
for (const locale of SITEMAP_LOCALES) {
  const locRoot = path.join(KB, locale);
  const chapters = [];
  for (const ch of fs.readdirSync(locRoot, { withFileTypes: true })) {
    if (!ch.isDirectory()) continue;
    const dir = path.join(locRoot, ch.name);
    if (!fs.existsSync(path.join(dir, "README.md"))) continue; // 无导读不是合法章节
    const docs = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".md") && f !== "README.md")
      .map((f) => f.replace(/\.md$/, ""));
    chapters.push({ slug: ch.name, docs });
  }
  expected.push(...expectedKnowledgeUrls(locale, chapters));
}

// 构建产物中的 sitemap（Next 15 路径：sitemap.xml 目录下 body 或直接文件）
const candidates = [
  path.join(root, ".next/server/app/sitemap.xml.body"),
  path.join(root, ".next/server/app/sitemap.xml"),
];
const built = candidates.find((p) => fs.existsSync(p));
if (!built) {
  console.error("❌ 未找到构建产物 sitemap，请先 npm run build");
  process.exit(1);
}
const xml = fs.readFileSync(built, "utf8");
const actual = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => {
  try {
    return new URL(m[1]).pathname;
  } catch {
    return m[1];
  }
});

const { missing, stale } = diffSitemapCoverage({ expected, actual });
const perLocale = SITEMAP_LOCALES.map((loc) => {
  const n = expected.filter((u) => u.startsWith(`/${loc}/knowledge/`)).length;
  return `${loc} ${n}`;
}).join(" · ");
let fail = false;
if (missing.length > 0) {
  console.error(`❌ sitemap 缺少 ${missing.length} 个课程页面（新增文档漏收录）：`);
  console.error(missing.slice(0, 20).join("\n"));
  fail = true;
}
if (stale.length > 0) {
  console.error(`❌ sitemap 存在 ${stale.length} 个已不在知识库的 URL（删档残留）：`);
  console.error(stale.slice(0, 20).join("\n"));
  fail = true;
}
if (fail) process.exit(1);
console.log(`✅ sitemap 回归通过（${expected.length} 个知识页面双向一致 · ${perLocale}）`);
