/**
 * R16.321：「实测列 vs 产物」那半判据的纯函数用例。
 *
 * 这一族判据此前住在 `perf-notes-claims.test.mjs` 里，而它在 CI 里**从来没执行过**——
 * CI 把 `test:coverage` 排在 `build` 之前，那条判据必然走「缺产物 → 跳过」分支。
 * 现在判据搬进 `check:bundle`（build 之后，产物现成），本文件测的是**搬过去的那段逻辑本身**，
 * 全部不依赖 `.next`，所以在 CI 里真跑得起来。
 *
 * 运行：`npx vitest run scripts/perf-readings.test.mjs`
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  FINGERPRINT_CLAIM,
  checkPerfReadings,
  groupMaxima,
  parseCurrentTable,
} from "./perf-readings.mjs";
import { deflateFingerprint, fingerprintId } from "./deflate-fingerprint.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const doc = readFileSync(path.join(root, "docs/perf-notes.md"), "utf8");
const manifest = JSON.parse(readFileSync(path.join(root, "scripts/bundle-budgets.json"), "utf8"));
const budgets = manifest.budgets;
const formatKB = (bytes) => (bytes / 1024).toFixed(1);

const HERE = fingerprintId(deflateFingerprint((b) => zlib.gzipSync(b)));
const ELSEWHERE = "000000000000";

/** 大块探针的输出至少要这么大，否则说明那条探针没真的压够量级 */
const BIG_PROBE_MIN_BYTES = 100_000;

/** 造一份「表 + 与表一致的读数」的最小夹具 */
function fixture({ rows, fingerprint = HERE, ids } = {}) {
  const tableRows =
    rows ??
    budgets.map((b) => `| ${b.id} | 300.0 KB | ${b.maxGzipKB.total} KB | \`zh/${b.id}\` |`).join("\n");
  const docText = [
    "### 复测（测试夹具）",
    "",
    "| 分组 | 今天最大 total | 预算 | 最大路由 |",
    "|---|---:|---:|---|",
    tableRows,
    "",
    `${FINGERPRINT_CLAIM}\`${fingerprint}\``,
  ].join("\n");
  const listIds = ids ?? budgets.map((b) => b.id);
  const measurements = listIds.map((id) => ({
    route: `zh/${id}`,
    metrics: { total: 300.0 * 1024 },
    budget: budgets.find((b) => b.id === id),
  }));
  return { docText, measurements };
}

const run = (over = {}) =>
  checkPerfReadings({
    doc: doc,
    measurements: [],
    budgets,
    formatKB,
    currentFingerprintId: HERE,
    ...over,
  });

describe("真实文档：最新那张表带着可判的指纹登记", () => {
  it("表还在、行够多、且分组名都在清单里（扫描缩水即红）", () => {
    const { rows, headingCount } = parseCurrentTable(doc);
    expect(headingCount, "文档里一张复测表都没有了？").toBeGreaterThanOrEqual(1);
    expect(rows.size, "最新那张表只解析出个位数行——行形状变了比对会空转").toBeGreaterThanOrEqual(13);
    for (const name of rows.keys()) {
      expect(budgets.some((b) => b.id === name), `表里有个清单里没有的分组：${name}`).toBe(true);
    }
  });

  it("最新那张表登记了一个形状合法的环境指纹", () => {
    const { fingerprint } = parseCurrentTable(doc);
    expect(fingerprint, `${FINGERPRINT_CLAIM} 那一行没找到或没带十六进制 id`).toBeTruthy();
    expect(fingerprint, "登记的指纹不是 12 位十六进制——判据读不出它来自哪把尺").toMatch(/^[0-9a-f]{12}$/);
    // **这里刻意不钉「等于本机当场量的那一个」**：单元测试在 CI 里跑在 linux 上，
    // 而这张表由 darwin 录，那条断言在 CI 上必然红。「这台机器能不能判」是
    // `check:bundle`（build 之后）那半的职责，它有跳过分支并且会把两边指纹印出来。
    // 本文件只钉「登记了、形状对、且由行为算得出」这三件与环境无关的事。
  });

  it("指纹由行为算出，不受版本号字符串误导（登记时那条捷径已被实测否掉）", () => {
    // 同一份指纹串在任何机器上都算出同一个 id：id 是纯函数，不掺时间、不掺路径。
    const fp = deflateFingerprint((b) => zlib.gzipSync(b));
    expect(fingerprintId(fp)).toBe(fingerprintId(fp));
    expect(fp.split(" ")).toHaveLength(10);
    const sizes = fp
      .split(" ")
      .filter((p) => p.startsWith("jsish-"))
      .map((p) => Number(p.split("=")[1]));
    expect(sizes.length, "少了大块输入那条探针——指纹分不开真实产物量级的差异").toBeGreaterThanOrEqual(2);
    expect(Math.max(...sizes), "大块探针的输出长度小得可疑，像是没真的压").toBeGreaterThan(
      BIG_PROBE_MIN_BYTES,
    );
  });
});

