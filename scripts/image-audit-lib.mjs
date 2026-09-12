/**
 * R6.6 / R10.12 图片资产审计纯函数。
 *
 * `byLocale` 是磁盘上的资产清单，`referenced` 是 Markdown 中解析出的引用。
 * 两类问题必须分开报告：
 * 1. 磁盘存在但从未被引用（孤儿，白占公开体积）；
 * 2. 当前 locale 存在但另一 locale 缺少同名资产（镜像漂移）。
 *
 * @typedef {Record<string, Record<string, string[]>>} LocaleAssetMap
 */

/**
 * @param {{ byLocale?: LocaleAssetMap, referenced?: LocaleAssetMap }} [input]
 * @returns {string[]}
 */
export function findAssetProblems({ byLocale = {}, referenced = {} } = {}) {
  const problems = [];

  for (const [locale, byChapter] of Object.entries(byLocale)) {
    for (const [chapter, files] of Object.entries(byChapter)) {
      const used = new Set(referenced[locale]?.[chapter] ?? []);
      for (const file of [...files].sort()) {
        if (!used.has(file)) {
          problems.push(`${locale}/${chapter}/_assets/${file}：资产未被任何课程引用（孤儿）`);
        }

        const other = locale === "zh" ? byLocale.en?.[chapter] : byLocale.zh?.[chapter];
        if (other === undefined || !other.includes(file)) {
          problems.push(`${locale}/${chapter}/_assets/${file}：资产未在另一 locale 镜像（zh/en 需同步增删）`);
        }
      }
    }
  }

  return problems;
}
