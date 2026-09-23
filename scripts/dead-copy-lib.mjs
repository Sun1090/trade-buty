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

export function summarizeDeadCopy(dead) {
  return { total: dead.length };
}

/** 超过预算即失败：新出现的死键必须被看见，而不是沉进报告里。 */
export function shouldFailDeadCopy({ dead, budget }) {
  return dead.length > budget;
}

export function renderDeadCopyMarkdown({ dead, budget, scannedFiles, generatedOn }) {
  const lines = [
    "# 字典死键巡检（R16.21）",
    "",
    "> 自动生成于 " + generatedOn + "（`npm run check:dead-copy`），勿手改。",
    "",
    "字典里没有任何非字典引用点的键。判定口径刻意保守：标识符在 `src/`（字典文件自身除外）、",
    "`e2e/`、`scripts/` 里出现一次就算活着，所以这张表**可能漏报、尽量不误报**——误报会把还在",
    "用的文案指使成「可删」。",
    "",
    "## 汇总",
    "",
    `- 扫描字典文件：${scannedFiles} 个`,
    `- 死键：${dead.length} 个（预算 ${budget}）`,
    "",
    "| 文件 | 键 |",
    "|---|---|",
  ];
  if (dead.length === 0) lines.push("| — | （无） |");
  for (const entry of dead) lines.push(`| ${entry.file} | \`${entry.key}\` |`);
  lines.push("");
  return lines.join("\n");
}
