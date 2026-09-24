/**
 * R16.146：扫描数量基线台账的读写与比对（纯函数，`check-scan-counts.mjs` 用）。
 *
 * 台账是一份 markdown 表，每行一个登记点：键、入库时的数量、硬地板、数的是什么。
 * 为什么是 markdown 而不是 JSON：这张表是给人读的，而 `check:report-freshness` 那条通道
 * 认的就是「门禁当场重算、内容不变就不重写」的 `docs/*.md`；写成 JSON 会多出一条
 * 只有机器看的账，而这类账坏掉的时候没人翻。
 */

/** 表头与分隔行：解析时按「第二格是不是非负整数」把它们筛掉 */
const ROW_RE = /^\|\s*([a-z0-9][a-z0-9-]*)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(.*?)\s*\|\s*$/;

/**
 * `recordScanCount` 写出的 JSONL → 行对象。
 * 坏行**抛错而不是跳过**：静默丢一行就等于台账悄悄少一个登记点，那正是这套东西要防的事。
 */
export function parseScanRows(text) {
  const rows = [];
  const seen = new Map();
  const lines = String(text ?? "").split("\n").filter((line) => line.trim());
  for (const line of lines) {
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch {
      throw new Error(`扫描登记有一行不是 JSON：${line.slice(0, 80)}`);
    }
    const { key, count, floor, what } = parsed ?? {};
    if (!/^[a-z0-9][a-z0-9-]*$/.test(String(key))) {
      throw new Error(`扫描登记的键不合法：${String(key)}（要小写字母、数字或短横线）`);
    }
    if (!Number.isInteger(count) || count < 0) {
      throw new Error(`「${key}」登记的数量是 ${String(count)}：不是非负整数`);
    }
    if (!Number.isInteger(floor) || floor < 1) {
      throw new Error(`「${key}」登记的地板是 ${String(floor)}：不是正整数`);
    }
    if (!String(what ?? "").trim()) {
      throw new Error(`「${key}」没写数的是什么：台账里那一行要能让人看懂这个数`);
    }
    // 同一个键登记两次：两个数一样是重复统计，不一样是有一处口径变了，两种都不能当成没事
    const prior = seen.get(key);
    if (prior !== undefined && prior !== count) {
      throw new Error(`「${key}」被登记了两次而且数不一样：${prior} 与 ${count}（同一个键只能有一个口径）`);
    }
    seen.set(key, count);
    rows.push({ key, count, floor, what: String(what) });
  }
  return rows;
}

/** 行对象 → 台账正文（按键排序、无时间戳，所以同样的人数写出同样的字节） */
export function renderScanCounts(rows) {
  const sorted = [...rows].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const lines = [
    "# Scan-count baseline",
    "",
    "<!-- 由 `npm run check:scan-counts` 重算，勿手改。要有意缩小：跑 `npm run check:scan-counts -- --update-baseline` 并把理由写进提交信息。 -->",
    "",
    "这一份记的是**各计数型门禁上一次入库时实际扫到的数量**。各门禁自己的硬地板（`scanFloorViolation`）",
    "只卡跌破地板的那部分少扫，地板与实测之间那点余量归这张表管：任何一键比入库时小，",
    "`check:scan-counts` 就红——「删掉一批文件」从此必须显式认账，而不是靠人自己想起来改数。",
    "",
    "| key | 数量 | 硬地板 | 数的是什么 |",
    "| --- | ---: | ---: | --- |",
  ];
  for (const row of sorted) {
    lines.push(`| ${row.key} | ${row.count} | ${row.floor} | ${row.what} |`);
  }
  return `${lines.join("\n")}\n`;
}

/** 台账正文 → `Map<key, {count, floor, what}>`；表头与分隔行按「第二格是整数」筛掉 */
export function parseScanCountsReport(markdown) {
  const baseline = new Map();
  for (const line of String(markdown ?? "").split("\n")) {
    const match = ROW_RE.exec(line);
    if (!match) continue;
    const [, key, count, floor, what] = match;
    baseline.set(key, { count: Number(count), floor: Number(floor), what });
  }
  return baseline;
}

/**
 * 本次行数与入库基线相比。
 * @returns {{shrinks: Array<{key:string,count:number,baseline:number,what:string}>,
 *            unknownKeys: string[], missingKeys: string[]}}
 * - `shrinks`：某一键比入库时少扫；
 * - `unknownKeys`：台账里没有的键（新增登记点，要人看一眼它在数什么）；
 * - `missingKeys`：台账里有、这次没登记到的键——登记点被搬走或删掉的形状。
 * 基线为空（还没有入库版本）时三者都空，第一次跑只负责把表建起来。
 */
export function diffScanCounts({ rows, baseline }) {
  const shrinks = [];
  const unknownKeys = [];
  const liveKeys = new Set();
  for (const row of rows ?? []) {
    liveKeys.add(row.key);
    const prior = baseline?.get?.(row.key);
    if (prior === undefined) {
      if (baseline && baseline.size > 0) unknownKeys.push(row.key);
      continue;
    }
    if (row.count < prior.count) {
      shrinks.push({ key: row.key, count: row.count, baseline: prior.count, what: row.what });
    }
  }
  const missingKeys = [...(baseline?.keys?.() ?? [])].filter((key) => !liveKeys.has(key));
  return { shrinks, unknownKeys, missingKeys };
}
