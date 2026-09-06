/**
 * R6.1：kb:update 产物 diff 摘要——知识库文件清单与上次快照对比，
 * 输出新增/删除的篇章与课程列表。
 * R10.7：快照同时记录每篇内容 sha256，可识别「内容修改未增删」的文档，
 * 供 scripts/check-kb-changelog.mjs 生成 changelog 自动片段。
 * R10.18：快照额外记录上游 submodule 指针 `pointer`（随 --update 刷新），
 * 供 scripts/check-kb-pointer.mjs 校验「仓库记录指针 = 工作区 = 快照」。
 *
 * 快照：scripts/kb-manifest.json（随 kb:update 自动刷新；形状向后兼容，
 * files 数组保留，新增 hashes 映射、pointer 字段）。
 * 用法：
 *   node scripts/kb-diff.mjs            # 对比并打印摘要
 *   node scripts/kb-diff.mjs --update   # 对比后刷新快照（files + hashes）
 *   node scripts/kb-diff.mjs --changelog docs/kb-changelog-draft.md
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const root = process.cwd();
const KB = path.join(root, "content/kline-buty/docs/knowledge");
const MANIFEST = path.join(root, "scripts/kb-manifest.json");

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".md")) out.push(path.relative(KB, p));
  }
  return out;
}

function sha256File(file) {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

const current = walk(KB).sort();
const currentHashes = Object.fromEntries(current.map((f) => [f, sha256File(path.join(KB, f))]));
const stored = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, "utf8")) : null;
const prev = stored?.files ?? [];
const prevHashes = stored?.hashes ?? null;

const prevSet = new Set(prev);
const curSet = new Set(current);
const added = current.filter((f) => !prevSet.has(f));
const removed = prev.filter((f) => !curSet.has(f));
const changed =
  prevHashes && Object.keys(prevHashes).length > 0
    ? current.filter((f) => prevHashes[f] !== undefined && prevHashes[f] !== currentHashes[f])
    : [];

console.log(`# 知识库 diff 摘要（当前 ${current.length} 个文件，上次快照 ${prev.length} 个）`);
console.log(`- 新增：${added.length} 个`);
for (const f of added.slice(0, 50)) console.log(`  + ${f}`);
console.log(`- 删除：${removed.length} 个`);
for (const f of removed.slice(0, 50)) console.log(`  - ${f}`);
if (prevHashes && Object.keys(prevHashes).length > 0) {
  console.log(`- 内容修改：${changed.length} 个`);
  for (const f of changed.slice(0, 50)) console.log(`  ~ ${f}`);
}
if (added.length === 0 && removed.length === 0 && changed.length === 0) {
  console.log("- 无任何变化（文件与内容均与快照一致）");
}

// R6.10：changelog 草稿片段（人审后并入正式 changelog）；R10.7 起含内容修改清单
const changelogIdx = process.argv.indexOf("--changelog");
if (changelogIdx > -1 && (added.length > 0 || removed.length > 0 || changed.length > 0)) {
  const target = process.argv[changelogIdx + 1] ?? "docs/kb-changelog-draft.md";
  const date = new Date().toISOString().slice(0, 10);
  const lines = [
    `## ${date} 知识库更新（草稿，待人工确认）`,
    "",
  ];
  if (added.length > 0) {
    lines.push("**新增课程：**", ...added.map((f) => `- ${f}`), "");
  }
  if (changed.length > 0) {
    lines.push("**内容更新：**", ...changed.map((f) => `- ${f}`), "");
  }
  if (removed.length > 0) {
    lines.push("**移除课程：**", ...removed.map((f) => `- ${f}`), "");
  }
  fs.writeFileSync(path.join(root, target), lines.join("\n") + "\n");
  console.log(`\n📝 changelog 草稿已写入 ${target}`);
}

if (process.argv.includes("--update")) {
  // R10.18：记录上游 submodule 指针（工作区实际 HEAD）；git 不可用时置空由门禁兜底
  let pointer = "";
  try {
    pointer = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: path.join(root, "content/kline-buty"),
      encoding: "utf8",
    }).trim();
  } catch {
    pointer = "";
  }
  fs.writeFileSync(
    MANIFEST,
    JSON.stringify(
      { files: current, hashes: currentHashes, pointer, at: new Date().toISOString() },
      null,
      2,
    ),
  );
  console.log(
    `📸 快照已刷新（${current.length} 个文件 + 内容 hash${pointer ? ` + 上游指针 ${pointer.slice(0, 7)}` : ""}）`,
  );
}
