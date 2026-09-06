#!/usr/bin/env node
/**
 * R10.19：翻译状态历史快照过期检查（CI 门禁）。
 *
 * 重新计算当前 KB 的翻译状态，与 docs/translation-history.json 最近一条快照
 * 比对（章节/课程计数 + 逐章覆盖明细）。不一致说明快照过期——知识库内容
 * 变了（新增 zh 课程、en 覆盖变化等）但报告没重新生成；失败并提示刷新。
 *
 * 只读不写。用法：npm run check:translation-history
 */
import fs from "node:fs";
import path from "node:path";
import {
  computeTranslationStats,
  diffWithLatest,
} from "./translation-status-lib.mjs";

const root = process.cwd();
const KB = path.join(root, "content/kline-buty/docs/knowledge");
const zhDir = path.join(KB, "zh");
const enDir = path.join(KB, "en");
const JSON_OUT = path.join(root, "docs/translation-history.json");

if (!fs.existsSync(KB)) {
  console.error("[translation-history] 知识库缺失：请先 git submodule update --init");
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

let history = [];
if (fs.existsSync(JSON_OUT)) {
  try {
    history = JSON.parse(fs.readFileSync(JSON_OUT, "utf8"));
  } catch {
    history = [];
  }
}
const latest = history.length > 0 ? history[history.length - 1] : undefined;

const stats = computeTranslationStats({ zh: chapters(zhDir), en: chapters(enDir) });
const { ok, reason } = diffWithLatest(stats, latest);

if (!ok) {
  console.error(`❌ 翻译状态历史快照过期：${reason}`);
  console.error(
    "  处理：npm run kb:translation-status 重新生成，并连同 " +
      "docs/translation-status.md 与 docs/translation-history.json 一起提交。",
  );
  process.exit(1);
}
console.log(
  `✅ 翻译历史快照为最新：${latest.date}（${stats.zhChapters} 章 / ${stats.zhDocs} 篇 zh，` +
    `${stats.overlapChapters} 章 / ${stats.overlapDocs} 篇 en 覆盖）`,
);
