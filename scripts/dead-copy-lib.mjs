/**
 * R16.21 字典死键巡检的判定口径。
 *
 * 字典里没人读的键不会自己消失，而它们的危险不在占字节，在于下一个人以为改了字典
 * 就改到了界面上（`home.subtitle` 与 `chapter.readCount` 躺着「173 篇深度课程」这句
 * 已经不成立的话，只有它们自己的测试在读）。
 *
 * 判定刻意选保守方向：**标识符在语料里任何一处出现就算活着**，宁可漏报也不误报——
 * 误报会把还在用的文案指使成「可删」。
 */

/** 字典源文件里真正的词条块：`const zh = { … };` 与 `const en: Dict = { … };` */
const DICT_BLOCK = /^const (?:zh|en)(?::[^=]+)? = \{\n([\s\S]*?)^\};$/gm;
const KEY_LINE = /^\s+([A-Za-z_][A-Za-z0-9_]*)\s*:/;

/** 从字典源文件里取所有词条键（含嵌套组里的键；它们最终都是 `dict.key` 访问）。 */
export function extractDictionaryKeys(source) {
  const keys = new Set();
  for (const match of source.matchAll(DICT_BLOCK)) {
    const body = match[1];
    for (const line of body.split("\n")) {
      // 嵌套组里的键也收：它们最终同样以 `dict.group.key` 的形式被访问
      const at = KEY_LINE.exec(line);
      if (at) keys.add(at[1]);
    }
  }
  return [...keys].sort();
}

/** 语料里出现过的标识符：属性访问、对象字面量键、解构、字符串里的引用都算。 */
export function collectUsedIdentifiers(sources) {
  const used = new Set();
  for (const source of sources) {
    for (const match of source.matchAll(/[A-Za-z_$][A-Za-z0-9_$]*/g)) {
      used.add(match[0]);
    }
  }
  return used;
}

/** 返回字典里没有任何非字典引用点的键。 */
export function findDeadDictionaryKeys({ dicts, used }) {
  const dead = [];
  for (const { file, keys } of dicts) {
    for (const key of keys) {
      if (!used.has(key)) dead.push({ file, key });
    }
  }
  return dead.sort((a, b) => `${a.file}.${a.key}`.localeCompare(`${b.file}.${b.key}`));
}

/**
 * R16.78：组件自己声明的字典接口里，从未被本文件读过的字段。
 *
 * 上面那套整键口径看不见这一类：`aiSummaryError` 在页面里有装配点
 * （`error: t.chapter.aiSummaryError`），所以键是「活的」；可声明了 `error: string`
 * 的那个组件一次都没读它，界面上一句失败提示都不剩。危险比裸死键更大——
 * 改字典的人看着装配点，真心以为改到界面上去了。
 *
 * 判定同样取保守方向：字段名在**声明块之外**以任何形态出现（成员访问、解构、
 * 字符串常量当作动态键）都算读过。`replay-trainer.tsx` 的 `difficultyNew` 就是
 * 靠 `{ labelKey: "difficultyNew" }` + `dict[d.labelKey]` 间接读的，
 * 只认 `dict.<字段>` 会把它误判成死字段。
 */

/** 组件本地的字典接口声明行：`interface XxxDict {` / `export type XxxDict = {`。 */
const DICT_INTERFACE = /^(?:export\s+)?(?:interface\s+(\w*Dict\w*)|type\s+(\w*Dict\w*)\s*=)\s*\{\s*$/;
const DICT_MEMBER = /^\s+(\w+)\??:\s*(.+?)\s*;?$/;

/** 组件本地字典接口的「文案字段」类型：`string`，以及一组文案的 `string[]`。 */
const COPY_TYPE = /^(?:string|string\[\])$/;

/**
 * 取本文件里所有「字段全是文案（`string` / `string[]`）的字典接口」。
 * 混了别的类型（回调、嵌套对象）的接口整个跳过：那种接口的字段语义已经
 * 不是文案，扫描器没有类型系统就别装作看得懂。
 */
export function extractDictInterfaces(source) {
  const lines = String(source).split("\n");
  const found = [];
  for (let i = 0; i < lines.length; i++) {
    const decl = DICT_INTERFACE.exec(lines[i]);
    if (!decl) continue;
    const fields = [];
    let allCopy = true;
    let end = i + 1;
    for (; end < lines.length && !/^\}/.test(lines[end]); end++) {
      // 注释行不算字段：接口里写一行 `/** … */` 说明就把整张接口判废，是最难发现的失配
      const code = lines[end].replace(/\s*\/\/[^/]*$/, "");
      const trimmed = code.trim();
      if (
        !trimmed ||
        trimmed.startsWith("/*") ||
        trimmed.startsWith("*") ||
        trimmed.endsWith("*/")
      )
        continue;
      const member = DICT_MEMBER.exec(code);
      if (!member || !COPY_TYPE.test(member[2])) {
        allCopy = false;
        continue;
      }
      fields.push(member[1]);
    }
    if (!allCopy || fields.length === 0) {
      i = end - 1;
      continue;
    }
    found.push({ name: decl[1] ?? decl[2], fields, declStart: i, declEnd: end });
    i = end - 1;
  }
  return found;
}

