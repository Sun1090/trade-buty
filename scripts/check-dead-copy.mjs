#!/usr/bin/env node
/**
 * R16.21：字典死键巡检。
 *
 * 死键（字典里没有任何非字典引用点的词条）不会自己消失，而它们的危险不在占字节，
 * 在于下一个人以为改了字典就改到了界面上；更糟的是死文案里可能躺着一句已经不成立的
 * 话（`home.subtitle` 里的「173 篇深度课程」）。
 *
 * 台账是**预算式**的：已知死键数冻结成 `DEAD_COPY_BUDGET`，多一个就判失败，
 * 少一个就提示可以下调预算——报告式台账只会积累，所以这里直接要个说法。
 *
 * 用法：npm run check:dead-copy
 * 退出码：死键数 > 预算，或提取到的键数低于下限（说明巡检器自己失效）→ 1。
 */
import fs from "node:fs";
import path from "node:path";
import {
  collectUsedIdentifiers,
  extractDictionaryKeys,
  findDeadDictionaryKeys,
  renderDeadCopyMarkdown,
  shouldFailDeadCopy,
} from "./dead-copy-lib.mjs";
import { writeReport } from "./report-write-lib.mjs";

const root = process.cwd();
const outputMarkdown = path.join(root, "docs/dead-copy.md");
/** 与巡检器自己的用例（夹具里含被检查的键名）不参与扫描 */
const SELF_FILES = new Set(["scripts/dead-copy-lib.test.mjs"]);
/** 字典块里至少该有这么多键；低于下限说明提取逻辑或字典结构变了，台账会变成空转 */
const MIN_KEYS = 300;
/** 已知死键预算写在文件里：环境变量能闭嘴的门禁不算门禁。 */
const DEAD_COPY_BUDGET = JSON.parse(
  fs.readFileSync(path.join(root, "scripts/dead-copy-budget.json"), "utf8")
).budget;

function walk(dir, out = []) {
  const absolute = path.join(root, dir);
  if (!fs.existsSync(absolute)) return out;
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(rel, out);
      continue;
    }
    if (/\.(ts|tsx|mjs)$/.test(entry.name)) out.push(rel);
  }
  return out;
}

const dictionaryFiles = walk("src/lib")
  .filter((file) => /i18n[^/]*\.ts$/.test(file) && !file.includes(".test."))
  .sort();

const corpusFiles = [
  ...walk("src"),
  ...walk("e2e"),
  ...walk("scripts"),
].filter(
  (file) =>
    !file.includes(".test.") &&
    !dictionaryFiles.includes(file) &&
    !SELF_FILES.has(file)
);

const dicts = dictionaryFiles.map((file) => ({
  file,
  keys: extractDictionaryKeys(fs.readFileSync(path.join(root, file), "utf8")),
}));
const totalKeys = dicts.reduce((sum, entry) => sum + entry.keys.length, 0);
const used = collectUsedIdentifiers(
  corpusFiles.map((file) => fs.readFileSync(path.join(root, file), "utf8"))
);
const dead = findDeadDictionaryKeys({ dicts, used });

const markdown = renderDeadCopyMarkdown({
  dead,
  budget: DEAD_COPY_BUDGET,
  scannedFiles: dictionaryFiles.length,
  generatedOn: new Date().toISOString().slice(0, 10),
});
writeReport(outputMarkdown, markdown);

console.log(
  `[dead-copy] 字典 ${dictionaryFiles.length} 个 / 词条 ${totalKeys} 个 · 死键 ${dead.length}（预算 ${DEAD_COPY_BUDGET}）→ docs/dead-copy.md`
);

if (totalKeys < MIN_KEYS) {
  console.error(
    `⛔ 只提取到 ${totalKeys} 个词条（下限 ${MIN_KEYS}）：字典结构已变或提取逻辑失效，台账现在不会发现任何问题。`
  );
  process.exit(1);
}
if (dead.length < DEAD_COPY_BUDGET) {
  console.log(
    `ℹ️ 死键比预算少 ${DEAD_COPY_BUDGET - dead.length} 个：把 scripts/dead-copy-budget.json 的 budget 调低，别让下一个人在旧预算里再加一条。`
  );
}
if (shouldFailDeadCopy({ dead, budget: DEAD_COPY_BUDGET })) {
  console.error(`⛔ 新增字典死键 ${dead.length} > 预算 ${DEAD_COPY_BUDGET}：删掉没人读的词条，或在 PR 里写明为什么留着。`);
  for (const entry of dead) console.error(`   - ${entry.file} · ${entry.key}`);
  process.exit(1);
}
console.log("✅ 字典死键在预算内");
