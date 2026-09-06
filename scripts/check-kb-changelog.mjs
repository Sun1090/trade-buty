#!/usr/bin/env node
/**
 * R10.7：生成知识库内容变更 changelog 自动片段。
 *
 * 对比 scripts/kb-manifest.json 中上次快照（含每篇 sha256，由 kb-diff --update
 * 在 kb:update 流程里刷新）与当前知识库内容，识别 新增 / 内容更新 / 移除，
 * 写入 docs/kb-changelog-YYYY-MM-DD.md（无变更时不写文件、exit 0）。
 *
 * 只读快照；建立/刷新 hash 基线请走 kb:update（或 npm run kb:diff）。
 * 用法：
 *   node scripts/check-kb-changelog.mjs            # 对比并写今日片段
 *   node scripts/check-kb-changelog.mjs --out tmp/x.md --date 2026-09-06
 *   node scripts/check-kb-changelog.mjs --kb <dir> --manifest <file>   # 测试用
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { compareKnowledge, extractTitle, renderChangelogFragment } from "./content-changelog-lib.mjs";

const root = process.cwd();
const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : undefined;
};

const KB_DIR = arg("--kb") ?? path.join(root, "content/kline-buty/docs/knowledge");
const MANIFEST = arg("--manifest") ?? path.join(root, "scripts/kb-manifest.json");
const DATE = arg("--date") ?? new Date().toISOString().slice(0, 10);
const OUT = arg("--out") ?? path.join(root, `docs/kb-changelog-${DATE}.md`);

function sha256File(file) {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

/** 递归收集 KB 下所有 .md：relpath -> sha256。 */
function walk(dir, base = dir, out = {}) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, base, out);
    else if (entry.name.endsWith(".md")) out[path.relative(base, p)] = sha256File(p);
  }
  return out;
}

const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, "utf8")) : null;
const prev = manifest?.hashes ?? null;
if (!prev || Object.keys(prev).length === 0) {
  console.log("⚠️  kb-manifest.json 尚无内容 hash 基线（旧版快照只有文件清单）。");
  console.log("    先运行 npm run kb:diff（或 kb:update）刷新快照建立基线。");
  process.exit(0);
}

const current = walk(KB_DIR);
const changes = compareKnowledge({ prev, current });
const total = changes.added.length + changes.changed.length + changes.removed.length;
if (total === 0) {
  console.log(`✅ 知识库无内容变更（${Object.keys(current).length} 个文件，快照基线 ${Object.keys(prev).length} 个）`);
  process.exit(0);
}

const titleOf = (rel) => {
  const file = path.join(KB_DIR, rel);
  if (!fs.existsSync(file)) return null;
  return extractTitle(fs.readFileSync(file, "utf8"), rel);
};
const fragment = renderChangelogFragment({ date: DATE, changes, titleOf });
fs.writeFileSync(OUT, `${fragment}\n`);
console.log(`📝 changelog 片段已写入 ${path.relative(root, OUT)}`);
console.log(`   新增 ${changes.added.length} / 内容更新 ${changes.changed.length} / 移除 ${changes.removed.length}`);