describe("判据本身：三种结局各说各的话", () => {
  it("指纹一致 + 读数一致 → 不报，且明说判过了几组", () => {
    const { docText, measurements } = fixture();
    const out = run({ doc: docText, measurements });
    expect(out.issues).toEqual([]);
    expect(out.skipped).toBe(false);
    expect(out.notes.join("\n")).toMatch(/✓ 实测列与当场重算逐字一致/);
  });

  it("指纹不符 → 明说跳过并印出两边指纹，且**不**读成一致", () => {
    // 把读数故意改成全错：如果跳过没生效，下面那条 issues 就不会是空。
    const bad = fixture({ fingerprint: ELSEWHERE }).measurements.map((m) => ({
      ...m,
      metrics: { total: 1 * 1024 },
    }));
    const { docText } = fixture({ fingerprint: ELSEWHERE });
    const out = run({ doc: docText, measurements: bad });
    expect(out.skipped, "环境不符却仍然判了——跨环境逐字比对必然假红").toBe(true);
    expect(out.issues, "跳过的时候不许顺手报读数不一致").toEqual([]);
    const note = out.notes.join("\n");
    expect(note).toContain(ELSEWHERE);
    expect(note).toContain(HERE);
    expect(note).toMatch(/跳过/);
  });

  it("表里没登记指纹 → 红，而不是静默按「能判」处理", () => {
    const { docText, measurements } = fixture();
    const noClaim = docText
      .split("\n")
      .filter((line) => !line.startsWith(FINGERPRINT_CLAIM))
      .join("\n");
    const out = run({ doc: noClaim, measurements });
    expect(out.skipped, "没有指纹就无从判断这台机器能不能判，不许当成跳过放过").toBe(false);
    expect(out.issues.join("\n")).toMatch(/记录环境指纹/);
  });

  it("读数漂了要点名两个数，并带上字节（档界余量比 0.1KB 小得多时，只有字节说得清）", () => {
    const { docText, measurements } = fixture();
    const drifted = measurements.map((m) =>
      m.budget.id === "home" ? { ...m, metrics: { total: 299.0 * 1024 } } : m,
    );
    const out = run({ doc: docText, measurements: drifted });
    expect(out.issues).toHaveLength(1);
    expect(out.issues[0]).toMatch(/home：最大 total 表 300KB \/ 实测 299KB/);
    expect(out.issues[0], "报错要带字节，否则分不清是真回归还是产物在档界上抖").toMatch(/306176 字节/);
  });

  it("最大路由换了也要红", () => {
    const { docText, measurements } = fixture();
    const moved = measurements.map((m) => (m.budget.id === "home" ? { ...m, route: "zh/other" } : m));
    const out = run({ doc: docText, measurements: moved });
    expect(out.issues.join("\n")).toMatch(/home：最大路由 表 zh\/home \/ 实测 zh\/other/);
  });

  it("表里列着某组、产物里量不到 → 红（不许当成「那组不存在所以不用判」）", () => {
    const { docText, measurements } = fixture({ ids: budgets.slice(1).map((b) => b.id) });
    const out = run({ doc: docText, measurements });
    expect(out.issues.join("\n")).toMatch(/home：表里列着，产物里量不到这一组/);
  });

  it("整表被删 → 红，而不是空转", () => {
    const out = run({ doc: "# 空的\n正文里一张表都没有\n", measurements: [] });
    expect(out.issues.join("\n")).toMatch(/一张复测表都没有/);
  });

  it("行数缩水 → 红（判据不能因为扫不到东西就宣布通过）", () => {
    const rows = budgets
      .slice(0, 3)
      .map((b) => `| ${b.id} | 300.0 KB | ${b.maxGzipKB.total} KB | \`zh/${b.id}\` |`)
      .join("\n");
    const { measurements } = fixture({ rows });
    const out = run({ doc: fixture({ rows }).docText, measurements });
    expect(out.issues.join("\n")).toMatch(/只解析出 3 行/);
  });
});

