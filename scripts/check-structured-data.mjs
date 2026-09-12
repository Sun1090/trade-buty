#!/usr/bin/env node
/**
 * R13.16：构建产物 JSON-LD 回归门禁。
 *
 * 验证全部静态 zh/en 页面：
 *   - application/ld+json 必须是合法 JSON，并声明 schema.org context
 *   - 每个页面必须有 WebSite + EducationalOrganization
 *   - 章节页必须有 Course + BreadcrumbList，正文页必须有 Article + BreadcrumbList
 *   - FAQ 页必须有完整、非空的 FAQPage 主问答
 *   - @id/url/item/sameAs 等链接必须是绝对 http(s) URL
 *   - 页面必须通过 canonical URL 或实体 @id 标识自身
 *
 * 需要先 npm run build。用法：npm run check:structured-data
 */
import fs from "node:fs";
import path from "node:path";
import {
  extractJsonLd,
  expectedTypesForRoute,
  nodesByType,
  validateBreadcrumb,
  validateFaqPage,
  validateStructuredData,
} from "./structured-data-lib.mjs";

const root = process.cwd();
const appOut = path.join(root, ".next/server/app");
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://trade-buty.vercel.app").replace(
  /\/$/,
  "",
);

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

function localeForRoute(route) {
  if (route === "zh" || route.startsWith("zh/")) return "zh";
  if (route === "en" || route.startsWith("en/")) return "en";
  if (route.startsWith("share/")) {
    return route.includes("/en") ? "en" : "zh";
  }
  return null;
}

function validatePage(route, html, locale) {
  const pageUrl = `${siteUrl}/${route}`;
  const scripts = extractJsonLd(html);
  const expectedTypes = expectedTypesForRoute(route);
  const requiresPageIdentity =
    route === "zh" ||
    route === "en" ||
    route.split("/")[1] === "knowledge" ||
    route.split("/")[1] === "faq" ||
    route.startsWith("share/");
  const result = validateStructuredData({
    scripts,
    expectedTypes,
    locale,
    pageUrl,
    requirePageIdentity: requiresPageIdentity,
  });
  const errors = [...result.errors];
  const segments = route.split("/");

  if (segments[1] === "faq") {
    errors.push(...validateFaqPage(scripts));
  }

  if (expectedTypes.includes("BreadcrumbList")) {
    errors.push(...validateBreadcrumb(scripts, pageUrl));
  }

  if (expectedTypes.includes("Course")) {
    const courses = nodesByType(scripts, "Course");
    if (courses.length !== 1) {
      errors.push(`expected exactly one Course node, got ${courses.length}`);
    } else {
      if (courses[0].url !== pageUrl) {
        errors.push(`Course.url must be ${pageUrl}, got ${JSON.stringify(courses[0].url)}`);
      }
      if (courses[0].isAccessibleForFree !== true) {
        errors.push("Course.isAccessibleForFree must be true");
      }
      if (!Array.isArray(courses[0].hasPart) || courses[0].hasPart.length === 0) {
        errors.push("Course.hasPart must contain at least one lesson");
      }
    }
  }

  if (expectedTypes.includes("Article")) {
    const articles = nodesByType(scripts, "Article");
    if (articles.length !== 1) {
      errors.push(`expected exactly one Article node, got ${articles.length}`);
    } else {
      if (articles[0].mainEntityOfPage?.["@id"] !== pageUrl) {
        errors.push(`Article.mainEntityOfPage.@id must be ${pageUrl}`);
      }
      if (articles[0].headline?.trim().length === 0) {
        errors.push("Article.headline must not be empty");
      }
    }
  }

  if (route === "zh" || route === "en") {
    const websites = nodesByType(scripts, "WebSite");
    if (websites.length !== 1 || websites[0].url !== pageUrl) {
      errors.push(`Home WebSite.url must be ${pageUrl}`);
    }
  }

  return {
    errors: errors.map((error) => `${route}: ${error}`),
    nodeCount: result.nodes.length,
    typeCount: result.types.length,
  };
}

if (!fs.existsSync(appOut)) {
  console.error("❌ 未找到 .next/server/app，请先 npm run build");
  process.exit(1);
}

const routes = listHtmlRoutes().filter((route) => localeForRoute(route) !== null);
if (routes.length === 0) {
  console.error("❌ 构建产物中没有可检查的 zh/en 页面");
  process.exit(1);
}

const failures = [];
let nodeCount = 0;
const routeKinds = { home: 0, chapter: 0, lesson: 0, faq: 0, other: 0 };

for (const route of routes) {
  const locale = localeForRoute(route);
  const html = fs.readFileSync(path.join(appOut, `${route}.html`), "utf8");
  const result = validatePage(route, html, locale);
  failures.push(...result.errors);
  nodeCount += result.nodeCount;

  if (route === "zh" || route === "en") routeKinds.home += 1;
  else if (route.split("/")[1] === "knowledge" && route.split("/").length === 3) routeKinds.chapter += 1;
  else if (route.split("/")[1] === "knowledge" && route.split("/").length >= 4) routeKinds.lesson += 1;
  else if (route.endsWith("/faq")) routeKinds.faq += 1;
  else routeKinds.other += 1;
}

if (failures.length > 0) {
  console.error(`❌ 结构化数据回归失败：${failures.length} 个问题`);
  console.error(failures.slice(0, 40).join("\n"));
  if (failures.length > 40) console.error(`…另有 ${failures.length - 40} 个问题`);
  process.exit(1);
}

console.log(
  `✅ 结构化数据回归通过（${routes.length} 页 · ${nodeCount} 个实体）` +
    `（home ${routeKinds.home} · chapter ${routeKinds.chapter} · lesson ${routeKinds.lesson} · faq ${routeKinds.faq} · other ${routeKinds.other}）`,
);
