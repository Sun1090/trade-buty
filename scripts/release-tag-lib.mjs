/**
 * 发布版本与 git tag 的共享判定。
 *
 * `src/data/release-notes.json` 是发布事实的单一来源（站内 `/changelog` 与
 * `CHANGELOG.md` 都读它）。这里只放纯函数，供 `check:docs` 的版本号一致性与
 * `check:release-tag` 的 tag 门禁共用，避免两处各写一份 semver 比较。
 */

const SEMVER = /^\d+\.\d+\.\d+$/;

export function isPublishedVersion(value) {
  return SEMVER.test(String(value ?? ""));
}

/** 数字段比较；返回负数表示 a 比 b 旧。 */
export function compareVersions(a, b) {
  const left = String(a).split(".").map(Number);
  const right = String(b).split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    const diff = (left[index] ?? 0) - (right[index] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** 最新已发布版本号；没有合法条目时返回 null。 */
export function newestReleaseVersion(releases) {
  const versions = (Array.isArray(releases) ? releases : [])
    .map((release) => release?.version)
    .filter(isPublishedVersion);
  if (versions.length === 0) return null;
  return versions.reduce((latest, candidate) =>
    compareVersions(candidate, latest) > 0 ? candidate : latest
  );
}

export function expectedReleaseTag(version) {
  return `v${version}`;
}

/**
 * tag 门禁的遗留豁免：这四次发布早于本门禁，仓库里从未有过对应 tag。
 *
 * 有意**不回填**：给已上线的旧提交补打 tag，在把 tag 当作生产部署触发器的
 * 托管配置下会把过期代码推上线。豁免清单之外的任何已发布版本都必须有 tag，
 * 所以这条规则只会随时间收紧，新增一行需要刻意改动本文件。
 */
export const UNTAGGED_LEGACY_RELEASES = Object.freeze([
  "0.4.0",
  "0.5.0",
  "0.6.0",
  "0.7.0",
]);

/**
 * 计算缺失 tag 的已发布版本（只返回必须失败的项）。
 *
 * 最新发布版本不在此列：rebase 合并会改写 SHA，发布流程只能在合并之后到 `main`
 * 上打 tag，所以发布 PR 自身必然处于「版本已写入、tag 待合并」状态；CLI 会把它
 * 作为待办单独提示，而不是判失败。
 */
export function auditReleaseTags({ releases, tags }) {
  const issues = [];
  const known = new Set(Array.isArray(tags) ? tags : []);
  const newest = newestReleaseVersion(releases);
  const list = Array.isArray(releases) ? releases : [];

  for (const release of list) {
    const version = release?.version;
    if (!isPublishedVersion(version)) continue;
    if (UNTAGGED_LEGACY_RELEASES.includes(version)) continue;
    if (version === newest) continue;
    const tag = expectedReleaseTag(version);
    if (!known.has(tag)) {
      issues.push(
        `发布记录中的 ${version} 没有 git tag ${tag}（发布后必须打 tag 并推送）`
      );
    }
  }
  return issues;
}

/** 最新发布版本是否已有 tag（供 CLI 打印待办，不参与失败判定）。 */
export function pendingReleaseTag({ releases, tags }) {
  const newest = newestReleaseVersion(releases);
  if (!newest) return null;
  const tag = expectedReleaseTag(newest);
  const known = new Set(Array.isArray(tags) ? tags : []);
  return known.has(tag) ? null : { version: newest, tag };
}
