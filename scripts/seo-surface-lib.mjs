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

/**
 * 文档里那句「知识库 N 页」必须由当场数出来的产物说了算（R16.311）。
 *
 * `docs/seo-surface.md` 的收录策略表里那个 418 是**手抄**的：它等于
 * `2 × (27 篇章页 + 182 课文页)`，内容由 kline-buty 决定，所以知识库加一章、
 * 或某一章补一课，这个数就漂了，而文档不会红——它此前没有任何东西对着。
 * 与 `perf-notes` 那张表的实测列同一族病（R16.306），只是这里的主人更现成：
 * `check:seo-surface` 自己就在数 `stats.knowledgePages`。
 *
 * 锚点 `KNOWLEDGE_PAGE_COUNT_CLAIM` 与核对都在本文件，调用点只负责把当场数出来的
 * 页数递进来——单测因此能直接拿**真实文档**核「这一句还找得到」，而不必依赖构建产物。
 *
 * @param {{doc: string, claimRe?: RegExp, actual: number, where: string}} input
 * @returns {string[]} 空数组代表一致；找不到那句说法同样报 error（防止说法被删掉后判据空转）
 */
// 那一行是四列表：分组名、路由形状、收录策略（页数住在这里）、备注，
// 所以「知识库」到「可索引」之间只跨过**一个**单元格。
export const KNOWLEDGE_PAGE_COUNT_CLAIM = /知识库 \|[^\n]*?\|\s*可索引，全部进 sitemap（(\d+) 页）/;

/**
 * `docs/growth-checklist.md` 开头那句「sitemap（430 URL，其中知识库 418）」里**两个数**
 * 都是手抄的（R16.313）：430 = 产物的 `stats.sitemapUrls`，418 = `stats.knowledgePages`。
 * 前者随收录声明（加一个可索引页面）变，后者随知识库内容变。
 */
export const SITEMAP_URL_COUNT_CLAIM = /sitemap（(\d+) URL，其中知识库 (\d+)）/;

/**
 * 拿文档里的一句说法与当场数出来的一个数比对。`missingText` 让每条锚点用自己的说法
 * 报错——「找不到」不是「一致」，判据必须为此红（R16.303 立的规矩）。
 */
function compareOne({ printed, actual, label, unit, where }) {
  const claimed = Number(printed);
  if (!Number.isFinite(claimed)) {
    return [`${where} 那句里的${label}不是数字：${JSON.stringify(printed)}`];
  }
  if (claimed !== actual) {
    return [
      `${where} 印的是 ${claimed} ${unit}，构建产物当场数出来是 ${actual} ${unit}——` +
        "这个数由产物说了算（声明或知识库内容变了就要一起改这里）",
    ];
  }
  return [];
}

export function checkDocPageCount({ doc, claimRe = KNOWLEDGE_PAGE_COUNT_CLAIM, actual, where }) {
  const match = doc.match(claimRe);
  if (!match) {
    return [
      `${where} 找不到那句带页数的说法（正则 ${claimRe} 没命中）——` +
        "说法被删了就要连着删这条核对，留着判据却不留锚点等于没有判据",
    ];
  }
  return compareOne({ printed: match[1], actual, label: "页数", unit: "页", where });
}

/**
 * `docs/growth-checklist.md` 那句同时含 sitemap 总条数与知识库页数（R16.313）。
 * 两个数各判一次：只核其中一个的话，另一个照样漂而门禁绿。
 *
 * @param {{doc: string, claimRe?: RegExp, actual: {sitemapUrls: number, knowledgePages: number}, where: string}} input
 * @returns {string[]}
 */
export function checkDocSitemapCounts({
  doc,
  claimRe = SITEMAP_URL_COUNT_CLAIM,
  actual,
  where,
}) {
  const match = doc.match(claimRe);
  if (!match) {
    return [
      `${where} 找不到那句带 sitemap 条数的说法（正则 ${claimRe} 没命中）——` +
        "说法被删了就要连着删这条核对，留着判据却不留锚点等于没有判据",
    ];
  }
  return [
    ...compareOne({ printed: match[1], actual: actual.sitemapUrls, label: "sitemap 条数", unit: "URL", where }),
    ...compareOne({ printed: match[2], actual: actual.knowledgePages, label: "知识库页数", unit: "页", where }),
  ];
}
