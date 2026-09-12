/**
 * R13.17：可索引表面（sitemap / robots.txt / 页面 robots meta）的纯计算与审计。
 *
 * 校验器保持无 I/O，方便单测覆盖；读构建产物的部分放在 check-seo-surface.mjs。
 * 声明的单一事实来源是 src/lib/seo-surface.json（应用侧经 seo-surface.ts 读取）。
 */
import fs from "node:fs";
import path from "node:path";

export const SEO_SURFACE_PATH = "src/lib/seo-surface.json";

/** 读取声明文件（应用与脚本共用同一份 JSON）。 */
export function loadSeoSurface(root = process.cwd()) {
  const raw = fs.readFileSync(path.join(root, SEO_SURFACE_PATH), "utf8");
  return validateDeclaration(JSON.parse(raw));
}

/** 声明文件的形状校验，坏数据直接抛错而不是静默放过。 */
export function validateDeclaration(input) {
  const problems = [];
  if (!input || typeof input !== "object") throw new Error("seo-surface.json 必须是对象");
  const { indexable, noindex, robotsDisallow } = input;

  if (!Array.isArray(indexable) || indexable.length === 0) {
    problems.push("indexable 必须是非空数组");
  } else {
    for (const [i, item] of indexable.entries()) {
      if (typeof item?.path !== "string") problems.push(`indexable[${i}].path 必须是字符串`);
      else if (item.path !== "" && !item.path.startsWith("/")) {
        problems.push(`indexable[${i}].path 必须以 / 开头（首页为 ""）`);
      } else if (item.path.endsWith("/")) {
        problems.push(`indexable[${i}].path 不能以 / 结尾`);
      }
      if (typeof item?.priority !== "number" || item.priority < 0 || item.priority > 1) {
        problems.push(`indexable[${i}].priority 必须在 0–1 之间`);
      }
      if (!CHANGE_FREQUENCIES.includes(item?.changeFrequency)) {
        problems.push(`indexable[${i}].changeFrequency 非法：${item?.changeFrequency}`);
      }
    }
  }

  if (!Array.isArray(noindex) || noindex.length === 0) {
    problems.push("noindex 必须是非空数组");
  } else {
    for (const [i, p] of noindex.entries()) {
      if (typeof p !== "string" || !p.startsWith("/") || p.endsWith("/")) {
        problems.push(`noindex[${i}] 必须是非空、以 / 开头且不以 / 结尾的路径`);
      }
    }
  }

  if (!Array.isArray(robotsDisallow) || robotsDisallow.length === 0) {
    problems.push("robotsDisallow 必须是非空数组");
  }

  if (problems.length > 0) throw new Error(`seo-surface.json 非法：\n  - ${problems.join("\n  - ")}`);

  const indexablePaths = indexable.map((i) => i.path);
  const overlap = indexablePaths.filter((p) => noindex.includes(p));
  if (overlap.length > 0) throw new Error(`同一路径不能同时可索引与 noindex：${overlap.join(", ")}`);
  if (new Set(indexablePaths).size !== indexablePaths.length) throw new Error("indexable 路径重复");
  if (new Set(noindex).size !== noindex.length) throw new Error("noindex 路径重复");
  if (new Set(robotsDisallow).size !== robotsDisallow.length) throw new Error("robotsDisallow 规则重复");

  return { indexable, noindex, robotsDisallow };
}

const CHANGE_FREQUENCIES = [
  "always",
  "hourly",
  "daily",
  "weekly",
  "monthly",
  "yearly",
  "never",
];

