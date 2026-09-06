#!/usr/bin/env node
/**
 * R10.18：知识库上游版本指针门禁（CI + 本地共用）。
 *
 * 核对三处版本视图一致（详见 kb-pointer-lib.mjs）：
 *   1. git 记录的 submodule 指针（content/kline-buty gitlink）；
 *   2. 工作区实际检出的 submodule HEAD；
 *   3. scripts/kb-manifest.json 里 `pointer` 字段（kb:diff --update 刷新写入）。
 *
 * 只读不写。用法：npm run check:kb-pointer
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  checkRecordedVsWorking,
  checkSnapshotSync,
  shortSha,
} from "./kb-pointer-lib.mjs";

const root = process.cwd();
const SUB = "content/kline-buty";
const subAbs = path.join(root, SUB);
const manifestPath = path.join(root, "scripts/kb-manifest.json");

function git(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

// 1) 仓库记录的 submodule 指针（gitlink，mode 160000 行）
let recorded = "";
try {
  const line = git(["ls-files", "-s", "--", SUB], root);
  const hit = line
    .split("\n")
    .map((l) => l.trim().split(/\s+/))
    .find((t) => t[0] === "160000");
  recorded = hit ? hit[1] : "";
} catch {
  recorded = "";
}

const problems = [];
const notes = [];

if (!recorded) {
  problems.push(
    `submodule ${SUB} 未在 git 索引登记（gitlink 缺失）。请用 git submodule add 重新登记。`,
  );
} else {
  notes.push(`仓库记录指针    : ${shortSha(recorded)}`);
}

// 2) 工作区实际检出的 submodule HEAD
let working = "";
if (fs.existsSync(subAbs)) {
  try {
    working = git(["rev-parse", "HEAD"], subAbs);
  } catch {
    working = "";
  }
}
if (!working) {
  problems.push(
    `submodule 内容缺失或未初始化（${SUB}）。请先运行 git submodule update --init。`,
  );
} else {
  notes.push(`工作区 submodule: ${shortSha(working)}`);
}

// 3) kb-manifest.json 快照记录的上游版本
let snapshotPointer = "";
let snapshotLabel = "（未找到 kb-manifest.json）";
if (fs.existsSync(manifestPath)) {
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    snapshotPointer = manifest.pointer ?? "";
    snapshotLabel = snapshotPointer
      ? shortSha(snapshotPointer)
      : "（旧版快照，无 pointer 字段）";
  } catch {
    problems.push("scripts/kb-manifest.json 无法解析（JSON 损坏）。");
  }
}
notes.push(`kb-manifest 快照 : ${snapshotLabel}`);

if (recorded && working) {
  const drift = checkRecordedVsWorking({ recorded, working });
  if (drift) problems.push(drift.message);
}
if (recorded) {
  const stale = checkSnapshotSync({ recorded, snapshotPointer });
  if (stale) problems.push(stale.message);
}

console.log(`# 知识库上游版本指针（R10.18）`);
for (const n of notes) console.log(`- ${n}`);

if (problems.length > 0) {
  console.error(`❌ 版本指针检查失败：${problems.length} 个问题`);
  for (const p of problems) console.error(`  - ${p}`);
  console.error(
    "处理：跑 npm run kb:update 完整同步，并把 content/kline-buty 指针、" +
      "scripts/kb-manifest.json（及 changelog 草稿）一起提交；指针与快照必须同 commit。",
  );
  process.exit(1);
}
console.log(
  `✅ 版本指针一致：仓库记录 = 工作区 = 快照（${shortSha(recorded)}）`,
);
