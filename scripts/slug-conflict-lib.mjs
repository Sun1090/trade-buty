/**
 * R10.14 slug 冲突纯函数库。
 * 站点 URL 身份 = `/{locale}/knowledge/{chapter}/{doc}`（slug 即身份）。
 * 不变量：
 *   1. slug 只能是小写字母数字连字符（README.md 为章首页，唯一大写例外）；
 *   2. 同 locale 内不允许"数字前缀变体"并存（`01-foo` 与 `foo` 同时存在 →
 *      排序/链接身份歧义，正是 legacy numeric 路由要淘汰的形态）；
 *   3. 同 locale 内不允许大小写折叠冲突（在大小写不敏感文件系统上会互相覆盖）；
 *   4. 中英两侧同一课必须使用逐字相同的 slug——zh 用 `01-foo` 而 en 用 `foo`
 *      会让 hreflang/canonical/跨语言链接无法配对（本任务的核心"中英 slug 冲突"）。
 */

/** 章首页 README.md 豁免（它不是课程 slug）。 */
export const README = "README.md";

/** 去掉 legacy 数字前缀：`01-foo` → `foo`；`01_foo` → `foo`；`1x-foo` 不动。 */
export function stripNumericPrefix(slug) {
  return slug.replace(/^\d+[-_]/, "");
}

/** 排序用的最小身份键（用于找前缀/大小写变体）。 */
export function identityKey(slug) {
  return stripNumericPrefix(slug).toLowerCase();
}

/** slug 是否满足站点 URL 允许字符集。 */
export function isLegalSlug(slug) {
  return /^[a-z0-9-]+$/.test(slug);
}

/**
 * 找出同一组 slug 内的身份冲突（README.md 总是豁免）。
 * 返回 [{a, b, why}]，why ∈ {case-fold, numeric-prefix, variant}。
 */
export function findIdentityConflicts(slugs) {
  const others = [...new Set(slugs.filter((s) => s !== README))].sort();
  const out = [];
  for (let i = 0; i < others.length; i += 1) {
    for (let j = i + 1; j < others.length; j += 1) {
      const a = others[i];
      const b = others[j];
      if (identityKey(a) !== identityKey(b)) continue;
      let why = "variant";
      if (a.toLowerCase() === b.toLowerCase()) why = "case-fold";
      else if (stripNumericPrefix(a) === b || stripNumericPrefix(b) === a)
        why = "numeric-prefix";
      out.push({ a, b, why });
    }
  }
  return out;
}

/**
 * 双语 slug 冲突（核心）：对共享章节，比较 zh/en 的原始 slug 集合。
 * 任一 locale 独有的 slug 归 parity 管（en 允许逐步补齐，不在此失败）；
 * 这里只报"同一个身份键对应不同原始 slug"的跨语言冲突。
 * 返回 [{zh, en, why}]；why 说明变体方向。
 */
export function crossLocaleSlugConflicts(zhSlugs, enSlugs) {
  const zhByKey = new Map(zhSlugs.map((s) => [identityKey(s), s]));
  const enByKey = new Map(enSlugs.map((s) => [identityKey(s), s]));
  const out = [];
  for (const [key, zs] of zhByKey) {
    const es = enByKey.get(key);
    if (es && zs !== es) out.push({ zh: zs, en: es, why: "slug-mismatch" });
  }
  return out;
}
