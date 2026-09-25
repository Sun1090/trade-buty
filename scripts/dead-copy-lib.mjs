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
 * R16.272 把两处口径各收紧一步，两处都是 R16.78 上线后仍然漏掉 `AiQuiz` 的原因：
 *
 * **形状**：除 `interface XxxDict {` 之外，还认 props 类型里的内联写法
 * `dict: { generate: string; … }`（一行可以声明好几个字段）。只认「接口名里带
 * `Dict`」等于把这种写法整张放过，而 `AiQuiz` 的 `question`/`explain` 就藏在里面。
 * 判「这是不是一张文案表」的结构性信号是**每个字段都带 `string` / `string[]` 类型
 * 标注**：对象字面量写的是值不是类型，所以 `const DICT = { zh: { heading: "行情" } }`
 * 不会被误收。
 *
 * **读过**：字段名必须挂在**这个文件里那张字典所绑定的那个变量**上才算读过——
 * `dict.<字段>`、从 `dict` 解构、或 `<字段>` 作为字符串常量出现在 `dict[...]` 的
 * 动态取法里。接收者只从声明处推（props 标注 `dict: BannerDict`、内联块的键名本身、
 * `const DICT: Record<…, BannerDict>`），再走一跳别名（`const dict = DICT[locale]`）。
 * 原来「名字在文件里出现过就算读过」为什么不行：`ai-quiz.tsx` 里 `question` 满文件
 * 都是（`q.question` 是 AI 返回的数据对象），字段其实一行都没渲染。反过来说，
 * 接收者**不能**从「观测到的属性访问」推——那样 `q` 会被升成接收者，收紧当场归零。
 * `replay-trainer.tsx` 的 `difficultyNew` 这类间接读法仍算读过，靠的是字符串常量
 * 那条分支。
 *
 * 推不出接收者的接口（props 类型住在别的文件里之类）这一路判不动，交给
 * `findUnjudgeableDictInterfaces` 点名，巡检器见到就失败——判不动不能读成没问题。
 */

