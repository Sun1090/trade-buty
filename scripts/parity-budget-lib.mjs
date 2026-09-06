/**
 * R10.20 关键章节英文 parity 预算纯函数库。
 *
 * 预算语义：对「关键章节」清单（docs/kb-parity-budget.json，维护者人工维护），
 * 要求 en 课程覆盖 ≥ 该章预算（默认 1.0 = 每篇 zh 课程都要有 en 译文）。
 * 与 R10.19 的「快照过期」区分：这里直接约束内容——关键章节新增 zh 课程
 * 而未同步 en 译文时，即使历史快照已刷新也会失败，防止旗舰章节悄悄掉 parity。
 */

/**
 * 逐章核算 parity 预算。
 * @param {{
 *   stats: {perChapter: Array<{chapter: string, zh: number, en: number, overlap: number}>},
 *   budgetEntries: Array<{chapter: string, budget: number, note?: string}>,
 * }} _ stats 为 computeTranslationStats 的输出（R10.19 复用）。
 * @returns {{
 *   checked: number, passed: number,
 *   failures: Array<{chapter: string, budget: number, ratio: number, zh: number, overlap: number, note?: string, reason: string}>,
 *   unknown: Array<{chapter: string}>
 * }}
 */
export function checkParityBudget({ stats, budgetEntries }) {
  const byChapter = new Map(stats.perChapter.map((r) => [r.chapter, r]));
  const failures = [];
  const unknown = [];
  for (const entry of budgetEntries) {
    const row = byChapter.get(entry.chapter);
    if (!row) {
      unknown.push({ chapter: entry.chapter });
      continue;
    }
    const ratio = row.zh > 0 ? row.overlap / row.zh : 1;
    if (ratio + 1e-9 < entry.budget) {
      failures.push({
        chapter: entry.chapter,
        budget: entry.budget,
        ratio,
        zh: row.zh,
        overlap: row.overlap,
        note: entry.note,
        reason: `en 覆盖 ${row.overlap}/${row.zh}（${formatRatio(ratio)}）< 预算 ${formatRatio(entry.budget)}`,
      });
    }
  }
  return {
    checked: budgetEntries.length,
    passed: budgetEntries.length - failures.length - unknown.length,
    failures,
    unknown,
  };
}

/**
 * @param {number} ratio @returns {string} 0–1 比例 → 百分比字符串（如 100%、66.7%）。
 */
export function formatRatio(ratio) {
  const pct = Math.round(ratio * 1000) / 10;
  return `${pct}%`;
}
