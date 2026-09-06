/**
 * R10.19 翻译状态历史快照纯函数库。
 *
 * 输入为 zh/en 两侧的章节→课程清单（不含 README.md），输出：
 *   1. 结构化翻译状态 stats（章节/课程/覆盖，逐章明细）；
 *   2. 历史快照的合并与修剪（docs/translation-history.json，按日期追加、
 *      同日幂等覆盖、保留最近 N 条）；
 *   3. 「当前 KB vs 最近快照」差异（供 CI 判断快照是否过期）。
 */

/**
 * 由 zh/en 章节映射计算翻译状态。
 * @param {{zh: Map<string,string[]>, en: Map<string,string[]>}} _
 * @returns {{
 *   zhChapters: number, zhDocs: number, enDirs: number, enDocs: number,
 *   overlapChapters: number, overlapDocs: number,
 *   perChapter: Array<{chapter: string, zh: number, en: number, overlap: number}>,
 * }}
 */
export function computeTranslationStats({ zh, en }) {
  const zhChapters = [...zh.keys()].sort();
  const enSet = new Set(en.keys());
  const perChapter = zhChapters.map((chapter) => {
    const zhDocs = [...(zh.get(chapter) ?? [])].sort();
    const enDocs = enSet.has(chapter) ? [...(en.get(chapter) ?? [])].sort() : [];
    const overlap = zhDocs.filter((d) => enDocs.includes(d)).length;
    return {
      chapter,
      zh: zhDocs.length,
      en: enDocs.length,
      overlap,
    };
  });
  const sum = (rows, key) => rows.reduce((n, r) => n + r[key], 0);
  return {
    zhChapters: zhChapters.length,
    zhDocs: sum(perChapter, "zh"),
    enDirs: enSet.size,
    enDocs: sum(perChapter, "en"),
    overlapChapters: perChapter.filter((r) => r.en > 0 || enSet.has(r.chapter)).length,
    overlapDocs: sum(perChapter, "overlap"),
    perChapter,
  };
}

/** 由 stats 生成单条快照记录（不含 date，由调用方补）。 */
export function snapshotOf(stats, date) {
  return { date, ...stats };
}

/**
 * 把新快照合并进历史数组：同日覆盖，按日期升序，保留最近 maxEntries 条。
 * @param {Array<Record<string, unknown>>} history
 * @param {Record<string, unknown>} snapshot
 * @param {number} maxEntries
 * @returns {Array<Record<string, unknown>>}
 */
export function mergeSnapshot(history, snapshot, maxEntries = 365) {
  const rest = (history ?? []).filter((h) => h.date !== snapshot.date);
  return [...rest, snapshot]
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .slice(-maxEntries);
}

/**
 * 当前 KB 的 stats 与最近一条快照是否一致（章节课程计数 + 逐章覆盖明细）。
 * @param {ReturnType<typeof computeTranslationStats>} current
 * @param {Record<string, unknown>|undefined} latest
 * @returns {{ok: boolean, reason: string|null}}
 */
export function diffWithLatest(current, latest) {
  if (!latest) return { ok: false, reason: "翻译历史尚无任何快照（docs/translation-history.json 为空）" };
  const keys = [
    ["zhChapters", "zh 章节数"],
    ["zhDocs", "zh 课程数"],
    ["enDirs", "en 章节数"],
    ["enDocs", "en 课程数"],
    ["overlapChapters", "双语章节数"],
    ["overlapDocs", "双语课程覆盖数"],
  ];
  for (const [key, label] of keys) {
    if (current[key] !== latest[key]) {
      return {
        ok: false,
        reason: `快照过期：${label} 当前 ${current[key]} ≠ 快照 ${latest[key]}（${latest.date}）`,
      };
    }
  }
  const samePerChapter =
    JSON.stringify(current.perChapter) === JSON.stringify(latest.perChapter);
  if (!samePerChapter) {
    return {
      ok: false,
      reason: `快照过期：逐章覆盖明细与当前 KB 不一致（最近快照 ${latest.date}）`,
    };
  }
  return { ok: true, reason: null };
}
