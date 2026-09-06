/**
 * R10.6：知识库新增课程自动验收清单——纯计算与 Markdown 渲染。
 *
 * 站点契约（AGENTS.md / docs/plan.md）：课程文件名英文 slug；frontmatter 带 title +
 * description（zh 的 title 以「NN · 」前导序号保证排序，en 按设计无序号）；每篇内容必须
 * 带「⚠️ 风险提示」块；H1 建议与标题一致（缺失时站点降级用文件名）。
 *
 * 检查分级：blocking = 破坏契约/红线（新增课程必须通过）；advisory = 质量提示（不阻断）。
 * 复用 R10.4 description 质量评分与 R10.5 风险块检测，避免重复实现。
 */
import { analyzeRiskWarning } from "./risk-warning-lib.mjs";
import { scoreDescription } from "./description-quality-lib.mjs";

const SLUG_RE = /^[a-z0-9-]+$/;
const ZH_NUMBERED_TITLE = /^[0-9]{1,2}\s*·/;

function parseFrontmatterValue(raw, key) {
  const match = raw.match(new RegExp(`^${key}:\\s*(.*)$`, "m"));
  if (!match) return null;
  return String(match[1]).trim().replace(/^["']|["']$/g, "");
}

function extractH1(markdown) {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

function splitFrontmatter(markdown) {
  const lines = String(markdown).split(/\r?\n/);
  if (lines[0]?.trim() !== "---") return null;
  const end = lines.slice(1).findIndex((line) => line.trim() === "---");
  if (end === -1) return null;
  return lines.slice(1, 1 + end).join("\n");
}

/**
 * 对一篇课程 Markdown 跑验收清单。
 * @returns {{ locale, chapter, document, checks: Array<{id,label,level,pass,detail}>, status }}
 *   status：ok（全部通过）/ warn（有 advisory 未过）/ fail（有 blocking 未过）。
 */
export function checkNewCourse({ locale = "zh", chapter = "", document = "", markdown = "" } = {}) {
  const fm = splitFrontmatter(markdown);
  const title = fm ? parseFrontmatterValue(fm, "title") : null;
  const description = fm ? parseFrontmatterValue(fm, "description") : null;
  const risk = analyzeRiskWarning({ markdown, kind: "lesson" });
  const quality = title !== null && description !== null ? scoreDescription({ title, description }) : null;
  const h1 = extractH1(markdown);

  const checks = [
    {
      id: "file-slug",
      label: "文件名英文 slug",
      level: "blocking",
      pass: SLUG_RE.test(document),
      detail: SLUG_RE.test(document) ? document : `非法 slug：${document}`,
    },
    {
      id: "frontmatter",
      label: "frontmatter 完整（--- 围栏）",
      level: "blocking",
      pass: fm !== null,
      detail: fm !== null ? "ok" : "缺 --- 围栏或未闭合",
    },
    {
      id: "title-present",
      label: "frontmatter title",
      level: "blocking",
      pass: title !== null && title.length > 0,
      detail: title ?? "缺失（渲染降级用文件名/H1）",
    },
    {
      id: "description-present",
      label: "frontmatter description",
      level: "blocking",
      pass: description !== null && description.length > 0,
      detail: description ?? "缺失（渲染降级用文件名/H1）",
    },
    {
      id: "zh-title-numbered",
      label: "zh title 带「NN · 」前导序号",
      level: "blocking",
      pass: locale !== "zh" || (title !== null && ZH_NUMBERED_TITLE.test(title)),
      detail: locale !== "zh" ? "en 按设计无序号，跳过" : title && ZH_NUMBERED_TITLE.test(title) ? title : `${title ?? "（缺失）"} — 无前导序号，将排在 999 位`,
    },
    {
      id: "risk-block",
      label: "「⚠️ 风险提示/Risk Warning」块",
      level: "blocking",
      pass: risk.status === "pass",
      detail: risk.status === "pass" ? `容器 ${risk.containerBlocks} / 行内 ${risk.inlineBlocks}` : `缺失（${risk.reasons.join("、") || "完全无风险表述"}）`,
    },
    {
      id: "description-quality",
      label: "description 质量（R10.4）",
      level: "advisory",
      pass: quality !== null && quality.status !== "gap",
      detail: quality ? `score ${quality.score}/100 · ${quality.status}` : "无 description 可评分",
    },
    {
      id: "h1",
      label: "正文 H1 标题",
      level: "advisory",
      pass: h1 !== null,
      detail: h1 ?? "缺失（渲染降级用文件名）",
    },
  ];

  const blockingFail = checks.some((c) => c.level === "blocking" && !c.pass);
  const advisoryFail = checks.some((c) => c.level === "advisory" && !c.pass);
  return { locale, chapter, document, checks, status: blockingFail ? "fail" : advisoryFail ? "warn" : "ok" };
}

const LEVEL_ICON = { ok: "✅", warn: "⚠️", fail: "❌" };

/** 渲染全量验收汇总 Markdown（章节导语 README 不计入课程清单）。 */
export function renderNewCourseMarkdown({ generatedAt, results }) {
  const counts = results.reduce(
    (acc, row) => {
      acc[row.status] += 1;
      return acc;
    },
    { ok: 0, warn: 0, fail: 0 },
  );
  const byLocale = ["zh", "en"].map((locale) => {
    const rows = results.filter((row) => row.locale === locale);
    const c = rows.reduce((acc, row) => ({ ...acc, [row.status]: acc[row.status] + 1 }), { ok: 0, warn: 0, fail: 0 });
    return `- ${locale}：${rows.length} 篇 | ${LEVEL_ICON.ok} ok ${c.ok} | ${LEVEL_ICON.warn} warn ${c.warn} | ${LEVEL_ICON.fail} fail ${c.fail}`;
  });
  const fails = results.filter((row) => row.status !== "ok");
  const lines = [
    "# 知识库新增课程验收清单报告",
    "",
    `> 自动生成于 ${generatedAt}（npm run kb:accept），勿手改。`,
    "",
    `- 课程：${results.length} | ${LEVEL_ICON.ok} ok：${counts.ok} | ${LEVEL_ICON.warn} warn：${counts.warn} | ${LEVEL_ICON.fail} fail：${counts.fail}`,
    "",
    "> blocking 项（slug/frontmatter/风险块/zh 序号）破坏契约，新增课程必须通过；",
    "> advisory 项（description 质量/H1）为提示。存量不达标项见下表，需在 kline-buty 上游整改。",
    "",
    ...byLocale,
    "",
    "## 非 ok 清单",
    "",
    fails.length > 0
      ? [
          "| 状态 | 语言 | 章节 | 课程 | 未过项 |",
          "|---|---|---|---|---|",
          ...fails.map((row) => {
            const bad = row.checks.filter((c) => !c.pass).map((c) => `${c.label}（${c.detail.slice(0, 60)}）`);
            return `| ${LEVEL_ICON[row.status]} ${row.status} | ${row.locale} | ${row.chapter} | ${row.document} | ${bad.join("；") || "—"} |`;
          }),
          "",
        ]
      : ["", "全部课程通过验收 🎉", ""],
    "## 检查项",
    "",
    "- blocking：文件名英文 slug、frontmatter 围栏、title、description、zh「NN · 」序号、⚠️ 风险提示块；",
    "- advisory：description 质量分（R10.4）、正文 H1。完整明细见 docs/new-course-acceptance.json。",
    "",
  ];
  return `${lines.flat().join("\n")}\n`;
}
