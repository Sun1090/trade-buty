/** R10.5：扫描知识库 zh/en 全部 Markdown，输出风险提示块覆盖率报告（JSON + Markdown）。 */
import fs from "node:fs";
import path from "node:path";
import {
  analyzeRiskWarning,
  auditFallbackRendering,
  auditFallbackWiring,
  renderRiskWarningMarkdown,
} from "./risk-warning-lib.mjs";
import { writeReport } from "./report-write-lib.mjs";

const root = process.cwd();
const knowledgeRoot = path.join(root, "content/kline-buty/docs/knowledge");
const outputJson = path.join(root, "docs/risk-warning-coverage.json");
const outputMarkdown = path.join(root, "docs/risk-warning-coverage.md");

if (!fs.existsSync(knowledgeRoot)) {
  console.error("[risk-warning] 知识库缺失：请先 git submodule update --init");
  process.exit(1);
}

// 上游缺口只能去 kline-buty 修，所以报告式不阻断；但站内兜底接线缺失是本站自己的
// 红线失守，必须阻断。
const pageFiles = [
  "src/app/[locale]/knowledge/[chapter]/page.tsx",
  "src/app/[locale]/knowledge/[chapter]/[doc]/page.tsx",
];
const wiringIssues = [];
const wiringSources = {};
for (const file of pageFiles) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) {
    wiringIssues.push(`${file}: 文件缺失`);
    continue;
  }
  wiringSources[file] = fs.readFileSync(full, "utf8");
}
wiringIssues.push(...auditFallbackWiring(wiringSources));
if (wiringIssues.length > 0) {
  console.error("[risk-warning] ❌ 站内风险提示兜底接线不完整（内容红线失守）：");
  for (const issue of wiringIssues) console.error(`  - ${issue}`);
  process.exit(1);
}

const results = [];
for (const locale of ["zh", "en"]) {
  const localeRoot = path.join(knowledgeRoot, locale);
  if (!fs.existsSync(localeRoot)) continue;
  for (const chapter of fs.readdirSync(localeRoot, { withFileTypes: true })) {
    if (!chapter.isDirectory()) continue;
    const chapterRoot = path.join(localeRoot, chapter.name);
    for (const file of fs.readdirSync(chapterRoot).filter((name) => name.endsWith(".md"))) {
      const isReadme = file === "README.md";
      const document = isReadme ? "README" : file.slice(0, -3);
      const markdown = fs.readFileSync(path.join(chapterRoot, file), "utf8");
      const analyzed = analyzeRiskWarning({ markdown, kind: isReadme ? "readme" : "lesson" });
      results.push({ locale, chapter: chapter.name, document, ...analyzed });
    }
  }
}
results.sort((a, b) => a.locale.localeCompare(b.locale) || a.chapter.localeCompare(b.chapter) || a.kind.localeCompare(b.kind) || a.document.localeCompare(b.document));

// 接线写在源码里不等于块落在页面上：这一侧对着构建产物逐页核对。
const appOut = path.join(root, ".next", "server", "app");
if (!fs.existsSync(appOut)) {
  console.error("[risk-warning] ❌ 未找到 .next/server/app，无法核对兜底提示是否真的渲染（先 npm run build）");
  process.exit(1);
}
const { issues: renderIssues, checked, fallbackPages } = auditFallbackRendering({
  rows: results,
  readArtifact: (row, route) => {
    const file = path.join(appOut, `${route.slice(1)}.html`);
    return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
  },
});
if (renderIssues.length > 0) {
  console.error("[risk-warning] ❌ 站内风险提示兜底未落到构建产物上（内容红线失守）：");
  for (const issue of renderIssues.slice(0, 20)) console.error(`  - ${issue}`);
  if (renderIssues.length > 20) console.error(`  …共 ${renderIssues.length} 条`);
  process.exit(1);
}

const summarize = (rows) => rows.reduce((acc, row) => ({ ...acc, [row.status]: acc[row.status] + 1 }), { pass: 0, review: 0, gap: 0 });
const lessons = results.filter((row) => row.kind === "lesson");
const readmes = results.filter((row) => row.kind === "readme");
const summary = { lessons: summarize(lessons), readmes: summarize(readmes), total: summarize(results) };
const report = { generatedAt: new Date().toISOString().slice(0, 10), summary, results, fallback: { checked, fallbackPages } };
writeReport(outputJson, `${JSON.stringify(report, null, 2)}\n`);
writeReport(outputMarkdown, renderRiskWarningMarkdown(report));
console.log(
  `[risk-warning] 产物核对 ${checked} 页 · 兜底块 ${fallbackPages} 页 → docs/risk-warning-coverage.md`,
);
console.log(
  `[risk-warning] lessons ${summary.lessons.pass}/${lessons.length} pass · readmes ${summary.readmes.pass}/${readmes.length} pass (review ${summary.readmes.review} / gap ${summary.readmes.gap}) → docs/risk-warning-coverage.md`,
);
