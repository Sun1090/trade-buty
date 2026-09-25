/**
 * R16.220–R16.224：门禁表与发布清单里那些「描述工具怎么工作」的句子，必须由工具自己签字。
 *
 * 这一轮查出来五处文档说的不是仓库里的事实：
 * - `docs/ops.md` 把 `npm run check:mobile` 说成「`CORE_SUFFIXES` × `LOCALES` 生成 + 每条必须 200」，
 *   而那套机制在 `e2e/mobile-overflow.spec.ts`；脚本拿的是写死的 14 条清单，
 *   且 `page.goto` 的响应被丢掉——一条 404 也算「不溢出」，死路径能冒充覆盖；
 * - 迁移清单「按文件名顺序执行」却停在 `0008`，而 `0009_atomic_embedding_generations.sql`
 *   已经存在、`db-test` 连它的回滚都演练；
 * - 「`lhci` 的性能断言」排在「失败阻断合并」那节里，可 `.lighthouserc.json` 把
 *   `categories:performance` 设成 `warn`——性能退化从来不会让 CI 红；
 * - `docs/release-checklist.md` 手抄了一个台账份数（写 17，门禁当场印 18）；
 * - §3 那一串少了 `check:scan-counts`，而它是 `docs/scan-counts.md` 的生产者，
 *   排在 `check:report-freshness` 之后等于让 freshness 比对一份没人重算过的文件。
 *
 * 所以这里的每一条都是**从权威推导**，不是把文档里的数字换个新值再抄一遍：
 * 份数来自 `collectReportInventory`、路径条数来自 `check-mobile.mjs` 的 `ROUTES`、
 * 迁移与回滚清单来自 `supabase/` 目录、严重级别来自 `.lighthouserc.json`。
 *
 * 运行：`npx vitest run scripts/ops-doc-claims.test.mjs`（跟随 `npm test`）
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { collectReportInventory, SELF_REPORT_FILES } from "./report-freshness-lib.mjs";

const root = process.cwd();
const read = (rel) => readFileSync(path.join(root, rel), "utf8");
const ops = read("docs/ops.md");
const checklist = read("docs/release-checklist.md");
const contributing = read("CONTRIBUTING.md");

/** 取门禁表里以某个命令开头的那一行（第一列精确匹配） */
function gateRow(markdown, command) {
  const row = markdown
    .split("\n")
    .find((line) => line.startsWith(`| \`${command}\``) || line.startsWith(`| \`db-tests\` · \`${command}\``));
  expect(row, `门禁表里找不到 ${command} 这一行`).toBeTruthy();
  return row;
}

describe("台账份数只有一个主人", () => {
  /** 与 `check-report-freshness.mjs` 同一套推导：scripts/*.mjs 排除它自己的本体与用例 */
  const sources = readdirSync(path.join(root, "scripts"))
    .filter((file) => file.endsWith(".mjs") && !SELF_REPORT_FILES.has(file))
    .map((file) => ({ file, source: readFileSync(path.join(root, "scripts", file), "utf8") }));
  const derived = collectReportInventory(sources);

  it("推导本身没有缩水（少于 15 份说明扫描瞎了）", () => {
    expect(derived.length).toBeGreaterThanOrEqual(15);
  });

  it("docs/ops.md 那句「当前 N 份」等于推导出的 N", () => {
    const claimed = Number(/当前\s*(\d+)\s*份/.exec(ops)?.[1]);
    expect(Number.isFinite(claimed), "ops.md 里找不到那份台账的份数声明，谁来核对？").toBe(true);
    expect(claimed, `ops.md 写「当前 ${claimed} 份」，推导出来是 ${derived.length} 份`).toBe(derived.length);
  });

  it("docs/release-checklist.md 不再手抄份数（抄一次就漂一次）", () => {
    expect(checklist).not.toMatch(/\d+\s*份幂等台账/);
    // 对照：旧写法正是「那 17 份幂等台账」，而门禁当场印 18
    expect("那 17 份幂等台账").toMatch(/\d+\s*份幂等台账/);
  });
});