/** robots 模式（支持 `*`）→ 正则；锚定在开头，与 robots 规范一致。 */
export function compileRobotsPattern(pattern) {
  const escaped = String(pattern).replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}`);
}

export function matchesRobotsRule(pattern, pathname) {
  return compileRobotsPattern(pattern).test(pathname);
}

export function isRobotsDisallowed(patterns, pathname) {
  return patterns.some((pattern) => matchesRobotsRule(pattern, pathname));
}

/** 解析 robots.txt 的指令（大小写不敏感，忽略注释与空行）。 */
export function parseRobotsTxt(text) {
  const out = { userAgents: [], allow: [], disallow: [], sitemap: [] };
  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.split("#")[0].trim();
    if (!line.includes(":")) continue;
    const idx = line.indexOf(":");
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (!value) continue;
    if (key === "user-agent") out.userAgents.push(value);
    else if (key === "allow") out.allow.push(value);
    else if (key === "disallow") out.disallow.push(value);
    else if (key === "sitemap") out.sitemap.push(value);
  }
  return out;
}

/** 解析 sitemap XML：URL、lastmod 与重复项。 */
export function parseSitemapXml(xml) {
  const urls = [];
  const lastmods = new Map();
  const duplicates = [];
  const seen = new Set();
  for (const block of String(xml).matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const loc = block[1].match(/<loc>([^<]*)<\/loc>/);
    if (!loc) continue;
    const url = loc[1].trim();
    if (seen.has(url)) duplicates.push(url);
    else seen.add(url);
    urls.push(url);
    const mod = block[1].match(/<lastmod>([^<]*)<\/lastmod>/);
    if (mod) lastmods.set(url, mod[1].trim());
  }
  return { urls, lastmods, duplicates };
}

/** 取 HTML 里的 `<meta name="robots">` 内容（含大小写/属性顺序差异）。 */
export function extractMetaRobots(html) {
  for (const tag of String(html).matchAll(/<meta\b[^>]*>/gi)) {
    const t = tag[0];
    if (!/name=["']robots["']/i.test(t)) continue;
    const content = t.match(/content=["']([^"']*)["']/i);
    if (content) return content[1].trim();
  }
  return null;
}

/** 取 HTML 里的 canonical href。 */
export function extractCanonical(html) {
  for (const tag of String(html).matchAll(/<link\b[^>]*>/gi)) {
    const t = tag[0];
    if (!/rel=["']canonical["']/i.test(t)) continue;
    const href = t.match(/href=["']([^"']*)["']/i);
    if (href) return href[1].trim();
  }
  return null;
}

export function isNoindex(robotsMeta) {
  return typeof robotsMeta === "string" && /(^|[,\s])noindex($|[,\s])/i.test(robotsMeta);
}

/**
 * 汇总审计：sitemap / robots.txt / 页面 meta 三者是否自洽。
 *
 * @param {object} args
 * @param {string} args.siteUrl 站点根 URL（无尾斜杠）
 * @param {{indexable: object[], noindex: string[], robotsDisallow: string[]}} args.declaration
 * @param {{urls: string[], lastmods: Map<string,string>, duplicates: string[]}} args.sitemap
 * @param {{userAgents: string[], allow: string[], disallow: string[], sitemap: string[]}} args.robotsTxt
 * @param {{pathname: string, robots: string|null, canonical: string|null}[]} args.pages
 * @param {Date} [args.now]
 * @param {(pathname: string) => boolean} [args.isKnowledgePage]
 * @returns {{errors: string[], stats: object}}
 */
export function auditSeoSurface({
  siteUrl,
  declaration,
  sitemap,
  robotsTxt,
  pages,
  now = new Date(),
  isKnowledgePage = () => false,
}) {
  const errors = [];
  const base = String(siteUrl).replace(/\/$/, "");
  const pageByPath = new Map();
  for (const page of pages) {
    if (pageByPath.has(page.pathname)) {
      errors.push(`构建产物出现重复页面：${page.pathname}`);
      continue;
    }
    pageByPath.set(page.pathname, page);
  }
  const sitemapSet = new Set(sitemap.urls);

  // ── robots.txt ────────────────────────────────────────────────────────────
  const expectedSitemap = `${base}/sitemap.xml`;
  if (!robotsTxt.sitemap.includes(expectedSitemap)) {
    errors.push(`robots.txt 必须声明 Sitemap: ${expectedSitemap}（当前：${robotsTxt.sitemap.join(", ") || "无"}）`);
  }
  const declaredDisallow = [...declaration.robotsDisallow].sort();
  const actualDisallow = [...robotsTxt.disallow].sort();
  if (declaredDisallow.join("|") !== actualDisallow.join("|")) {
    errors.push(
      `robots.txt Disallow 与 seo-surface.json 不一致：声明 [${declaredDisallow.join(", ")}]，产物 [${actualDisallow.join(", ")}]`,
    );
  }

  // ── sitemap 通用约束 ─────────────────────────────────────────────────────
  if (sitemap.duplicates.length > 0) {
    errors.push(`sitemap 存在重复 URL：${sitemap.duplicates.slice(0, 5).join(", ")}`);
  }
  const futureLimit = now.getTime() + 24 * 60 * 60 * 1000;
  for (const url of sitemap.urls) {
    if (!/^https:\/\//.test(url)) errors.push(`sitemap URL 必须是 https 绝对地址：${url}`);
    else if (!url.startsWith(`${base}/`) && url !== base) {
      errors.push(`sitemap URL 不在站点根下：${url}`);
    }
  }
  for (const [url, raw] of sitemap.lastmods) {
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      errors.push(`sitemap lastmod 不是合法时间：${url} → ${JSON.stringify(raw)}`);
    } else if (parsed.getTime() > futureLimit) {
      errors.push(`sitemap lastmod 位于未来：${url} → ${raw}`);
    }
  }
  // Disallow 与 sitemap 不能互相打架：被禁止抓取的 URL 不该出现在 sitemap。
  for (const url of sitemap.urls) {
    const pathname = safePathname(url);
    if (pathname && isRobotsDisallowed(declaration.robotsDisallow, pathname)) {
      errors.push(`sitemap 收录了被 robots.txt Disallow 的路径：${pathname}`);
    }
  }

  // ── 声明 vs 产物：可索引 ──────────────────────────────────────────────────
  for (const locale of ["zh", "en"]) {
    for (const surface of declaration.indexable) {
      const pathname = `/${locale}${surface.path}`;
      const url = `${base}${pathname}`;
      if (!sitemapSet.has(url)) errors.push(`可索引页面未进 sitemap：${pathname}`);
      const page = pageByPath.get(pathname);
      if (!page) {
        errors.push(`可索引页面在构建产物中不存在：${pathname}`);
        continue;
      }
      if (isNoindex(page.robots)) {
        errors.push(`可索引页面却带了 noindex（sitemap 与 meta 打架）：${pathname}`);
      }
      if (page.canonical !== url) {
        errors.push(`可索引页面 canonical 必须指向自身：${pathname} → ${JSON.stringify(page.canonical)}`);
      }
    }

    // ── 声明 vs 产物：noindex ───────────────────────────────────────────────
    for (const path of declaration.noindex) {
      const pathname = `/${locale}${path}`;
      const url = `${base}${pathname}`;
      if (sitemapSet.has(url)) errors.push(`noindex 页面被 sitemap 收录：${pathname}`);
      const page = pageByPath.get(pathname);
      if (!page) {
        errors.push(`noindex 页面在构建产物中不存在：${pathname}`);
        continue;
      }
      if (!isNoindex(page.robots)) {
        errors.push(`声明为 noindex 的页面缺少 noindex meta：${pathname}`);
      }
    }
  }

  // ── 反向覆盖：产物里出现未被声明的页面 ────────────────────────────────────
  const declaredPaths = new Set([
    ...declaration.indexable.map((s) => s.path),
    ...declaration.noindex,
  ]);
  let undeclared = 0;
  let knowledgePages = 0;
  for (const [pathname, page] of pageByPath) {
    if (isKnowledgePage(pathname)) {
      knowledgePages += 1;
      if (page.canonical === null) {
        // 知识库页面全部预渲染，必然带 canonical；没有 canonical 说明这是运行时生成的
        // fallback（典型来源：跑过 Playwright 后 e2e 往 .next 写入的动态路由产物）。
        errors.push(
          `构建产物含非预渲染的知识库页面：${pathname}（运行时 fallback；若刚跑过 e2e，请重新 npm run build）`,
        );
        continue;
      }
      if (isNoindex(page.robots)) errors.push(`知识库页面不应 noindex：${pathname}`);
      if (!sitemapSet.has(`${base}${pathname}`)) errors.push(`知识库页面未进 sitemap：${pathname}`);
      if (page.canonical !== `${base}${pathname}`) {
        errors.push(
          `知识库页面 canonical 必须指向自身：${pathname} → ${JSON.stringify(page.canonical)}`,
        );
      }
      continue;
    }
    const localeRelative = pathname.replace(/^\/(zh|en)/, "");
    if (declaredPaths.has(localeRelative)) continue;
    undeclared += 1;
    errors.push(
      `构建产物出现未声明的可索引表面：${pathname}（请在 src/lib/seo-surface.json 归入 indexable 或 noindex；若刚跑过 e2e，请重新 npm run build）`,
    );
  }

  return {
    errors,
    stats: {
      sitemapUrls: sitemap.urls.length,
      checkedPages: pageByPath.size,
      knowledgePages,
      undeclared,
    },
  };
}

function safePathname(url) {
  try {
    return new URL(url).pathname;
  } catch {
    return null;
  }
}
