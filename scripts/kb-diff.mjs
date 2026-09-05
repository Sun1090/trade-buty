/**
 * R6.1：kb:update 产物 diff 摘要——知识库文件清单与上次快照对比，
 * 输出新增/删除的篇章与课程列表。
 *
 * 快照：scripts/kb-manifest.json（随 kb:update 自动刷新）。
 * 用法：
 *   node scripts/kb-diff.mjs            # 对比并打印摘要
 *   node scripts/kb-diff.mjs --update   # 对比后刷新快照
 *   node scripts/kb-diff.mjs --changelog docs/kb-changelog-draft.md
 */
import fs from "node:fs";
import path from "node:path";

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

const current = walk(KB).sort();
const prev = fs.existsSync(MANIFEST)
  ? (JSON.parse(fs.readFileSync(MANIFEST, "utf8")).files ?? [])
  : [];

const prevSet = new Set(prev);
const curSet = new Set(current);
const added = current.filter((f) => !prevSet.has(f));
const removed = prev.filter((f) => !curSet.has(f));

console.log(`# 知识库 diff 摘要（当前 ${current.length} 个文件，上次快照 ${prev.length} 个）`);
console.log(`- 新增：${added.length} 个`);
for (const f of added.slice(0, 50)) console.log(`  + ${f}`);
console.log(`- 删除：${removed.length} 个`);
for (const f of removed.slice(0, 50)) console.log(`  - ${f}`);
if (added.length === 0 && removed.length === 0) {
  console.log("- 无结构变化（仅内容修改或无更新）");
}

// R6.10：changelog 草稿片段（人审后并入正式 changelog）
const changelogIdx = process.argv.indexOf("--changelog");
if (changelogIdx > -1 && (added.length > 0 || removed.length > 0)) {
  const target = process.argv[changelogIdx + 1] ?? "docs/kb-changelog-draft.md";
  const date = new Date().toISOString().slice(0, 10);
  const lines = [
    `## ${date} 知识库更新（草稿，待人工确认）`,
    "",
  ];
  if (added.length > 0) {
    lines.push("**新增课程：**", ...added.map((f) => `- ${f}`), "");
  }
  if (removed.length > 0) {
    lines.push("**移除课程：**", ...removed.map((f) => `- ${f}`), "");
  }
  fs.writeFileSync(path.join(root, target), lines.join("\n") + "\n");
  console.log(`\n📝 changelog 草稿已写入 ${target}`);
}

if (process.argv.includes("--update")) {
  fs.writeFileSync(MANIFEST, JSON.stringify({ files: current, at: new Date().toISOString() }, null, 2));
  console.log(`📸 快照已刷新（${current.length} 个文件）`);
}