describe("口径：与文档那张表同一把尺", () => {
  it("`static-info` 那组排除 /changelog（它的读数由 git 历史决定，见 R16.308）", () => {
    const si = budgets.find((b) => b.id === "static-info");
    const measurements = [
      { route: "zh/about", metrics: { total: 200 * 1024 }, budget: si },
      { route: "zh/changelog", metrics: { total: 900 * 1024 }, budget: si },
    ];
    const got = groupMaxima({ measurements, budgets: [si], formatKB });
    expect(got.get("static-info").maxRoute, "最大路由被 /changelog 抢走了——两处口径不同，表永远对不上").toBe(
      "zh/about",
    );
    // maxTotalKB 是 Number(formatKB(...))：与文档那张表比的是同一个数值形状
    expect(got.get("static-info").maxTotalKB).toBe(200);
  });

  it("组内取的是最大 total，不是最后一条", () => {
    const si = budgets.find((b) => b.id === "static-info");
    const got = groupMaxima({
      measurements: [
        { route: "zh/a", metrics: { total: 300 * 1024 }, budget: si },
        { route: "zh/b", metrics: { total: 250 * 1024 }, budget: si },
      ],
      budgets: [si],
      formatKB,
    });
    expect(got.get("static-info").maxRoute).toBe("zh/a");
  });
});

describe("接线：判据必须真的被 build 之后的那道门禁调用", () => {
  const src = readFileSync(path.join(root, "scripts/check-bundle.mjs"), "utf8");

  it("check-bundle 导入了它，并现量当场指纹（不许抄一个常数）", () => {
    expect(src).toContain("checkPerfReadings");
    expect(src).toMatch(/fingerprintId\(deflateFingerprint\(/);
  });

  it("结果进了 fail 判定，而且排在 build 之后（这是本轮的题眼）", () => {
    // 只钉「有个 fail 会 exit(1)」是不够的：R16.311 那条探针证明摘掉结果照样能 exit 0。
    expect(src).toMatch(/readings\.issues\.length > 0\)\s*fail = true/);
    expect(src).toMatch(/for \(const issue of readings\.issues\)/);
    // 顺序：check-bundle 本身由 CI 排在 build 之后调用，这里钉它没有偷偷 import 一份「自己构建」的口子
    expect(src, "门禁不该自己去跑构建").not.toMatch(/next build/);
  });

  it("跳过要印出来，不许静默（今天的病就是一场静默的不判）", () => {
    expect(src).toMatch(/for \(const note of readings\.notes\)/);
  });

  it("量尺寸的地方真的脱了敏，并且当场核这个前提（R16.314 的规矩不许退化成恒等式）", () => {
    // 原来这条住在单元测试里，钉的是「两处调用点都脱敏」。现在只剩一处
    // （`perf-notes-claims` 那半搬走了），而「前提仍然成立」那半从一条用例
    // 变成了门禁自己印的一行——它必须在**真的量过产物**的地方核，而不是在 CI 里必然跳过。
    expect(src).toContain("neutralizeBuildId");
    expect(
      /neutralizeBuildId\([\s\S]{0,400}?html,/.test(src),
      "脱了敏却没把脱敏后的 HTML 交给 measureRoute：那条门是死的",
    ).toBe(true);
    expect(src, "把未脱敏的原文直接递给了 measureRoute").not.toMatch(/html:\s*raw\b/);
    expect(src, "不再从产物读构建号：拿一个常数去替换等于不替换").toMatch(/readBuildId/);
    // 前提核对要有牙：一处都没替换到就得 fail，不能只印一行
    expect(src).toMatch(/buildIdHits === 0/);
    expect(src).toMatch(/replaced/);
  });
});
