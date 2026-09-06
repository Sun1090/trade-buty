/**
 * R10.18 上游知识库版本指针纯函数库。
 *
 * 「上游版本」= kline-buty submodule 的 commit。本仓库里存在三处版本视图：
 *   1. recorded  —— git 记录的 submodule 指针（gitlink，随仓库提交）；
 *   2. working   —— 工作区实际检出的 submodule HEAD；
 *   3. snapshot  —— scripts/kb-manifest.json 里 `pointer` 字段记录的版本
 *                   （kb:diff --update 刷新内容 hash 快照时一并写入）。
 *
 * 不变量：三者应保持一致。
 *   - recorded ≠ working：本地有人跑过 `git submodule update --remote` 但没提交
 *     指针 → 本地构建用的是新版、CI（recursive checkout）用的是旧版，静默分叉。
 *   - recorded ≠ snapshot：指针已提交但 kb-manifest.json 没同步刷新 → 内容
 *     hash 基线过期，changelog/审计全在拿旧基线对不上的内容。
 */

/** @param {string|undefined} sha @param {number} len @returns {string} 取 commit 短号（默认 7 位，输入更短则原样返回）。 */
export function shortSha(sha, len = 7) {
  const s = String(sha || "").trim();
  return s ? s.slice(0, Math.min(len, s.length)) : "";
}

/** @param {string|undefined} sha @returns {boolean} 是否形如完整 git sha（40 位十六进制）。 */
export function isFullSha(sha) {
  return /^[0-9a-f]{40}$/.test(String(sha || "").trim());
}

/**
 * 检出漂移检查：仓库记录指针 vs 工作区实际 HEAD。
 * 返回 null（一致）或 { kind, message }。
 */
export function checkRecordedVsWorking({ recorded, working }) {
  const r = String(recorded || "").trim();
  const w = String(working || "").trim();
  if (!r || !w) {
    return {
      kind: "unresolved",
      message: `无法取得版本：recorded=${r || "(空)"} working=${w || "(空)"}`,
    };
  }
  if (r === w) return null;
  return {
    kind: "drift",
    message:
      `仓库记录指针 ${shortSha(r)} ≠ 工作区子模块 HEAD ${shortSha(w)}。` +
      `本地内容领先于仓库记录版本；请跑 npm run kb:update 并连同 ` +
      `content/kline-buty 指针与 scripts/kb-manifest.json 一起提交。`,
  };
}

/**
 * 快照同步检查：仓库记录指针 vs kb-manifest.json 的 pointer 字段。
 * snapshotPointer 缺省 / 为空视为旧版快照 → 需刷新（返回 stale）。
 * 返回 null（一致）或 { kind, message }。
 */
export function checkSnapshotSync({ recorded, snapshotPointer }) {
  const r = String(recorded || "").trim();
  const sp = String(snapshotPointer || "").trim();
  if (!r) {
    return {
      kind: "unresolved",
      message: "仓库未记录 submodule 指针，无法核对快照。",
    };
  }
  if (!sp) {
    return {
      kind: "snapshot-stale",
      message:
        "kb-manifest.json 未记录上游版本（旧版快照）。请跑 npm run kb:diff 刷新，" +
        "并连同 scripts/kb-manifest.json 一起提交。",
    };
  }
  if (r === sp) return null;
  return {
    kind: "snapshot-stale",
    message:
      `仓库记录指针 ${shortSha(r)} ≠ 快照记录版本 ${shortSha(sp)}。` +
      `内容 hash 基线已过期；请跑 npm run kb:diff（或 kb:update）后提交 ` +
      `scripts/kb-manifest.json 的刷新结果。`,
  };
}