describe("check:mobile 那一行说的是这个脚本真的做的事", () => {
  const mobileScript = read("scripts/check-mobile.mjs");
  const routes = [...mobileScript.matchAll(/^\s*"\/[^"]+",?$/gm).map((m) => m[0].trim().replace(/[",]/g, ""))];
  const row = gateRow(ops, "npm run check:mobile");

  it("脚本确实检查状态码（404 不许算「页面正常」）", () => {
    // 只看「有没有 200 这个字」太松：把条件改成 `false && status !== 200` 照样过。
    // 判据要的是那条不达标就计入 failures 的分支。
    expect(
      /if \(status !== 200\) \{[\s\S]{0,160}?failures\.push\(/.test(mobileScript),
      "R16.220 那条 200 断言不见了（或不再计入失败）：死路径又能冒充覆盖了",
    ).toBe(true);
  });

  it("行里写的路径条数就是脚本清单的长度", () => {
    expect(routes.length, "脚本里的 ROUTES 解析不出条目，这条门禁是空转").toBeGreaterThanOrEqual(10);
    const claimed = Number(/(\d+)\s*条路径/.exec(row)?.[1]);
    expect(Number.isFinite(claimed), "这一行不再报清单长度，谁去数？").toBe(true);
    expect(claimed, `这一行说 ${claimed} 条，脚本里的 ROUTES 有 ${routes.length} 条`).toBe(routes.length);
  });

  it("双语 × 全核心路径那份矩阵归给 e2e，不归这个脚本", () => {
    expect(row, "`CORE_SUFFIXES` × `LOCALES` 那份矩阵在 e2e，把它的名字留在这里就是再次张冠李戴").toContain(
      "e2e/mobile-overflow.spec.ts",
    );
    const e2e = read("e2e/mobile-overflow.spec.ts");
    expect(e2e).toMatch(/CORE_SUFFIXES/);
    expect(e2e).toMatch(/LOCALES/);
  });

  it("旧写法（把 e2e 的机制安在脚本头上）过不了上面两条（对照）", () => {
    const legacy =
      "| `npm run check:mobile` | ≥10 条核心路径 × 全部语言（`CORE_SUFFIXES` × `LOCALES` 生成）在 320px 下无横向溢出；清单里每条路径还必须真返回 200 |";
    expect(Number(/(\d+)\s*条路径/.exec(legacy)?.[1]), "对照串没写条数，那条断言是空转").not.toBe(routes.length);
    expect(legacy).not.toContain("e2e/mobile-overflow.spec.ts");
  });
});

