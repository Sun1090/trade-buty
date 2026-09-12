/** R10.4：课程 frontmatter description 质量评分的纯计算与 Markdown 渲染。 */

import { stripTitleOrder } from "./title-terminology-lib.mjs";

const clamp = (value) => Math.max(0, Math.min(100, value));

function titleWords(title) {
  return stripTitleOrder(title)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\u4e00-\u9fff]+/gu, " ")
    .split(/\s+/u)
    .filter((word) => word.length >= 2);
}

export function scoreDescription({ title = "", description = "" }) {
  const text = String(description).trim();
  const length = [...text].length;
  const words = titleWords(title);
  const matchedWords = words.filter((word) => text.toLowerCase().includes(word));
  const dimensions = {
    presence: text ? 30 : 0,
    length: !text ? 0 : length >= 40 && length <= 180 ? 30 : length >= 15 ? 20 : 8,
    detail: !text ? 0 : /[，,、；;：:]/u.test(text) || text.split(/\s+/u).length >= 6 ? 20 : 10,
    titleRelevance: !text || words.length === 0 ? 0 : Math.round((matchedWords.length / words.length) * 20),
  };
  const score = clamp(Object.values(dimensions).reduce((sum, value) => sum + value, 0));
  const status = !text || length < 15 ? "gap" : score >= 80 ? "pass" : "review";
  return { title, description: text, length, matchedTitleWords: matchedWords, dimensions, score, status };
}

export function scoreDescriptions(entries) {
  return entries
    .map((entry) => ({ ...entry, ...scoreDescription(entry) }))
    .sort((a, b) => a.localeCompare?.(b) || String(a.chapter).localeCompare(String(b.chapter)) || String(a.document).localeCompare(String(b.document)));
}

export function renderDescriptionQualityMarkdown({ generatedAt, results }) {
  const counts = { pass: 0, review: 0, gap: 0 };
  results.forEach(({ status }) => { counts[status] += 1; });
  const lines = [
    "# 课程描述质量报告",
    "",
    `> 自动生成于 ${generatedAt}（npm run check:description-quality），勿手改。`,
    "",
    `- 总课程：${results.length} | ✅ pass：${counts.pass} | 🔎 review：${counts.review} | ⚠️ gap：${counts.gap}`,
    "",
    "> 评分：存在性 30 分、长度 30 分、信息密度 20 分、标题相关性 20 分。报告只提示，不替代人工编辑。",
    "",
  ];
  if (results.length > 0) {
    lines.push("| 状态 | 分数 | 章节 | 课程 | 字数 | 描述 |", "|---|---:|---|---|---:|---|");
    results.forEach((result) => lines.push(`| ${result.status} | ${result.score} | ${result.chapter} | ${result.document} | ${result.length} | ${result.description || "（缺失）"} |`));
  }
  return `${lines.join("\n")}\n`;
}
