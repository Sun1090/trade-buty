#!/usr/bin/env node
/**
 * R14.3：发布必须留 git tag（CI + 本地共用）。
 *
 * 背景：`0.4.0`–`0.7.0` 四次发布从未打 tag，回滚与「线上到底是哪个提交」只能靠
 * 人肉翻 CHANGELOG。本门禁把 tag 变成发布链路里可失败的一环。
 *
 * 判定口径：
 *   - 除最新发布版本外的每条发布记录，都必须有同名 `vX.Y.Z` tag（遗留豁免见
 *     `release-tag-lib.mjs` 的 `UNTAGGED_LEGACY_RELEASES`）；
 *   - 最新发布版本允许暂时没有 tag，因为 rebase 合并会改写 SHA，tag 只能在合并后
 *     打到 `main` 上；此时打印待办而不是判失败。
 *
 * 依赖 `git tag`，CI 的 checkout 需保留 tag（ci.yml 显式 `fetch-tags: true`）。
 * 用法：npm run check:release-tag
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  auditReleaseTags,
  expectedReleaseTag,
  newestReleaseVersion,
  pendingReleaseTag,
} from "./release-tag-lib.mjs";

const root = process.cwd();
const dataFile = path.join(root, "src/data/release-notes.json");

if (!fs.existsSync(dataFile)) {
  console.error(`[release-tag] ❌ 缺少发布记录数据文件：${dataFile}`);
  process.exit(1);
}

const releases = JSON.parse(fs.readFileSync(dataFile, "utf8")).releases ?? [];

let tags;
try {
  tags = execFileSync("git", ["tag", "--list"], {
    cwd: root,
    encoding: "utf8",
  })
    .split("\n")
    .filter(Boolean);
} catch (error) {
  console.error(
    `[release-tag] ❌ 无法读取 git tag（请在仓库内运行，且 CI 需 fetch-tags: true）：${error.message}`,
  );
  process.exit(1);
}

const issues = auditReleaseTags({ releases, tags });
if (issues.length > 0) {
  console.error("[release-tag] ❌ 发布记录与 git tag 不一致：");
  for (const issue of issues) console.error(`  - ${issue}`);
  process.exit(1);
}

const newest = newestReleaseVersion(releases);
const pending = pendingReleaseTag({ releases, tags });
console.log(
  `[release-tag] ✅ ${releases.length} 条发布记录的 tag 均已落地` +
    (newest
      ? pending
        ? `；最新 ${newest} 待合并后补打 ${expectedReleaseTag(newest)}`
        : `（最新 ${newest} → ${expectedReleaseTag(newest)}）`
      : ""),
);
