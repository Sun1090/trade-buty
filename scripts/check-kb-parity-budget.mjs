#!/usr/bin/env node
/**
 * R10.20：关键章节英文 parity 预算检查（CI 门禁，纯读 KB 无需构建）。
 *
 * 读取 docs/kb-parity-budget.json（维护者人工维护的关键章节清单），
 * 计算各章 zh→en 课程覆盖，低于预算即失败（默认预算 1.0）。
 *
 * 只读不写。用法：npm run check:kb-parity-budget
 */
import fs from "node:fs";
import path from "node:path";
import { computeTranslationStats } from "./translation-status-lib.mjs";
import { checkParityBudget, formatRatio } from "./parity-budget-lib.mjs";

const root = process.cwd();
const KB = path.join(root, "content/kline-buty/docs/knowledge");
const CONFIG = path.join(root, "docs/kb-parity-budget.json");

if (!fs.existsSync(KB)) {
  console.error("[parity-budget] 知识库缺失：请先 git submodule update --init");
  process.exit(1);
}
let config;
try {
  config = JSON.parse(fs.readFileSync(CONFIG, "utf8"));
} catch {
  console.error(`[parity-budget] 无法解析 ${path.relative(root, CONFIG)}`);
  process.exit(1);
}

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

const stats = computeTranslationStats({
  zh: chapters(path.join(KB, "zh")),
  en: chapters(path.join(KB, "en")),
});
const result = checkParityBudget({
  stats,
  budgetEntries: config.chapters ?? [],
});

console.log("# 关键章节英文 parity 预算（R10.20）");
console.log(`- 预算章节：${result.checked} 个（默认预算 ${formatRatio(config.budget ?? 1)}）`);
for (const entry of config.chapters ?? []) {
  const row = stats.perChapter.find((r) => r.chapter === entry.chapter);
  if (!row) continue;
  const ratio = row.zh > 0 ? row.overlap / row.zh : 1;
  const ok = ratio + 1e-9 >= entry.budget ? "✅" : "❌";
  console.log(`- ${ok} ${entry.chapter}: en ${row.overlap}/${row.zh}（${formatRatio(ratio)}）`);
}

if (result.unknown.length > 0) {
  console.error("❌ parity 预算失败：预算章节在 KB 中不存在");
  for (const u of result.unknown) console.error(`  - ${u.chapter}`);
  console.error("  处理：从 docs/kb-parity-budget.json 移除已下线章节，或修正 slug。");
  process.exit(1);
}
if (result.failures.length > 0) {
  console.error(`❌ parity 预算失败：${result.failures.length} 个关键章节低于预算`);
  for (const f of result.failures) {
    console.error(`  - ${f.chapter}: ${f.reason}${f.note ? `（${f.note}）` : ""}`);
  }
  console.error(
    "  处理：补齐关键章节的 en 译文；临时放行需先下调该章预算并说明理由（docs/kb-parity-budget.json）。",
  );
  process.exit(1);
}
console.log(
  `✅ 关键章节 parity 达标：${result.passed}/${result.checked} 个全部 ≥ 预算`,
);