/** 声明块之外还出现过的字段名，视为「被读过」。 */
export function findUnreadDictFields({ files }) {
  const unread = [];
  for (const { file, source } of files) {
    for (const dict of extractDictInterfaces(source)) {
      const body = String(source)
        .split("\n")
        .filter((_, index) => index < dict.declStart || index > dict.declEnd)
        .join("\n");
      for (const field of dict.fields) {
        if (!new RegExp(`\\b${field}\\b`).test(body)) {
          unread.push({ file, name: dict.name, field });
        }
      }
    }
  }
  return unread.sort((a, b) =>
    `${a.file}.${a.name}.${a.field}`.localeCompare(`${b.file}.${b.name}.${b.field}`)
  );
}

export function summarizeDeadCopy(dead) {
  return { total: dead.length };
}

/** 超过预算即失败：新出现的死键必须被看见，而不是沉进报告里。 */
export function shouldFailDeadCopy({ dead, budget }) {
  return dead.length > budget;
}

export function renderDeadCopyMarkdown({
  dead,
  budget,
  unread,
  dictFieldBudget,
  scannedFiles,
  generatedOn,
}) {
  const lines = [
    "# 字典死键巡检（R16.21 / R16.78）",
    "",
    "> 自动生成于 " + generatedOn + "（`npm run check:dead-copy`），勿手改。",
    "",
    "## 一、字典里没有任何非字典引用点的键（R16.21）",
    "",
    "判定口径刻意保守：标识符在 `src/`（字典文件自身除外）、",
    "`e2e/`、`scripts/` 里出现一次就算活着，所以这张表**可能漏报、尽量不误报**——误报会把还在",
    "用的文案指使成「可删」。",
    "",
    "## 二、组件声明了、页面装配了、组件自己从不读的字段（R16.78）",
    "",
    "第一目看不见这一类：词条在页面有装配点（`error: t.chapter.aiSummaryError`）所以算活的，",
    "可接住它的组件接口从头到尾没读过这个字段。只看名字里带 `Dict` 的接口，且只在该接口",
    "**全部字段都是文案**（`string` 或 `string[]`）时判定（混了回调或嵌套对象的接口跳过）；",
    "字段名在声明块之外以任何形态出现都算读过——`replay-trainer.tsx` 的 `difficultyNew` 走的是",
    "`{ labelKey: \"difficultyNew\" }` + `dict[d.labelKey]` 这条间接路，只认 `dict.<字段>` 会误报。",
    "",
    "## 汇总",
    "",
    `- 扫描字典文件：${scannedFiles} 个`,
    `- 死键：${dead.length} 个（预算 ${budget}）`,
    `- 组件未读字典字段：${unread.length} 个（预算 ${dictFieldBudget}）`,
    "",
    "| 文件 | 键 |",
    "|---|---|",
  ];
  if (dead.length === 0) lines.push("| — | （无） |");
  for (const entry of dead) lines.push(`| ${entry.file} | \`${entry.key}\` |`);
  lines.push("", "| 文件 | 接口 | 字段 |", "|---|---|---|");
  if (unread.length === 0) lines.push("| — | （无） | — |");
  for (const entry of unread) lines.push(`| ${entry.file} | ${entry.name} | \`${entry.field}\` |`);
  lines.push("");
  return lines.join("\n");
}