/** 组件本地的字典接口声明行：`interface XxxDict {` / `export type XxxDict = {`。 */
const DICT_INTERFACE = /^(?:export\s+)?(?:interface\s+(\w*Dict\w*)|type\s+(\w*Dict\w*)\s*=)\s*\{\s*$/;
/** 内联写法：props 类型里的 `dict: {` / `labels: {`，字段类型可以一行写好几个。 */
const INLINE_DICT_HEAD = /^(\s+)(\w+)\s*:\s*\{\s*$/;

/** 组件本地字典接口的「文案字段」类型：`string`，以及一组文案的 `string[]`。 */
const COPY_TYPE = /^(?:string|string\[\])$/;

/** 一行里可能挤了好几个字段声明：`generate: string; generating: string;` */
function membersOfLine(line) {
  const stripped = line.replace(/\s*\/\/[^/]*$/, "").trim();
  if (
    !stripped ||
    stripped.startsWith("/*") ||
    stripped.startsWith("*") ||
    stripped.endsWith("*/")
  )
    return { names: [], copyOnly: true, empty: true };
  const names = [];
  let copyOnly = true;
  for (const part of stripped.replace(/[,;]$/, "").split(";")) {
    const piece = part.trim();
    if (!piece) continue;
    const member = /^(\w+)\??\s*:\s*(.+)$/.exec(piece);
    if (!member || !COPY_TYPE.test(member[2].trim())) copyOnly = false;
    else names.push(member[1]);
  }
  return { names, copyOnly, empty: false };
}

/**
 * 取本文件里所有「字段全是文案（`string` / `string[]`）的字典接口」，
 * 含 props 类型里的内联 `dict: {` 写法。
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
      const parsed = membersOfLine(lines[end]);
      if (parsed.empty) continue;
      if (!parsed.copyOnly || parsed.names.length === 0) {
        allCopy = false;
        continue;
      }
      fields.push(...parsed.names);
    }
    if (!allCopy || fields.length === 0) {
      i = end - 1;
      continue;
    }
    found.push({ name: decl[1] ?? decl[2], fields, declStart: i, declEnd: end, inline: false });
    i = end - 1;
  }
  // 内联写法：props 类型里的 `dict: {`，同样要求每个字段都带文案类型标注
  // （对象字面量写的是值不是类型，所以组件本地那份 `const DICT = { zh: { … } }` 不会被误收）。
  // 嵌在已收接口里的那种不可能存在：`x: {` 这一行本身就过不了「全是 string」那条。
  for (let i = 0; i < lines.length; i++) {
    const head = INLINE_DICT_HEAD.exec(lines[i]);
    if (!head) continue;
    const indent = head[1].length;
    const fields = [];
    let allCopy = true;
    let end = i + 1;
    for (; end < lines.length; end++) {
      const closing = new RegExp(`^\\s{0,${indent}}}\\s*[,;]?\\s*$`).test(lines[end]);
      if (closing) break;
      const parsed = membersOfLine(lines[end]);
      if (parsed.empty) continue;
      if (!parsed.copyOnly || parsed.names.length === 0) {
        allCopy = false;
        continue;
      }
      fields.push(...parsed.names);
    }
    if (!allCopy || fields.length === 0) {
      i = end;
      continue;
    }
    found.push({ name: head[2], fields, declStart: i, declEnd: end, inline: true });
    i = end;
  }
  return found.sort((a, b) => a.declStart - b.declStart);
}

/**
 * 这个文件里那张字典绑在哪些标识符上，以及声明块之外的正文。
 * 接收者只从声明处推：内联块的键名本身、`dict: XxxDict` / `Record<…, XxxDict>` 标注，
 * 然后走一跳别名（`const dict = DICT[locale]`）。
 */
export function dictReceivers(source, dict) {
  const lines = String(source).split("\n");
  const body = lines
    .filter((_, index) => index < dict.declStart || index > dict.declEnd)
    .join("\n");
  const names = new Set();
  if (dict.inline) names.add(dict.name);
  else {
    for (const m of body.matchAll(new RegExp(`(\\w+)\\??\\s*:\\s*(?:Readonly<)?\\s*${dict.name}\\b`, "g")))
      names.add(m[1]);
    for (const m of body.matchAll(new RegExp(`(\\w+)\\s*:\\s*Record<[^>]*${dict.name}\\s*>`, "g")))
      names.add(m[1]);
  }
  for (const seed of [...names]) {
    for (const m of body.matchAll(
      new RegExp(`(?:const|let)\\s+(\\w+)\\s*=[^;\\n]*\\b${seed}\\b\\s*(?:\\[[^\\]]*\\])?\\s*[;\\n]`, "g")
    ))
      names.add(m[1]);
  }
  return { body, names: [...names] };
}

function scanFiles({ files }) {
  const unread = [];
  const unjudgeable = [];
  for (const { file, source } of files) {
    for (const dict of extractDictInterfaces(source)) {
      const { body, names } = dictReceivers(source, dict);
      if (names.length === 0) {
        unjudgeable.push({ file, name: dict.name, fieldCount: dict.fields.length });
        continue;
      }
      const bracket = names.some((n) => new RegExp(`\\b${n}\\s*\\[`).test(body));
      for (const field of dict.fields) {
        const member = names.some((n) => new RegExp(`\\b${n}\\s*\\.\\s*\\??\\s*${field}\\b`).test(body));
        const destructured = names.some((n) =>
          new RegExp(`\\{[^{}]*\\b${field}\\b[^{}]*\\}\\s*(?::[^=]*)?=\\s*${n}\\b`).test(body)
        );
        const viaKey = bracket && new RegExp(`["'\`]${field}["'\`]`).test(body);
        if (!(member || destructured || viaKey)) {
          unread.push({ file, name: dict.name, field });
        }
      }
    }
  }
  const byPath = (a, b) =>
    `${a.file}.${a.name}.${a.field ?? ""}`.localeCompare(`${b.file}.${b.name}.${b.field ?? ""}`);
  return { unread: unread.sort(byPath), unjudgeable: unjudgeable.sort(byPath) };
}

/** 声明了、这个文件却从不挂回字典变量的字段。 */
export function findUnreadDictFields({ files }) {
  return scanFiles({ files }).unread;
}

/** 认得出是字典接口、却推不出它绑在谁身上的接口——这一路判不动，必须显式看见。 */
export function findUnjudgeableDictInterfaces({ files }) {
  return scanFiles({ files }).unjudgeable;
}


export function summarizeDeadCopy(dead) {
  return { total: dead.length };
}

/** 超过预算即失败：新出现的死键必须被看见，而不是沉进报告里。 */
export function shouldFailDeadCopy({ dead, budget }) {
  return dead.length > budget;
}

/**
 * 预算与下限的读取（R16.82）。
 *
 * 四个数都必须写在文件里：`budget` / `dictFieldBudget` 是「多一个就失败」的上限，
 * `minDictionaryKeys` / `minDictInterfaces` 是「少一批就失败」的下限——下限保的是
 * 巡检器自己还在扫东西。R16.81 的教训正是下限形同虚设：接口数从 18 掉到 17，
 * 而下限是 10，红绿一点没变。
 */
const BUDGET_FIELDS = ["budget", "dictFieldBudget", "minDictionaryKeys", "minDictInterfaces"];

/** 解析并校验预算文件；任何一项缺失或不是非负整数都抛错，绝不返回 `undefined`。 */
export function parseDeadCopyBudget(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("预算文件不是合法 JSON");
  }
  const missing = BUDGET_FIELDS.filter((field) => !Number.isInteger(parsed?.[field]));
  if (missing.length > 0) {
    throw new Error(`缺少数值项（须为整数）：${missing.join(" / ")}`);
  }
  const negative = BUDGET_FIELDS.filter((field) => parsed[field] < 0);
  if (negative.length > 0) {
    throw new Error(`预算与下限不能为负：${negative.join(" / ")}`);
  }
  return parsed;
}

export function renderDeadCopyMarkdown({
  dead,
  budget,
  unread,
  dictFieldBudget,
  unjudgeable = [],
  scannedFiles,
  generatedOn,
}) {
  const lines = [
    "# 字典死键巡检（R16.21 / R16.78 / R16.272）",
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
    "可接住它的组件接口从头到尾没读过这个字段。收两种形状（R16.272）：名字里带 `Dict` 的接口，",
    "以及 props 类型里内联的 `dict: { generate: string; … }`；两边都只在该表**每个字段都带",
    "`string` / `string[]` 类型标注**时判定——对象字面量写的是值不是类型，所以组件本地那份",
    "`const DICT = { zh: { heading: \"…\" } }` 不会被当成内联接口，混了回调或嵌套对象的接口整个跳过。",
    "",
    "「读过」要求字段挂在**这张字典在本文件绑定的那个变量**上：`dict.<字段>`、从 `dict` 解构，",
    "或字段名以字符串常量出现在 `dict[…]` 的动态取法里（`replay-trainer.tsx` 的 `difficultyNew`",
    "走的正是这条）。变量名只从声明处推——props 标注 `dict: BannerDict`、内联块自己的键名、",
    "`const DICT: Record<…, BannerDict>`——再走一跳别名（`const dict = DICT[locale]`）。",
    "名字在文件里出现过不算读过：`ai-quiz.tsx` 的 `question` 出现得到处都是，可读它的是",
    "`q.question`（AI 返回的数据对象），那份界面文案一次都没渲染。反过来，接收者也不能",
    "「从观测到的属性访问推」——那样 `q` 会被升成字典变量，这一路当场又变成全绿。",
    "判定逐文件做：别的文件读过同一个字段名不算读过。",
    "",
    "## 三、认得出是字典接口、却推不出它绑在谁身上的接口（R16.272）",
    "",
    "第二目对这类接口判不动（props 类型住在别的文件、或装配写法换了形状）。判不动不等于没问题，",
    "所以这张表非空时 `check:dead-copy` 直接失败，逼着下一个人要么把形状补进推法里，要么改掉装配。",
    "",
    "## 汇总",
    "",
    `- 扫描字典文件：${scannedFiles} 个`,
    `- 死键：${dead.length} 个（预算 ${budget}）`,
    `- 组件未读字典字段：${unread.length} 个（预算 ${dictFieldBudget}）`,
    `- 判不动的字典接口：${unjudgeable.length} 个（须为 0）`,
    "",
    "| 文件 | 键 |",
    "|---|---|",
  ];
  if (dead.length === 0) lines.push("| — | （无） |");
  for (const entry of dead) lines.push(`| ${entry.file} | \`${entry.key}\` |`);
  lines.push("", "| 文件 | 接口 | 字段 |", "|---|---|---|");
  if (unread.length === 0) lines.push("| — | （无） | — |");
  for (const entry of unread) lines.push(`| ${entry.file} | ${entry.name} | \`${entry.field}\` |`);
  lines.push("", "| 文件 | 接口 | 字段数 |", "|---|---|---|");
  if (unjudgeable.length === 0) lines.push("| — | （无） | — |");
  for (const entry of unjudgeable)
    lines.push(`| ${entry.file} | ${entry.name} | ${entry.fieldCount} |`);
  lines.push("");
  return lines.join("\n");
}
