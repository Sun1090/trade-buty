#!/usr/bin/env node
/**
 * R13.17：sitemap / robots.txt / 页面 robots meta 发布复核。
 *
 * 需要先 npm run build（读 .next 产物）。检查：
 *   - robots.txt 声明了绝对 Sitemap，Disallow 与 src/lib/seo-surface.json 完全一致
 *   - sitemap 只收录可索引页面，URL 绝对、无重复，lastmod 合法且不在未来
 *   - 声明为 indexable 的页面一定在 sitemap 里、没有 noindex、canonical 指向自身
 *   - 声明为 noindex 的页面不在 sitemap 里，且确实带 noindex meta
 *   - 知识库页面（章节 / 课程）全部可索引并全部进 sitemap
 *   - 构建产物里不存在未归类的页面（新页面必须显式声明收录策略）
 *
 * 用法：npm run build && npm run check:seo-surface
 */
import fs from "node:fs";
import path from "node:path";
import {
  auditSeoSurface,
  extractCanonical,
  extractMetaRobots,
  loadSeoSurface,
  parseRobotsTxt,
  parseSitemapXml,
} from "./seo-surface-lib.mjs";

const root = process.cwd();
const appOut = path.join(root, ".next", "server", "app");
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://trade-buty.vercel.app").replace(
  /\/$/,
  "",
);

function readBody(name) {
  const candidates = [
    path.join(appOut, `${name}.body`),
    path.join(appOut, name),
  ];
  const found = candidates.find((p) => fs.existsSync(p) && fs.statSync(p).isFile());
  if (!found) return null;
  return fs.readFileSync(found, "utf8");
}

function listHtmlRoutes(dir = appOut) {
  const routes = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) routes.push(...listHtmlRoutes(file));
    else if (entry.name.endsWith(".html")) {
      routes.push(path.relative(appOut, file).split(path.sep).join("/").replace(/\.html$/, ""));
    }
  }
  return routes.sort();
}

function isLocaleRoute(route) {
  return route === "zh" || route === "en" || route.startsWith("zh/") || route.startsWith("en/");
}

const isKnowledgePage = (pathname) => /^\/(zh|en)\/knowledge\//.test(pathname);

if (!fs.existsSync(appOut)) {
  console.error("❌ 未找到 .next/server/app，请先 npm run build");
  process.exit(1);
}

const robotsRaw = readBody("robots.txt");
const sitemapRaw = readBody("sitemap.xml");
if (!robotsRaw) {
  console.error("❌ 未找到构建产物 robots.txt，请先 npm run build");
  process.exit(1);
}
if (!sitemapRaw) {
  console.error("❌ 未找到构建产物 sitemap.xml，请先 npm run build");
  process.exit(1);
}

const pages = listHtmlRoutes()
  .filter(isLocaleRoute)
  .map((route) => {
    const html = fs.readFileSync(path.join(appOut, `${route}.html`), "utf8");
    return {
      pathname: `/${route}`,
      robots: extractMetaRobots(html),
      canonical: extractCanonical(html),
    };
  });

const { errors, stats } = auditSeoSurface({
  siteUrl,
  declaration: loadSeoSurface(root),
  sitemap: parseSitemapXml(sitemapRaw),
  robotsTxt: parseRobotsTxt(robotsRaw),
  pages,
  isKnowledgePage,
});

if (errors.length > 0) {
  console.error(`❌ SEO 表面复核失败：${errors.length} 个问题`);
  console.error(errors.slice(0, 30).join("\n"));
  if (errors.length > 30) console.error(`…另有 ${errors.length - 30} 个问题`);
  process.exit(1);
}

console.log(
  `✅ SEO 表面复核通过（sitemap ${stats.sitemapUrls} 条 · 页面 ${stats.checkedPages} 个 · 知识库 ${stats.knowledgePages} 个 · 未声明 ${stats.undeclared} 个）`,
);
