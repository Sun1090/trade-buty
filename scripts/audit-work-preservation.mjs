#!/usr/bin/env node
/**
 * R14.4：工作保全审计（人工 / 代理运行，不进 CI）。
 *
 * 回答两个只能从本地仓库看清的问题：
 *   1. 有没有提交从未推送到任何远端（受保护分支上「先提交本地 main」最容易踩）；
 *   2. 有没有 PR 被关掉而工作去向从未被确认（删除 head 分支会让 GitHub 自动关 PR）。
 * CI 看不到其它会话的本地仓库，所以这是运维脚本而不是门禁。
 *
 * 用法：npm run ops:work-audit
 * 退出码：发现未推送提交或未确认的关闭 PR → 1；gh 不可用时只跳过 PR 部分。
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  countUnlandedPatches,
  findUnconfirmedClosedPullRequests,
  isCommitLanded,
  isValidAcknowledgement,
  parseUnpushedCommits,
  renderWorkAuditReport,
} from "./work-audit-lib.mjs";

const root = process.cwd();
const ackPath = path.join(root, "docs/work-audit-ack.json");
const WINDOW_DAYS = 30;

function runGit(args) {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8" });
  } catch {
    return null;
  }
}

const logOutput = runGit([
  "log",
  "--branches",
  "--not",
  "--remotes",
  "--format=%H%x09%D%x09%s",
]);
if (logOutput === null) {
  console.error("[work-audit] ❌ 无法读取 git 历史（请在仓库工作区内运行）");
  process.exit(1);
}
const unpushedAll = parseUnpushedCommits(logOutput);
// rebase 合并会改写 SHA：内容已在 main 的本地提交属陈旧分支遗留，不算悬空工作。
const strandedCommits = [];
const staleCommits = [];
for (const commit of unpushedAll) {
  const cherry = runGit(["cherry", "origin/main", commit.sha]);
  if (cherry !== null && isCommitLanded(cherry, commit.sha)) staleCommits.push(commit);
  else strandedCommits.push(commit);
}

let acknowledged = [];
if (fs.existsSync(ackPath)) {
  const parsed = JSON.parse(fs.readFileSync(ackPath, "utf8"));
  const entries = Array.isArray(parsed?.acknowledged) ? parsed.acknowledged : [];
  acknowledged = entries.filter(isValidAcknowledgement);
  const dropped = entries.length - acknowledged.length;
  if (dropped > 0) {
    console.error(`[work-audit] ❌ ${path.relative(root, ackPath)} 有 ${dropped} 条缺少 PR 编号或理由`);
    process.exit(1);
  }
}

let ghSkipped = false;
let ghNote = "";
let closedPulls = [];
try {
  // 只取需要的字段：原始 pulls 响应会超出 execFileSync 的默认缓冲（ENOBUFS）。
  const raw = execFileSync(
    "gh",
    [
      "api",
      "repos/{owner}/{repo}/pulls?state=closed&sort=updated&direction=desc&per_page=80",
      "--jq",
      "[.[] | {number, title, state, merged_at, updated_at, head_sha: .head.sha, head_ref: .head.ref}]",
    ],
    {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    }
  );
  const cutoff = Date.now() - WINDOW_DAYS * 24 * 3600 * 1000;
  closedPulls = JSON.parse(raw)
    .filter(
      (pr) =>
        String(pr.state ?? "").toUpperCase() === "CLOSED" &&
        !pr.merged_at &&
        Date.parse(pr.updated_at ?? "") >= cutoff
    )
    .map((pr) => {
      const sha = pr.head_sha;
      const base = sha ? runGit(["merge-base", "origin/main", sha]) : null;
      const cherry = base ? runGit(["cherry", "origin/main", sha, base.trim()]) : null;
      return {
        number: pr.number,
        title: pr.title,
        state: pr.state,
        mergedAt: pr.merged_at,
        headRefOid: sha,
        headRefName: pr.head_ref,
        unlandedPatches: cherry === null ? null : countUnlandedPatches(cherry),
      };
    });
} catch (error) {
  ghSkipped = true;
  ghNote = `（跳过 PR 检查：${String(error?.message ?? error).split("\n")[0].slice(0, 120)}）`;
}

const unconfirmed = findUnconfirmedClosedPullRequests(closedPulls, acknowledged);
console.log(
  `[work-audit] 悬空提交 ${strandedCommits.length} · 陈旧本地提交 ${staleCommits.length} · 未确认的关闭 PR ${unconfirmed.length}${ghNote}`
);
console.log(
  renderWorkAuditReport({
    unpushed: strandedCommits,
    stale: staleCommits,
    unconfirmed,
    ghSkipped,
  })
);

process.exit(strandedCommits.length > 0 || unconfirmed.length > 0 ? 1 : 0);
