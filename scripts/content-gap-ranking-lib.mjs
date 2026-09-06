/** R10.2：按章节重要性与搜索需求为内容缺口排序。 */

const clamp = (value) => Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));

/**
 * 对缺口评分：章节重要性 60%，搜索需求 40%。
 * 输入字段不完整时按 0 处理，保证上游报告可直接接入。
 */
export function rankContentGaps(gaps) {
  return gaps
    .map((gap) => {
      const importance = clamp(Number(gap.importance));
      const searchDemand = clamp(Number(gap.searchDemand));
      return {
        ...gap,
        importance,
        searchDemand,
        score: Math.round((importance * 0.6 + searchDemand * 0.4) * 10) / 10,
      };
    })
    .sort((a, b) => b.score - a.score || a.chapter.localeCompare(b.chapter) || a.document.localeCompare(b.document));
}

export function renderContentGapMarkdown({ generatedAt, gaps }) {
  const lines = [
    "# 内容缺口优先级",
    "",
    `> 自动生成于 ${generatedAt}（npm run kb:gap-priority），勿手改。`,
    "",
    "> 排序公式：章节重要性 × 60% + 搜索需求 × 40%。分数均为 0–100 的维护者评估值。",
    "",
  ];
  if (gaps.length === 0) {
    lines.push("✅ 当前没有待补的中英内容缺口。", "");
    return `${lines.join("\n")}\n`;
  }
  lines.push("| 优先级 | 章节 | 课程 | 章节重要性 | 搜索需求 | 综合分", "|---:|---|---|---:|---:|---:|");
  gaps.forEach((gap, index) => {
    lines.push(`| ${index + 1} | ${gap.chapter} | ${gap.document} | ${gap.importance} | ${gap.searchDemand} | ${gap.score} |`);
  });
  return `${lines.join("\n")}\n`;
}
