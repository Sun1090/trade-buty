/**
 * R6.2：sitemap 新增课程冒烟——构建产物里的 sitemap 必须覆盖全部 zh 课程。
 * 需要先 build（与 check:links 相同前提）。
 * - 遍历知识库 zh 目录计算期望 URL
 * - 与构建产物 sitemap 交叉验证，缺一条 → exit 1
 * 用法：npm run build && npm run check:sitemap
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const KB = path.join(root, "content/kline-buty/docs/knowledge/zh");

// 期望 URL：README 存在的章节 + 章内全部课程 md（与 lib/content 宽松渲染同口径）
const expected = new Set();
for (const ch of fs.readdirSync(KB, { withFileTypes: true })) {
  if (!ch.isDirectory()) continue;
  const dir = path.join(KB, ch.name);
  if (!fs.existsSync(path.join(dir, "README.md"))) continue; // 无导读不是合法章节
  expected.add(`/zh/knowledge/${ch.name}`);
  for (const f of fs.readdirSync(dir)) {
    if (f.endsWith(".md") && f !== "README.md") {
      expected.add(`/zh/knowledge/${ch.name}/${f.replace(/\.md$/, "")}`);
    }
  }
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
const urls = new Set([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => {
  try {
    return new URL(m[1]).pathname;
  } catch {
    return m[1];
  }
}));

const missing = [...expected].filter((p) => !urls.has(p));
if (missing.length > 0) {
  console.error(`❌ sitemap 缺少 ${missing.length} 个 zh 课程页面：`);
  console.error(missing.slice(0, 20).join("\n"));
  process.exit(1);
}
console.log(`✅ sitemap 冒烟通过（${expected.size} 个 zh 页面全部收录）`);
