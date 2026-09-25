/**
 * pgTAP 断言数与文档引用对账。
 *
 * 文档里手写「N 条断言」这类数字必然漂移：本仓库已经两次发现 roadmap/database-testing
 * 还写着旧的 26，而 `sync_and_constraints.sql` 早已升到 30。历史条目（docs/progress.md
 * 是追加式日志）不改，但**现行文档**引用的数字必须等于 `supabase/tests/*.sql` 里的
 * `select plan(N)`。新增/删除断言时忘了改文档，这道门禁就红。
 *
 * 用法：npm run check:db-assertion-counts
 *
 * R16.83：`AUDITED_DOCS` 里哪篇文档被改名或删掉，原来的写法是 `filter(existsSync)`
 * 悄悄少扫一篇——引用错位的那篇恰好不在场时照样判绿。现在声明要核对的文档必须都在，
 * 少一篇就失败。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scanFloorViolation, recordScanCount } from "./scan-floor-lib.mjs";

/** 现行文档（会被引用的那几篇）；progress.md 是历史记录，不参与对账 */
export const AUDITED_DOCS = ["docs/database-testing.md", "docs/roadmap.md"];

/**
 * R16.268：`docs/roadmap.md` 一篇里住着两种东西——`## Q…` 那几节说的是**现在**的门禁
 * （Q2.8、Q5.4 就在里面），`## R…` 之后是逐轮结案台账。台账行会把「原文写的是 40+30+8」
 * 这类被改掉的旧数字**当证据引用**，整篇扫就会把一句真话报成不符（第三十五轮那行恰好同时
 * 撞上两种取数写法）。所以 roadmap 只取 Q 节，其余与 progress.md 同样按历史记录豁免。
 * 抽完为空不当「没有不符」放过去——那是 R16.83 那一族。
 */
export const CURRENT_SECTIONS = { "docs/roadmap.md": /^## Q/ };

/** 只留下标题匹配 `re` 的 `## ` 小节。 */
export function pickSections(text, re) {
  const out = [];
  let keep = false;
  for (const line of text.split("\n")) {
    if (line.startsWith("## ")) keep = re.test(line);
    if (keep) out.push(line);
  }
  return out.join("\n");
}

/** 从 pgTAP 文件读出 basename → plan(N) */
export function readPlanCounts(dir) {
  const plans = new Map();
  for (const entry of fs.readdirSync(dir)) {
    if (!entry.endsWith(".sql")) continue;
    const sql = fs.readFileSync(path.join(dir, entry), "utf8");
    const m = /select\s+plan\(\s*(\d+)\s*\)/i.exec(sql);
    if (m) plans.set(entry.replace(/\.sql$/, ""), Number(m[1]));
  }
  return plans;
}

/**
 * 找出文档里与真实 plan 不符的断言数。
 * 两种写法都要覆盖：紧跟文件名的「xxx.sql（30 条断言）」，
 * 以及不带文件名的聚合写法「重跑 pgTAP(40+30+8 断言)」。
 */
export function auditDocCitations({ plans, docs }) {
  const issues = [];
  const sortedPlans = [...plans.values()].sort((a, b) => a - b);

  for (const { file, text } of docs) {
    const lines = text.split("\n");
    for (const [name, count] of plans) {
      for (const line of lines) {
        if (!line.includes(name) || !line.includes("断言")) continue;
        // 文件名后紧跟的第一个数字就是它声称的断言数
        const after = line.slice(line.indexOf(name) + name.length);
        const cited = /\d{1,4}/.exec(after);
        if (!cited || Number(cited[0]) === count) continue;
        issues.push({
          file,
          detail: `${name} 文档写 ${cited[0]} 条断言，supabase/tests/${name}.sql 的 plan 是 ${count}`,
        });
      }
    }

    for (const m of text.matchAll(/(\d{1,3}(?:\s*\+\s*\d{1,3})+)\s*(?:条)?断言/g)) {
      const cited = m[1]
        .split("+")
        .map((n) => Number(n.trim()))
        .sort((a, b) => a - b);
      if (cited.length !== sortedPlans.length || cited.some((n, i) => n !== sortedPlans[i])) {
        issues.push({
          file,
          detail: `聚合写法「${m[1]} 断言」与真实 plan 集合 ${sortedPlans.join("+")} 不符`,
        });
      }
    }
  }

  return issues;
}

export function run({ root = process.cwd(), log = console.log, exit = (code) => process.exit(code) } = {}) {
  const testDir = path.join(root, "supabase", "tests");
  if (!fs.existsSync(testDir)) {
    log(`db-assertion-counts: 找不到 pgTAP 目录 ${testDir}——扫不到测试时「没有不符」不含任何信息`);
    return exit(1);
  }
  const plans = readPlanCounts(testDir);
  if (plans.size === 0) {
    log("db-assertion-counts: 没读到任何 pgTAP plan，检查 supabase/tests/ 是否存在");
    return exit(1);
  }

  const absent = AUDITED_DOCS.filter((f) => !fs.existsSync(path.join(root, f)));
  const shrunk = scanFloorViolation({
    count: AUDITED_DOCS.length - absent.length,
    floor: AUDITED_DOCS.length,
    what: "对账用的现行文档",
  });
  recordScanCount({
    key: "db-audited-docs",
    count: AUDITED_DOCS.length - absent.length,
    floor: AUDITED_DOCS.length,
    what: "对账用的现行文档",
  });
  if (shrunk) {
    log(`db-assertion-counts: ${shrunk}`);
    log(`  缺席的是：${absent.join("、")}——把文档改名或删掉不会让引用自动变对，只会让这道检查少看几篇。`);
    return exit(1);
  }

  const docs = [];
  const blind = [];
  for (const file of AUDITED_DOCS) {
    const raw = fs.readFileSync(path.join(root, file), "utf8");
    const re = CURRENT_SECTIONS[file];
    const text = re ? pickSections(raw, re) : raw;
    // 只剩几行标题等于什么都没扫到——「没有不符」在这种时候不含信息
    if (re && text.split("\n").filter((l) => !l.startsWith("## ")).join("\n").trim() === "") {
      blind.push(`${file}（没有一节匹配 ${String(re)} 里有正文）`);
    }
    docs.push({ file, text });
  }
  if (blind.length > 0) {
    log(
      `db-assertion-counts: 有文档节选后只剩标题，对账扫不到任何引用：${blind.join("、")}`,
    );
    return exit(1);
  }

  const issues = auditDocCitations({ plans, docs });
  if (issues.length > 0) {
    for (const issue of issues) log(`❌ ${issue.file}: ${issue.detail}`);
    log(
      `db-assertion-counts: ${issues.length} 处文档断言数与 pgTAP plan 不符（改完断言记得同步现行文档；历史记录不改）`,
    );
    return exit(1);
  }

  log(
    `db-assertion-counts audit passed: ${[...plans.entries()].map(([n, c]) => `${n}=${c}`).join(", ")} · ${AUDITED_DOCS.length} 篇现行文档引用一致`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run();
}
