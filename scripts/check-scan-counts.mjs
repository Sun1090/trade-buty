#!/usr/bin/env node
/**
 * R16.146（未尽项）：扫描数量相对「上一次入库的快照」比，而不是只比一条手写地板。
 *
 * 五道计数型门禁各有一处 `scanFloorViolation`，它们只卡**跌破地板的**少扫；地板与实测之间
 * 常年留着余量（2026-09-25 实测：700 对 771、400 对 419、11 对 12），所以「删掉 50 个文件、
 * 仍站在地板之上」的提交照样全绿。这一道补的就是那一段：把每处扫描当次数到的数写进
 * `docs/scan-counts.md`，与入库的那一份逐键相比，**变小就红**。
 *
 * 数量由门禁自己报，不由本脚本重数一遍：本脚本把五道门禁作为子进程跑一遍，环境里放一个
 * `SCAN_COUNTS_FILE`，被 `recordScanCount` 登记到那份临时件里。所以台账里的数字与门禁当场
 * 判绿时读的是同一个变量——两套口径正是这类基线最先烂掉的地方。
 *
 * 真要缩小（删了文档、下线了接口）：`npm run check:scan-counts -- --update-baseline` 重写基线，
 * 并把理由写进提交信息。没有这个开关，缩小就红；这是地板那句「要人自己改数并说清楚」的
 * 可执行版本。
 *
 * 用法：npm run check:scan-counts（CI 里排在 `check:report-freshness` 之前）
 * 退出码非 0：某处扫描少扫了、登记点不见了、或子进程自己判红。
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { renderScanCounts, parseScanRows, parseScanCountsReport, diffScanCounts } from "./scan-counts-lib.mjs";
import { writeReport } from "./report-write-lib.mjs";

/** 谁在数东西：npm 脚本名，逐个作为子进程跑一遍 */
export const SCAN_COUNT_COMMANDS = [
  "check:secrets",
  "check:db-assertion-counts",
  "check:frontmatter",
  "check:kb-en-content",
  "check:request-body-bounds",
];

/** 2026-09-25 实测 6 处登记点。少一处意味着某处 `recordScanCount` 被删或挪到了走不到的分支上。 */
export const MIN_KEYS = 6;

const root = process.cwd();
/** 承认差异并把它写进基线：少扫与新增登记点都走这一个显式开关，不认就是红。 */
const updateBaseline = process.argv.includes("--update-baseline");
const rowsFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "scan-counts-")), "rows.jsonl");

let childFailures = 0;
for (const command of SCAN_COUNT_COMMANDS) {
  const result = spawnSync("npm", ["run", "--silent", command], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, SCAN_COUNTS_FILE: rowsFile },
  });
  if (result.status !== 0) {
    childFailures += 1;
    console.error(`❌ ${command} 退出码 ${result.status}：它自己的结论已经不成立，数量也不可信，先修它`);
    const tail = String(result.stderr || result.stdout || "").trim().split("\n").slice(-3).join("\n");
    if (tail) console.error(tail);
  }
}
if (childFailures > 0) {
  fs.rmSync(path.dirname(rowsFile), { recursive: true, force: true });
  console.error(`❌ ${childFailures} 道门禁子进程非 0 退出，本次不重写基线`);
  process.exit(1);
}

let rows;
try {
  rows = parseScanRows(fs.readFileSync(rowsFile, "utf8"));
} catch (error) {
  rows = null;
  console.error(`❌ 扫描登记读不进去：${error.message}`);
}
fs.rmSync(path.dirname(rowsFile), { recursive: true, force: true });
if (!rows) process.exit(1);

const seen = new Set(rows.map((row) => row.key));
if (seen.size < MIN_KEYS) {
  console.error(
    `❌ 只收到 ${seen.size} 处扫描登记，地板 ${MIN_KEYS} 处（少 ${MIN_KEYS - seen.size}）。` +
      `登记点不会自己消失：先确认这五道门禁都还在跑、都还调 recordScanCount。`,
  );
  process.exit(1);
}

/** 报告落盘路径写成 `path.join(root, "docs/…")` 的字面形状，`check:report-freshness` 靠这个形状推导清单。 */
const committedPath = path.join(root, "docs/scan-counts.md");
const committedExists = fs.existsSync(committedPath);
const committed = committedExists
  ? parseScanCountsReport(fs.readFileSync(committedPath, "utf8"))
  : new Map();
// 台账读不出行来，比对就成了「每一条都是新增」，那不是少扫而是拿着空账在判。
// 这一条把「表格自己坏了」和「扫描真的变了」分开。
if (committedExists && !updateBaseline && committed.size < MIN_KEYS) {
  console.error(
    `❌ 入库的基线只读出 ${committed.size} 条，地板 ${MIN_KEYS} 条：台账本身对不上形状` +
      `（表格被手改坏、键名不合法都会走到这里）。先跑 \`npm run check:scan-counts -- --update-baseline\` 让它重写。`,
  );
  process.exit(1);
}
const { shrinks, unknownKeys, missingKeys } = diffScanCounts({ rows, baseline: committed });

const diffs = [
  ...shrinks.map(({ key, what, count, baseline }) => `少扫 ${key}（${what}）：本次 ${count}，入库 ${baseline}`),
  ...unknownKeys.map((key) => `新增登记点 ${key}：台账里没有它`),
  ...missingKeys.map((key) => `登记点不见了 ${key}：台账里有，这一次没收到`),
];
if (diffs.length > 0 && !updateBaseline) {
  for (const line of diffs) console.error(`❌ ${line}`);
  console.error(
    "少扫不是好消息：先查被扫的目录还在不在、glob 有没有写错、子模块有没有 init。" +
      "确认这是有意的变化（真删了一批文件、加了新的一处登记），再跑 " +
      "`npm run check:scan-counts -- --update-baseline` 重写基线，并把理由写进提交信息。",
  );
  process.exit(1);
}

const status = writeReport(path.join(root, "docs/scan-counts.md"), renderScanCounts(rows));
console.error(
  `[scan-counts] ${rows.length} 处登记 · 入库基线 ${committed.size} 条 · 报告${status === "unchanged" ? "无变化" : `已重写（${status}）`}` +
    (diffs.length ? ` · 本次按授权写下 ${diffs.length} 处差异：\n${diffs.map((d) => `   - ${d}`).join("\n")}` : ""),
);
