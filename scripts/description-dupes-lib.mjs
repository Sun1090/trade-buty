/**
 * R10.15 课程摘要（frontmatter description）去重纯函数库。
 * SEO 规则：每个可收录页面的 meta description 必须唯一，且不能只是标题复述。
 */

/** 归一化用于比较的文本：去首尾空白、折叠空白、去末尾句读、小写。 */
export function normText(s) {
  return String(s)
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[。．.！!？?；;]+$/g, "")
    .toLowerCase();
}

/** 标题归一化：额外去掉 legacy 前导序号（`03 · ` / `03. `）。 */
export function normTitleKey(s) {
  return normText(String(s).replace(/^\d+\s*[·.]\s*/, ""));
}

/**
 * 找跨文档重复的 description（仅同 locale 内；zh/en 互为译文不算重复）。
 * entries: [{ locale, chapter, doc, title, description }]
 * 返回 [{ key, locale, docs: string[] }]，docs 仅含 >=2 个不同文档时出现。
 */
export function findDescriptionDuplicates(entries) {
  const byLocale = new Map();
  for (const e of entries) {
    if (!e.description || !String(e.description).trim()) continue;
    const key = normText(e.description);
    const loc = e.locale || "?";
    if (!byLocale.has(loc)) byLocale.set(loc, new Map());
    const map = byLocale.get(loc);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(`${e.chapter}/${e.doc}`);
  }
  const out = [];
  for (const [locale, map] of byLocale) {
    for (const [key, docs] of map) {
      const uniq = [...new Set(docs)];
      if (uniq.length >= 2) out.push({ key, locale, docs: uniq.sort() });
    }
  }
  return out.sort((a, b) => a.locale.localeCompare(b.locale) || a.docs[0].localeCompare(b.docs[0]));
}

/**
 * description 是否为标题的纯复述（归一化后与去掉序号的标题相同）。
 * 返回匹配的条目副本（附加 reason）。
 */
export function findTitleClones(entries) {
  const out = [];
  for (const e of entries) {
    if (!e.title || !e.description) continue;
    const t = normTitleKey(e.title);
    const d = normTitleKey(e.description);
    if (t && d && t === d) {
      out.push({ ...e, reason: "description 复述标题" });
    }
  }
  return out;
}
