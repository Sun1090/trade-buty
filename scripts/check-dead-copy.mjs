#!/usr/bin/env node
/**
 * R16.21 + R16.78：字典死键巡检，两路口径。
 *
 * 死键（字典里没有任何非字典引用点的词条）不会自己消失，而它们的危险不在占字节，
 * 在于下一个人以为改了字典就改到了界面上；更糟的是死文案里可能躺着一句已经不成立的
 * 话（`home.subtitle` 里的「173 篇深度课程」）。
 *
 * 第二路口径管的是**第一目看不见的那种**：词条在页面有装配点所以算活的，
 * 但接住它的组件接口字段本文件从头到尾没读过（R16.77 的 `error`）——改字典的人
 * 看着装配点，真心以为改到了界面。
 *
 * 台账是**预算式**的：已知死键数冻结成 `DEAD_COPY_BUDGET`，多一个就判失败，
 * 少一个就提示可以下调预算——报告式台账只会积累，所以这里直接要个说法。
 *
 * 用法：npm run check:dead-copy
 * 退出码：死键数或组件未读字段数 > 预算、预算文件缺键、提取量低于下限（说明巡检器
 * 自己失效）→ 1。
 */
import fs from "node:fs";
import path from "node:path";
import {
  collectUsedIdentifiers,
  extractDictInterfaces,
  extractDictionaryKeys,
  findDeadDictionaryKeys,
  findUnreadDictFields,
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
/** 同理：组件字典接口少于这个数，说明声明式的行首匹配已经跟不上代码写法了 */
const MIN_DICT_INTERFACES = 10;
/** 已知死键预算写在文件里：环境变量能闭嘴的门禁不算门禁。 */
const budgetFile = JSON.parse(
  fs.readFileSync(path.join(root, "scripts/dead-copy-budget.json"), "utf8")
);
const DEAD_COPY_BUDGET = budgetFile.budget;
/** R16.78：组件声明了、页面装配了、组件自己从不读的字段 */
const DICT_FIELD_BUDGET = budgetFile.dictFieldBudget;
// 键写错或漏写会让比较变成 `n > undefined`，也就是永远通过——缺键必须当场判失败。
if (typeof DEAD_COPY_BUDGET !== "number" || typeof DICT_FIELD_BUDGET !== "number") {
  console.error(
    `⛔ scripts/dead-copy-budget.json 缺少数值预算（budget / dictFieldBudget）：拿到 ${JSON.stringify(budgetFile)}，两路检查现在都是空转的。`
  );
  process.exit(1);
}

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

/** 组件本地字典接口只看 `src/`：判定单位是「声明它的那个文件读没读」。 */
const componentFiles = corpusFiles
  .filter((file) => file.startsWith(`src${path.sep}`))
  .map((file) => ({ file, source: fs.readFileSync(path.join(root, file), "utf8") }));
const dictInterfaceCount = componentFiles.reduce(
  (sum, entry) => sum + extractDictInterfaces(entry.source).length,
  0
);
const unread = findUnreadDictFields({ files: componentFiles });

const markdown = renderDeadCopyMarkdown({
  dead,
  budget: DEAD_COPY_BUDGET,
  unread,
  dictFieldBudget: DICT_FIELD_BUDGET,
  scannedFiles: dictionaryFiles.length,
  generatedOn: new Date().toISOString().slice(0, 10),
});
writeReport(outputMarkdown, markdown);

console.log(
  `[dead-copy] 字典 ${dictionaryFiles.length} 个 / 词条 ${totalKeys} 个 · 死键 ${dead.length}（预算 ${DEAD_COPY_BUDGET}）· 组件字典接口 ${dictInterfaceCount} 个 / 未读字段 ${unread.length}（预算 ${DICT_FIELD_BUDGET}）→ docs/dead-copy.md`
);

if (totalKeys < MIN_KEYS) {
  console.error(
    `⛔ 只提取到 ${totalKeys} 个词条（下限 ${MIN_KEYS}）：字典结构已变或提取逻辑失效，台账现在不会发现任何问题。`
  );
  process.exit(1);
}
if (dictInterfaceCount < MIN_DICT_INTERFACES) {
  console.error(
    `⛔ 只认出 ${dictInterfaceCount} 个组件字典接口（下限 ${MIN_DICT_INTERFACES}）：声明写法变了，R16.78 这一路现在是空转的。`
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
if (shouldFailDeadCopy({ dead: unread, budget: DICT_FIELD_BUDGET })) {
  console.error(
    `⛔ 组件字典接口里 ${unread.length} 个字段本文件从不读取 > 预算 ${DICT_FIELD_BUDGET}：页面把文案装配进来了，组件却没渲染过它（R16.77 的 dict.error 就是这个形状）。要么读掉，要么把字段从接口和装配点一起删。`
  );
  for (const entry of unread) console.error(`   - ${entry.file} · ${entry.name}.${entry.field}`);
  process.exit(1);
}
console.log("✅ 字典死键与组件字典接口未读字段都在预算内");
