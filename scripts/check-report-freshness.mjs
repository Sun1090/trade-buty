#!/usr/bin/env node
/**
 * R16.26：重算型报告新鲜度核对。
 *
 * 跑完所有报告生成步骤之后执行。本脚本**不重算**，它比对的是工作区与 HEAD：生成步骤
 * 跑完后还有文件被改写，就说明入库版本是过期的；另一种是根本没提交的新报告。
 * 单独跑它（生成步骤没跑）只能证明「没人碰过这些文件」，不能证明台账是新的——
 * CI 里它排在全部巡检步骤之后，本地得自己先把 producers 跑一遍。
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
  collectReportProducers,
  renderFreshnessFailure,
  SELF_REPORT_FILES,
  shouldFailFreshness,
} from "./report-freshness-lib.mjs";

const root = process.cwd();
/**
 * 巡检器自己的用例与本体不参与推导：夹具里含有被检查的写法。
 * 这份集合住在 `report-freshness-lib.mjs`（`SELF_REPORT_FILES`），与文档门禁共用同一推导——
 * 两边各写一份排除名单，就是下一处会漂移的说法。
 */
const SELF_FILES = SELF_REPORT_FILES;
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
const producers = collectReportProducers(sources);
/** 巡检器文件名 → 它的 npm 脚本名，让失败信息直接说去哪儿重算。 */
const commands = {};
for (const [name, command] of Object.entries(
  JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf-8")).scripts ?? {},
)) {
  const match = /scripts\/([\w.-]+\.mjs)/.exec(String(command));
  if (match && !commands[match[1]]) commands[match[1]] = name;
}
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
  `[report-freshness] 幂等通道推导出 ${inventory.length} 份报告 · 工作区漂移 ${stale.length} · 未提交 ${untracked.length}`
);
console.log(
  `[report-freshness] 判据是「工作区 vs HEAD」：这一行不重算任何报告，生成步骤没跑过时，漂移 0 只说明没人碰过文件（CI 里它排在全部巡检之后，本地要自己先跑）`,
);

if (reason) {
  console.error(
    renderFreshnessFailure({
      reason,
      inventory,
      stale,
      untracked,
      minReports: MIN_REPORTS,
      producers,
      commands,
    })
  );
  process.exit(1);
}
