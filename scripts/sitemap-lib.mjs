/**
 * R10.8：sitemap 新增 URL 回归检查——纯计算。
 *
 * 站点 sitemap（src/app/sitemap.ts）由知识库内容驱动：对 zh/en 每个有 README
 * 的章节生成章节页 URL，章节内每篇非 README 课程生成课程页 URL。本库提供
 * 「期望 URL」的纯构造与「构建产物 sitemap vs 期望」的双向 diff：
 *   - missing：KB 里有但 sitemap 没收（新文档漏收录 → 回归）
 *   - stale：sitemap 里 knowledge 命名空间下 KB 已不存在的 URL（删档残留）
 * I/O（读 KB 目录、读构建产物）留在 scripts/check-sitemap.mjs。
 */

export const SITEMAP_LOCALES = ["zh", "en"];

/** pathname 是否落在站内 knowledge 命名空间（zh/en 双语）。 */
export function isKnowledgeUrl(pathname) {
  return SITEMAP_LOCALES.some((locale) => String(pathname).startsWith(`/${locale}/knowledge/`));
}

/**
 * 构造某 locale 的期望 knowledge URL。
 * @param {string} locale zh | en
 * @param {{ slug: string, docs: string[] }[]} chapters 章节 slug + 课程 slug（已去 .md）
 * @returns {string[]} 章节页 + 课程页 URL
 */
export function expectedKnowledgeUrls(locale, chapters = []) {
  const out = [];
  for (const ch of chapters) {
    out.push(`/${locale}/knowledge/${ch.slug}`);
    for (const doc of ch.docs ?? []) out.push(`/${locale}/knowledge/${ch.slug}/${doc}`);
  }
  return out;
}

/**
 * 双向 diff：期望 vs 构建产物 sitemap。
 * @param {{ expected: string[], actual: string[] }} actual 为 sitemap 全部 pathname
 * @returns {{ missing: string[], stale: string[] }} 各自排序去重
 */
export function diffSitemapCoverage({ expected = [], actual = [] } = {}) {
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  const missing = [...expectedSet].filter((url) => !actualSet.has(url)).sort();
  const stale = actual.filter(isKnowledgeUrl).filter((url) => !expectedSet.has(url)).sort();
  return { missing, stale };
}
