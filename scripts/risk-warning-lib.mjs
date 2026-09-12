/**
 * R10.5：课程「⚠️ 风险提示 / Risk Warning」块覆盖率——纯计算与 Markdown 渲染。
 *
 * 产品红线（docs/plan.md）：每篇内容必须带风险提示块（继承 kline-buty 规范）。
 * 知识库现行两种合规写法（zh/en 完全对齐）：
 *   1. VitePress 容器：`::: warning ⚠️ 风险提示 … :::`（每篇课程末尾）；
 *   2. 行内块引用：`> ⚠️ **风险提示：…**` 或 `> **⚠️ 风险提示**` + 后续引用行。
 * 另有一种「提及」——正文只提到「风险提示」字样但无 ⚠️ 块（如「每篇都配有风险提示框」），
 * 不算合规块；未装箱的强风险句（如「…仍有归零…隐患」）算 near-miss，需人工补成标准块。
 *
 * 检测对中英标记语都接受（/风险提示|Risk Warning/i）：本检查只回答「风险块有没有」，
 * 语言是否与文档 locale 匹配由 R10.3 术语检查负责。kind 区分课程正文与章节 README 导语，
 * 导语也是站内可渲染内容，报告单独汇总。
 */

export const MARKERS = /风险提示|Risk\s*Warning/i;

/** VitePress warning 容器开栏：`::: warning <标题>`（标题内联在开栏行）。 */
const CONTAINER_OPEN = /^:{3,}\s*warning\b[^\n]*$/i;

/** 行内块引用：blockquote 行同时带 ⚠️ 与风险提示语。 */
const INLINE_BOXED = /^>\s*[^\n]*⚠️[^\n]*(风险提示|Risk\s*Warning)/i;

/** 未装箱强风险句（仅用于无块时的 near-miss 提示，避免把「风险管理」等弱表述当缺口）。 */
const STRONG_RISK_SENTENCE =
  /^>\s*[^\n]*(归零|亏损|亏光|爆仓|穿仓|本金|不构成投资建议|无法(消灭|根除)风险|risk of losing|may lose|can lose|blow[-\s]?up|negative balance|principal|not (investment|trading) (advice|recommendation)|capital at risk|assets? (going|can go) to zero|hazards remain|losing this money|zero[ -]out)/i;

/**
 * 分析一篇 Markdown 的风险提示块覆盖情况。
 * @returns {{ kind, containerBlocks, inlineBlocks, mentionLines, nearMisses, hasRiskBlock, reasons: string[], status }}
 *   status：pass（有块）/ review（仅提及或未装箱风险句）/ gap（完全缺失）。
 */
export function analyzeRiskWarning({ markdown = "", kind = "lesson" } = {}) {
  const lines = String(markdown).split(/\r?\n/);
  let containerBlocks = 0;
  let inlineBlocks = 0;
  let mentionLines = 0;
  const nearMisses = [];

  for (const line of lines) {
    if (CONTAINER_OPEN.test(line) && MARKERS.test(line)) {
      containerBlocks += 1;
    } else if (INLINE_BOXED.test(line)) {
      inlineBlocks += 1;
    } else if (MARKERS.test(line)) {
      mentionLines += 1;
    } else if (STRONG_RISK_SENTENCE.test(line)) {
      nearMisses.push(line.trim().slice(0, 120));
    }
  }

  const hasRiskBlock = containerBlocks + inlineBlocks > 0;
  const reasons = [];
  if (!hasRiskBlock && mentionLines > 0) reasons.push("mention-only");
  if (!hasRiskBlock && nearMisses.length > 0) reasons.push("unboxed-risk-sentence");
  const status = hasRiskBlock ? "pass" : reasons.length > 0 ? "review" : "gap";

  return { kind, containerBlocks, inlineBlocks, mentionLines, nearMissCount: nearMisses.length, hasRiskBlock, reasons, status };
}

function countByStatus(rows) {
  return rows.reduce(
    (acc, row) => {
      acc[row.status] += 1;
      return acc;
    },
    { pass: 0, review: 0, gap: 0 },
  );
}

/** 渲染 Markdown 报告：课程按 locale 汇总（全绿时一行带过），README 逐行列出。 */
export function renderRiskWarningMarkdown({ generatedAt, results }) {
  const lessons = results.filter((row) => row.kind === "lesson");
  const readmes = results.filter((row) => row.kind === "readme");
  const lessonByLocale = ["zh", "en"].map((locale) => {
    const rows = lessons.filter((row) => row.locale === locale);
    const counts = countByStatus(rows);
    return `- ${locale}：${rows.length} 篇课程 | ✅ pass：${counts.pass} | 🔎 review：${counts.review} | ⚠️ gap：${counts.gap}`;
  });
  const readmeCounts = countByStatus(readmes);
  const actions = results
    .filter((row) => row.status !== "pass")
    .sort((a, b) => a.locale.localeCompare(b.locale) || a.chapter.localeCompare(b.chapter));
  const lines = [
    "# 课程风险提示块覆盖率报告",
    "",
    `> 自动生成于 ${generatedAt}（npm run check:risk-warning），勿手改。`,
    "",
    "> 产品红线（docs/plan.md）：每篇内容必须带「⚠️ 风险提示 / Risk Warning」块。",
    "> pass = 有合规块；review = 仅提及「风险提示」字样或存在未装箱风险句，需人工补成标准块；",
    "> gap = 完全缺失。报告不阻断（知识库内容改动需在 kline-buty 仓库进行）。",
    "> 章节页会对不合规 README 展示本地化兜底提示；本表仍统计上游原文，避免把未修复内容误报为 pass。",
    "",
    "## 课程正文（lesson）",
    ...lessonByLocale,
    "",
    "## 章节导语（README）",
    `- 共 ${readmes.length} 篇 | ✅ pass：${readmeCounts.pass} | 🔎 review：${readmeCounts.review} | ⚠️ gap：${readmeCounts.gap}`,
    "",
    actions.length > 0
      ? [
          "## 待处理清单",
          "",
          "| 状态 | 语言 | 章节 | 文档 | 类型 | 容器块 | 行内块 | 原因 |",
          "|---|---|---|---|---|---|---|---|",
          ...actions.map((row) =>
            `| ${row.status} | ${row.locale} | ${row.chapter} | ${row.document} | ${row.kind} | ${row.containerBlocks} | ${row.inlineBlocks} | ${row.reasons.join("、") || "—"} |`,
          ),
          "",
        ]
      : ["", "全部文档均已带合规风险提示块 🎉", ""],
    "## 说明",
    "",
    "- 检测规则：VitePress `::: warning ⚠️ 风险提示/Risk Warning` 容器（标题在开栏行）；",
    "- 行内块引用 `> …⚠️ **风险提示/Risk Warning…**`（⚠️ 与风险提示语同在一个引用行）。",
    "- 完整明细（含每篇计数）见 docs/risk-warning-coverage.json。",
    "",
  ];
  return `${lines.flat().join("\n")}\n`;
}
