/**
 * R6.7 / R10.19：中英翻译进度报告 + 历史快照。
 * 扫描 zh/en 双语言根目录：
 *   - 生成 docs/translation-status.md（章节级对照与完成率，人读）；
 *   - 把当日结构化快照并入 docs/translation-history.json（保留最近 365 条，
 *     同日幂等覆盖），供趋势追踪与 CI 过期核对。
 * 用法：npm run kb:translation-status
 */
import fs from "node:fs";
import path from "node:path";
import {
  computeTranslationStats,
  mergeSnapshot,
  snapshotOf,
} from "./translation-status-lib.mjs";

const root = process.cwd();
const KB = path.join(root, "content/kline-buty/docs/knowledge");
const zhDir = path.join(KB, "zh");
const enDir = path.join(KB, "en");
const MD_OUT = path.join(root, "docs/translation-status.md");
const JSON_OUT = path.join(root, "docs/translation-history.json");
const TODAY = new Date().toISOString().slice(0, 10);

function chapters(dir) {
  const m = new Map();
  if (!fs.existsSync(dir)) return m;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const docs = fs
      .readdirSync(path.join(dir, e.name))
      .filter((f) => f.endsWith(".md") && f !== "README.md")
      .sort();
    m.set(e.name, docs);
  }
  return m;
}

const zh = chapters(zhDir);
const en = chapters(enDir);
const stats = computeTranslationStats({ zh, en });

const titleOf = (locale, chapter) => {
  try {
    const readme = fs.readFileSync(path.join(KB, locale, chapter, "README.md"), "utf8");
    return readme.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? chapter;
  } catch {
    return chapter;
  }
};

const lines = [
  "# 知识库中英翻译进度",
  "",
  `> 自动生成于 ${TODAY}（npm run kb:translation-status），勿手改。`,
  "",
  `## 总览：${stats.overlapChapters}/${stats.zhChapters} 章双语 · ${stats.overlapDocs}/${stats.zhDocs} 篇 en 覆盖`,
  "",
  `| 指标 | 值 |`,
  "|---|---|",
  `| zh 章节 | ${stats.zhChapters} |`,
  `| zh 课程 | ${stats.zhDocs} |`,
  `| en 章节（含 en 目录） | ${stats.enDirs} |`,
  `| en 课程 | ${stats.enDocs} |`,
  `| 双语章节 | ${stats.overlapChapters}/${stats.zhChapters} |`,
  `| 双语课程覆盖 | ${stats.overlapDocs}/${stats.zhDocs}（${Math.round((stats.overlapDocs / Math.max(stats.zhDocs, 1)) * 100)}%） |`,
  "",
];

const chRows = stats.perChapter.map((r) => {
  const hasEn = r.en > 0;
  return `| ${titleOf("zh", r.chapter)} | ${r.chapter} | ${r.zh} | ${hasEn ? `✅ ${r.en} 篇` : "—"} | ${r.overlap}/${r.zh} |`;
});

lines.push(
  `## 章节级：${stats.overlapChapters}/${stats.zhChapters} 章有英文版`,
  "",
  "| 中文标题 | slug | zh 课程 | en 章节版本 | en 课程覆盖 |",
  "|---|---|---|---|---|",
  ...chRows,
  "",
);

// 缺 en 的 zh 课程（翻译缺口，供排期）
const gapRows = [];
for (const r of stats.perChapter) {
  const zhDocs = [...(zh.get(r.chapter) ?? [])].sort();
  const enDocs = new Set(en.get(r.chapter) ?? []);
  for (const d of zhDocs) {
    if (!enDocs.has(d)) gapRows.push(`| ${titleOf("zh", r.chapter)} | ${r.chapter} | ${d.replace(/\.md$/, "")} |`);
  }
}
if (gapRows.length > 0) {
  lines.push(
    `## 翻译缺口（zh 有、en 无）：${gapRows.length} 篇`,
    "",
    "| 章节 | slug | 课程 |",
    "|---|---|---|",
    ...gapRows,
    "",
  );
} else {
  lines.push("## 翻译缺口\n\n无——en 已完整覆盖全部 zh 课程。\n");
}

fs.writeFileSync(MD_OUT, lines.join("\n") + "\n");

// R10.19：并入历史快照
let history = [];
if (fs.existsSync(JSON_OUT)) {
  try {
    history = JSON.parse(fs.readFileSync(JSON_OUT, "utf8"));
  } catch {
    history = [];
  }
}
const next = mergeSnapshot(history, snapshotOf(stats, TODAY));
fs.writeFileSync(JSON_OUT, JSON.stringify(next, null, 2) + "\n");
console.log(
  `✅ 翻译进度已更新：docs/translation-status.md + docs/translation-history.json（${next.length} 条快照，最近 ${TODAY}）`,
);
console.log(
  `   ${stats.overlapChapters}/${stats.zhChapters} 章 · ${stats.overlapDocs}/${stats.zhDocs} 篇 en 覆盖`,
);
