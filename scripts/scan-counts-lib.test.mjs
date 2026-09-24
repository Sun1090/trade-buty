import { describe, expect, it } from "vitest";
import {
  diffScanCounts,
  parseScanCountsReport,
  parseScanRows,
  renderScanCounts,
} from "./scan-counts-lib.mjs";

const ROWS = [
  { key: "secrets-listed-files", count: 787, floor: 700, what: "git 列出的待扫文件" },
  { key: "api-route-files", count: 12, floor: 11, what: "route.ts 接口文件" },
];

describe("parseScanRows（R16.146 登记行的读入）", () => {
  it("一行一条，读得出来的就是 recordScanCount 写出去的那四个字段", () => {
    const text = ROWS.map((row) => JSON.stringify(row)).join("\n");
    expect(parseScanRows(text)).toEqual(ROWS);
  });

  it("坏 JSON 抛错而不是跳过：静默丢一行等于台账悄悄少一个登记点", () => {
    const good = JSON.stringify(ROWS[0]);
    expect(() => parseScanRows(`${good}\n{not json`)).toThrow(/不是 JSON/);
    expect(() => parseScanRows(`${good}\n${JSON.stringify({ key: "有大写 K", count: 1, floor: 1, what: "x" })}`)).toThrow(
      /键不合法/,
    );
    expect(() => parseScanRows(`${good}\n${JSON.stringify({ key: "ok", count: 1.5, floor: 1, what: "x" })}`)).toThrow(
      /不是非负整数/,
    );
  });

  it("同一个键登记两次、数还不一样，也抛：那说明有一处口径变了", () => {
    const dup = [
      JSON.stringify({ key: "kb-md-files", count: 419, floor: 400, what: "知识库 md 文件" }),
      JSON.stringify({ key: "kb-md-files", count: 400, floor: 400, what: "知识库 md 文件" }),
    ].join("\n");
    expect(() => parseScanRows(dup)).toThrow(/同一个键只能有一个口径/);
    // 两次一模一样：只是重复统计，不影响基线，留一条不抛的对照，免得规则把没事的也拦了
    expect(parseScanRows(`${dup.split("\n")[0]}\n${dup.split("\n")[0]}`)).toHaveLength(2);
  });

  it("空输入读出零行（真正的「一行都没有」由聚合器的地板判红，不在这里假装通过）", () => {
    expect(parseScanRows("")).toEqual([]);
  });
});

describe("renderScanCounts / parseScanCountsReport 往返", () => {
  it("写出去的行读回来逐字段相等，且按键排序、没有日期", () => {
    const md = renderScanCounts(ROWS);
    const parsed = parseScanCountsReport(md);
    expect([...parsed.keys()]).toEqual(["api-route-files", "secrets-listed-files"]);
    expect(parsed.get("secrets-listed-files")).toEqual({
      count: 787,
      floor: 700,
      what: "git 列出的待扫文件",
    });
    // 幂等通道的前提：同样的内容不随时间变
    expect(renderScanCounts([...ROWS].reverse())).toBe(md);
    expect(md).not.toMatch(/20\d\d-\d\d-\d\d/);
  });

  it("表头与分隔行不会被当成数据行", () => {
    const md = renderScanCounts(ROWS);
    expect(parseScanCountsReport(md).size).toBe(2);
    expect(parseScanCountsReport("")).toEqual(new Map());
  });

  it("手改坏的一行读不出来，而不是读成 0", () => {
    const md = renderScanCounts(ROWS).replace("| api-route-files | 12 |", "| api-route-files |  |");
    expect(parseScanCountsReport(md).has("api-route-files")).toBe(false);
  });
});

describe("diffScanCounts（少扫就是红）", () => {
  const baseline = parseScanCountsReport(renderScanCounts(ROWS));

  it("数量变小记进 shrinks，两个数都带上", () => {
    const { shrinks } = diffScanCounts({
      rows: [{ ...ROWS[0], count: 786 }],
      baseline: parseScanCountsReport(renderScanCounts([{ ...ROWS[0], count: 787 }])),
    });
    expect(shrinks).toHaveLength(1);
    expect(shrinks[0]).toMatchObject({ key: "secrets-listed-files", count: 786, baseline: 787 });
  });

  it("数量不变或变大都不算缩小（多扫永远不需要人认账）", () => {
    expect(diffScanCounts({ rows: ROWS, baseline }).shrinks).toEqual([]);
    expect(diffScanCounts({ rows: ROWS.map((r) => ({ ...r, count: r.count + 9 })), baseline }).shrinks).toEqual([]);
  });

  it("台账里没有的键与台账里有、这次没登记到的键，分开报", () => {
    const { unknownKeys, missingKeys } = diffScanCounts({
      rows: [{ key: "brand-new-scan", count: 3, floor: 1, what: "新登记点" }, ROWS[0]],
      baseline,
    });
    expect(unknownKeys).toEqual(["brand-new-scan"]);
    expect(missingKeys).toEqual(["api-route-files"]);
  });

  it("正向对照：基线为空（第一次跑）时三条都不响，否则新仓库第一天就红", () => {
    const first = diffScanCounts({ rows: ROWS, baseline: new Map() });
    expect(first).toEqual({ shrinks: [], unknownKeys: [], missingKeys: [] });
  });
});
