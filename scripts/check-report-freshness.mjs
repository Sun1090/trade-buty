#!/usr/bin/env node
/**
 * R16.26：重算型报告新鲜度核对。
 *
 * 跑完所有报告生成步骤之后执行：入库的 `docs/*` 报告必须与当场重算的结果一致。
 * 不一致有两种——门禁把文件改写了（入库版本过期），或新报告根本没提交。
 *
 * 用法：npm run check:report-freshness（CI 里排在全部报告步骤之后）
 * 退出码：有不一致或推导出的报告数低于下限 → 1。
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  assessFreshness,
  collectReportInventory,
  renderFreshnessFailure,
  shouldFailFreshness,
} from "./report-freshness-lib.mjs";

const root = process.cwd();
/** 巡检器自己的用例与本体不参与推导：夹具里含有被检查的写法。 */
const SELF_FILES = new Set([
  "report-freshness-lib.mjs",
  "report-freshness-lib.test.mjs",
  "check-report-freshness.mjs",
]);
/** 推导出的报告数低于下限即判巡检器自己失效，而不是「零份要核对」的假绿。 */
const MIN_REPORTS = 15;

const sources = fs
  .readdirSync(path.join(root, "scripts"))
  .filter((file) => file.endsWith(".mjs") && !SELF_FILES.has(file))
  .map((file) => ({
    file,
    source: fs.readFileSync(path.join(root, "scripts", file), "utf8"),
  }));

const inventory = collectReportInventory(sources);
const git = (args) =>
  execFileSync("git", args, { cwd: root, encoding: "utf-8" });
const statusOutput = inventory.length
  ? git(["status", "--porcelain", "--untracked-files=all", "--", ...inventory])
  : "";
const tracked = inventory.length
  ? git(["ls-files", "--", ...inventory]).split("\n").filter(Boolean)
  : [];

const { stale, untracked } = assessFreshness({ inventory, statusOutput, tracked });
const reason = shouldFailFreshness({ inventory, stale, untracked, minReports: MIN_REPORTS });

console.log(
  `[report-freshness] 幂等通道推导出 ${inventory.length} 份报告 · 过期 ${stale.length} · 未提交 ${untracked.length}`
);

if (reason) {
  console.error(
    renderFreshnessFailure({ reason, inventory, stale, untracked, minReports: MIN_REPORTS })
  );
  process.exit(1);
}
