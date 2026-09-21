/**
 * 工作保全审计的纯判定部分（R14.4）。
 *
 * 成因（真实事故）：`origin/main` 受保护，一批工作被提交到本地 `main` 却从未推送；
 * 同时几个 PR 的 `codex/*` head 分支被清理后 GitHub 自动关闭了 PR，那些提交既不在
 * `main` 也不在任何远端分支上。结果是 19 个提交加 4 个 PR 的工作只在本地存活了
 * 将近一天，靠人工比对才发现（回收为 PR #105）。
 *
 * 判定口径必须适配本仓库的合并方式：全部走 rebase 合并，PR 的原始 head SHA
 * **注定不会**出现在 `main` 上，即使工作已经落地。因此「SHA 不是 main 祖先」
 * 不能当作工作丢失的证据，只能当作「需要人工确认」的线索；确认结果记入台账。
 *
 * 这里只放可单测的纯函数；git / gh 的读取在 `audit-work-preservation.mjs`。
 */

/**
 * 规范化 `git log %D` 的 ref 装饰，只留本地分支名。
 * 例：`HEAD -> feat/x, origin/feat/x, tag: v1` → `feat/x`。
 */
export function parseRefs(decoration) {
  return String(decoration ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => (entry.includes("-> ") ? entry.split("-> ")[1].trim() : entry))
    .filter(
      (entry) => entry && entry !== "HEAD" && !entry.startsWith("origin/") && !entry.startsWith("tag:")
    )
    .join(", ");
}

/** 解析 `git log --format=%H%x09%D%x09%s` 的「本地有、远端没有」输出。 */
export function parseUnpushedCommits(output) {
  return String(output ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [sha, refs, ...subject] = line.split("\t");
      return { sha, refs: parseRefs(refs), subject: subject.join("\t") };
    })
    .filter((commit) => commit.sha);
}

/** 解析 `git cherry` 输出，返回 main 上找不到对应补丁的提交数。 */
export function countUnlandedPatches(cherryOutput) {
  return String(cherryOutput ?? "")
    .split("\n")
    .filter((line) => line.trimStart().startsWith("+")).length;
}

/**
 * 单个提交的内容补丁是否已在 upstream。
 *
 * `git cherry <upstream> <sha>` 会列出该提交相对 upstream 的补丁，前缀 `-` 表示
 * upstream 已有等价补丁。rebase 合并必然改写 SHA，所以只有这个判定能把
 * 「已落地但 SHA 不同」的本地遗留分支与真正悬空的工作区分开。
 */
export function isCommitLanded(cherryOutput, sha) {
  for (const line of String(cherryOutput ?? "").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.includes(sha)) continue;
    return trimmed.startsWith("-");
  }
  return false;
}

/**
 * 挑出需要确认的已关闭 PR：closed、未合并、且不在确认台账里。
 *
 * 注意大小写：REST `pulls` 列表返回 `"state": "closed"`，GraphQL 才是 `CLOSED`。
 * 判定一律先转大写，否则会静默得到 0 个候选——审计工具最坏的失效方式。
 *
 * @param prs PR 列表
 * @param acknowledged {{number: number, reason: string}[]}
 */
export function findUnconfirmedClosedPullRequests(prs, acknowledged = []) {
  const acked = new Set(
    (Array.isArray(acknowledged) ? acknowledged : [])
      .map((entry) => Number(entry?.number))
      .filter(Number.isFinite)
  );
  return (Array.isArray(prs) ? prs : [])
    .filter(
      (pr) =>
        pr &&
        String(pr.state ?? "").toUpperCase() === "CLOSED" &&
        !pr.mergedAt &&
        !acked.has(Number(pr.number))
    )
    .map((pr) => ({
      number: pr.number,
      title: pr.title,
      branch: pr.headRefName,
      sha: pr.headRefOid,
      unlandedPatches: Number.isFinite(pr.unlandedPatches) ? pr.unlandedPatches : null,
    }));
}

/** 台账条目是否仍然有效：必须带 PR 编号与理由。 */
export function isValidAcknowledgement(entry) {
  return (
    !!entry &&
    Number.isFinite(Number(entry.number)) &&
    typeof entry.reason === "string" &&
    entry.reason.trim().length > 0
  );
}

/** 汇总成人读文本。 */
export function renderWorkAuditReport({ unpushed, stale, unconfirmed, ghSkipped }) {
  const lines = [];
  const commits = Array.isArray(unpushed) ? unpushed : [];
  const leftover = Array.isArray(stale) ? stale : [];
  const pulls = Array.isArray(unconfirmed) ? unconfirmed : [];

  if (commits.length === 0 && pulls.length === 0 && leftover.length === 0) {
    return `没有发现悬空工作${ghSkipped ? "（未能访问 GitHub，仅审计本地提交）" : "：本地提交都已进入远端，关闭未合并的 PR 都已确认。"}`;
  }

  if (commits.length > 0) {
    lines.push(`❌ 本地存在 ${commits.length} 个内容从未进入 main 的提交：`);
    for (const commit of commits) {
      lines.push(
        `  - ${commit.sha.slice(0, 7)}${commit.refs ? ` (${commit.refs})` : ""} ${commit.subject}`
      );
    }
    lines.push("  → 受保护分支不能直推：为这些提交开 topic 分支并提 PR，别留在本地。");
  }
  if (leftover.length > 0) {
    lines.push(`ℹ️ ${leftover.length} 个本地提交的内容已在 main 上（rebase 合并改写了 SHA），对应本地分支属陈旧遗留：`);
    for (const commit of leftover) {
      lines.push(
        `  - ${commit.sha.slice(0, 7)}${commit.refs ? ` (${commit.refs})` : ""} ${commit.subject}`
      );
    }
    lines.push("  → 确认分支无未合并内容后删除本地分支，避免下次误判为悬空工作。");
  }
  if (pulls.length > 0) {
    lines.push(`⚠️ 有 ${pulls.length} 个 PR 已关闭但未合并，且尚未有人确认工作去向：`);
    for (const pr of pulls) {
      const patches =
        pr.unlandedPatches === null
          ? "补丁数未知"
          : `main 上找不到对应补丁的提交 ${pr.unlandedPatches} 个`;
      lines.push(`  - #${pr.number} ${pr.title} (${pr.branch} @ ${String(pr.sha).slice(0, 7)}，${patches})`);
    }
    lines.push(
      "  → rebase 合并本就会改写 SHA，所以这不是「一定丢了」；逐条确认：需要则重放到新分支，不需要则在 docs/work-audit-ack.json 记下理由。"
    );
  }
  return lines.join("\n");
}