describe("迁移与回滚两张清单由目录决定", () => {
  const migrations = readdirSync(path.join(root, "supabase", "migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const rollbacks = readdirSync(path.join(root, "supabase", "rollback"))
    .filter((f) => f.endsWith(".sql"))
    .map((f) => f.slice(0, 4))
    .sort();
  const table = ops.split("## Supabase 迁移清单")[1] ?? "";
  const listed = [...table.matchAll(/^\| `(00\d{2}[^`]+\.sql)`/gm).map((m) => m[1])];

  /** 同一把判据：把表里的某一行抹掉，就得数出「目录里有、表上没有」 */
  const missingFromTable = (tableText) => {
    const rows = [...tableText.matchAll(/^\| `(00\d{2}[^`]+\.sql)`/gm).map((m) => m[1])];
    return migrations.filter((f) => !rows.includes(f));
  };

  it("目录里有 N 个迁移，表里就登记 N 行", () => {
    expect(migrations.length, "迁移目录读不出条目").toBeGreaterThanOrEqual(9);
    expect(
      listed.filter((f) => !migrations.includes(f)),
      "表里登记了目录里不存在的迁移",
    ).toEqual([]);
    expect(
      missingFromTable(table),
      `这些迁移在目录里、清单上没有（照表执行会漏掉它们）：${missingFromTable(table).join(", ")}`,
    ).toEqual([]);
  });

  it("旧表（停在 0008）过不了上面那条（对照）", () => {
    const legacy = table.replace(/^\| `0009[^\n]*\n/m, "");
    expect(legacy, "删不掉 0009 那一行，这条对照是空转").not.toBe(table);
    expect(missingFromTable(legacy), "旧表照样过，上面那条抓不住漏登记的迁移").toEqual([
      "0009_atomic_embedding_generations.sql",
    ]);
  });

  it("db-test 那一行点到 supabase/rollback/ 里的每一项", () => {
    const row = gateRow(ops, "node scripts/db-test.mjs");
    expect(rollbacks.length).toBeGreaterThanOrEqual(2);
    for (const prefix of rollbacks) {
      expect(row, `回滚演练那一行没点 ${prefix}，而它就在 supabase/rollback/ 里`).toContain(prefix);
    }
  });

  it("旧表（停在 0008）过不了上面第一条（对照）", () => {
    const legacyListed = migrations.slice(0, -1);
    expect(legacyListed).not.toEqual(migrations);
  });
});

describe("Lighthouse 的严重级别取自配置，不是取自这张表", () => {
  const assertions = JSON.parse(read(".lighthouserc.json")).ci.assert.assertions;
  const NAMES = {
    "categories:performance": "性能",
    "categories:accessibility": "可访问性",
    "categories:best-practices": "最佳实践",
    "categories:seo": "SEO",
  };
  const present = Object.keys(assertions).filter((k) => k in NAMES);
  const row = gateRow(ops, "npm run lhci");

  it("配置里那四类都在表里有名字", () => {
    expect(present.length).toBe(4);
  });

  for (const key of present) {
    const level = assertions[key][0];
    it(`${NAMES[key]} 在文档里就是 ${level}`, () => {
      // 反引号在模板串里得转义，这里改用普通字符串拼接，正则读起来更直
      const pattern = new RegExp(NAMES[key] + "\\s*是 `" + level + "`");
      expect(pattern.test(row), `这一行没把 ${NAMES[key]} 的严重级别写成 ${level}（配置是权威）`).toBe(true);
    });
  }

  /**
   * 一句话里同时点名的类别必须同一待遇：warn 那一类和「警告 / 不阻断」待在一起，
   * 不许混进「即阻断」。贡献指南以前写「Lighthouse CI 性能与可访问性预算」，
   * 两类并排读起来就是两类都阻断——而配置里性能从来只警告。
   */
  function offendingClauses(line) {
    const bad = [];
    for (const clause of String(line).split(/[，,]/)) {
      for (const key of present) {
        const name = NAMES[key];
        if (!clause.includes(name)) continue;
        if (assertions[key][0] !== "warn") continue;
        if (!/警告|不阻断/.test(clause) || /即阻断/.test(clause)) bad.push(`${name}：${clause.trim()}`);
      }
    }
    return bad;
  }

  it("warn 那一类在贡献指南里不许被写成阻断", () => {
    const warnNames = present.filter((k) => assertions[k][0] === "warn").map((k) => NAMES[k]);
    expect(warnNames.length, "配置里没有 warn 级别了？那这条门禁要改口").toBeGreaterThan(0);
    const lines = contributing.split("\n").filter((l) => l.includes("lhci"));
    expect(lines.length, "贡献指南里找不到 lhci 那一行").toBeGreaterThan(0);
    const offenders = lines.flatMap(offendingClauses);
    expect(offenders, `贡献指南把 warn 说成了阻断：\n${offenders.join("\n")}`).toEqual([]);
    // 对照：旧写法把性能与可访问性并排写进同一句，性能那一类就成了假的阻断承诺
    expect(
      offendingClauses("| `npm run lhci` | Lighthouse CI 性能与可访问性预算 |").length,
      "旧写法过不了判据，上面那条是空转",
    ).toBeGreaterThan(0);
  });

  it("「失败阻断合并」那节的标题给 warn 留了出口", () => {
    expect(ops.split("\n")[8], "标题又变回无条件的「失败阻断合并」").toMatch(/warn|除非/);
  });
});
