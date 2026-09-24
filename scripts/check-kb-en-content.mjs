#!/usr/bin/env node
/**
 * R16.13：英文树内容实测（CI 门禁，纯读 KB 无需构建）。
 *
 * 界面上「English and Chinese cover the same 27 chapters」这类说法原先只被
 * 目录/文件名对齐撑着（R10.19 快照、R10.20 关键章节预算）。这条把下界补在
 * 内容上：en 的文件得真的是英文、真的有成篇正文，否则判失败并指向 kline-buty
 * （本仓不得就地改子模块内容）。口径与阈值都在 scripts/en-content-lib.mjs。
 *
 * 只读不写。用法：npm run check:kb-en-content
 */
import fs from "node:fs";
import path from "node:path";
import {
  EN_CJK_MAX_RATIO,
  EN_VS_ZH_MIN_LENGTH_RATIO,
  findEnContentViolations,
  formatPercent,
  measureEnContent,
} from "./en-content-lib.mjs";
import { scanFloorViolation, recordScanCount } from "./scan-floor-lib.mjs";

const root = process.cwd();
const KB = path.join(root, "content/kline-buty/docs/knowledge");
/** 实测（2026-09-24）en 与 zh 两棵树各 209 个 md。树空了却仍判绿，等价于把「英文覆盖同一批课文」这句话收回。 */
export const MIN_LOCALE_FILES = 200;

if (!fs.existsSync(KB)) {
  console.error("[en-content] 知识库缺失：请先 git submodule update --init");
  process.exit(1);
}

/** 读出一棵语言树里的全部 markdown，键为「章节/文件名」（含章节 README，它在站上会渲染成章首页）。 */
function filesByLocale(dir) {
  const out = new Map();
  if (!fs.existsSync(dir)) return out;
  for (const chapter of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!chapter.isDirectory()) continue;
    for (const file of fs.readdirSync(path.join(dir, chapter.name))) {
      if (!file.endsWith(".md")) continue;
      out.set(
        `${chapter.name}/${file}`,
        fs.readFileSync(path.join(dir, chapter.name, file), "utf8"),
      );
    }
  }
  return out;
}

const measured = measureEnContent({
  enFiles: filesByLocale(path.join(KB, "en")),
  zhFiles: filesByLocale(path.join(KB, "zh")),
});
const { summary } = measured;
const problems = findEnContentViolations(measured);
const byKind = (kind) => problems.filter((problem) => problem.kind === kind);

console.log("# 英文树内容实测（R16.13）");
console.log(`- en 文件 ${summary.enFiles} 个 · zh 文件 ${summary.zhFiles} 个 · 无同名中文可比的 en 文件 ${summary.unpairedEnFiles} 个`);
console.log(
  `- CJK 占比：上界 ${formatPercent(EN_CJK_MAX_RATIO)}，实测最高 ${formatPercent(summary.highestCjkRatio)}（${summary.highestCjkFile ?? "无文件"}），越界 ${byKind("cjk-ratio").length} 个`,
);
const lowest = summary.lowestLengthRatio === null ? "无可比文件" : formatPercent(summary.lowestLengthRatio);
console.log(
  `- 正文长度相对中文：下界 ${formatPercent(EN_VS_ZH_MIN_LENGTH_RATIO)}，实测最低 ${lowest}（${summary.lowestLengthFile ?? "无文件"}），越界 ${byKind("thin").length} 个`,
);
console.log(`- 空正文：${summary.emptyEnFiles} 个`);

// R16.83：分母本身要过下限。en 树没拉下来时 filesByLocale 返回空 Map，
// 「0 个文件、0 处越界」同样会一路走到绿色结论。
const shrunk = [
  scanFloorViolation({ count: summary.enFiles, floor: MIN_LOCALE_FILES, what: "en 树 md 文件" }),
  scanFloorViolation({ count: summary.zhFiles, floor: MIN_LOCALE_FILES, what: "zh 树 md 文件" }),
].filter(Boolean);
recordScanCount({ key: "kb-en-md-files", count: summary.enFiles, floor: MIN_LOCALE_FILES, what: "en 树 md 文件" });
recordScanCount({ key: "kb-zh-md-files", count: summary.zhFiles, floor: MIN_LOCALE_FILES, what: "zh 树 md 文件" });
if (shrunk.length > 0) {
  for (const line of shrunk) console.error(`❌ ${line}`);
  process.exit(1);
}

if (problems.length > 0) {
  console.error(`❌ 英文树内容不达标（${problems.length} 处）：`);
  for (const problem of problems) console.error(`  - ${problem.key}［${problem.kind}］${problem.detail}`);
  console.error("  处理：到 kline-buty 补英文正文或改回中文目录；本仓不得就地改子模块内容。");
  process.exit(1);
}
console.log("✅ 每个 en 文件都是成篇英文（无空正文、无整段中文、无只翻开头的短文件）");
