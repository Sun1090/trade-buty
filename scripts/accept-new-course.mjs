/** R10.6：知识库新增课程自动验收清单 CLI。
 * 用法：
 *   npm run kb:accept                     # 全量验收（写 docs/new-course-acceptance.{json,md}，不阻断）
 *   npm run kb:accept -- <relpath...>     # 验收指定课程，blocking 未过则 exit 1
 *   npm run kb:accept -- --since <ref>    # 验收子模块 <ref>..HEAD 间新增的课程（默认 HEAD~1）
 * relpath 形如 zh/spot/new-course（自动补 .md）；--since 的 ref 是 content/kline-buty 子模块内 ref。
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { checkNewCourse, renderNewCourseMarkdown } from "./new-course-lib.mjs";

const root = process.cwd();
const knowledgeRoot = path.join(root, "content/kline-buty/docs/knowledge");
const outputJson = path.join(root, "docs/new-course-acceptance.json");
const outputMarkdown = path.join(root, "docs/new-course-acceptance.md");

if (!fs.existsSync(knowledgeRoot)) {
  console.error("[kb:accept] 知识库缺失：请先 git submodule update --init");
  process.exit(1);
}

function lessonFiles(localeRoot) {
  const files = [];
  if (!fs.existsSync(localeRoot)) return files;
  for (const chapter of fs.readdirSync(localeRoot, { withFileTypes: true })) {
    if (!chapter.isDirectory()) continue;
    for (const f of fs.readdirSync(path.join(localeRoot, chapter.name))) {
      if (f.endsWith(".md") && f !== "README.md") files.push({ locale: path.basename(localeRoot), chapter: chapter.name, document: f.slice(0, -3) });
    }
  }
  return files;
}

function targetsFromArgs(args) {
  const sinceIdx = args.indexOf("--since");
  if (sinceIdx !== -1) {
    const ref = args[sinceIdx + 1] && !args[sinceIdx + 1].startsWith("--") ? args[sinceIdx + 1] : "HEAD~1";
    const submodule = path.join(root, "content/kline-buty");
    const lines = execFileSync("git", ["-C", submodule, "diff", "--name-status", `${ref}..HEAD`, "--", "docs/knowledge"], { encoding: "utf8" });
    const targets = [];
    for (const line of lines.split("\n")) {
      const [status, file] = line.trim().split(/\s+/);
      if (!/^(A|R)/.test(status || "")) continue;
      const m = file.match(/^docs\/knowledge\/(zh|en)\/([^/]+)\/([a-z0-9-]+)\.md$/);
      if (m) targets.push({ locale: m[1], chapter: m[2], document: m[3] });
    }
    return { targets, label: `新增于 ${ref}..HEAD（${targets.length} 篇）` };
  }
  if (args.length > 0) {
    const targets = [];
    for (const rel of args) {
      const m = rel.replace(/\.md$/, "").match(/^(zh|en)\/([^/]+)\/([a-z0-9-]+)$/);
      if (!m) throw new Error(`无法解析路径（应为 zh|en/章节/slug）: ${rel}`);
      targets.push({ locale: m[1], chapter: m[2], document: m[3] });
    }
    return { targets, label: `${targets.length} 篇指定课程` };
  }
  const all = [...lessonFiles(path.join(knowledgeRoot, "zh")), ...lessonFiles(path.join(knowledgeRoot, "en"))];
  return { targets: all, label: `全量 ${all.length} 篇`, rollup: true };
}

const args = process.argv.slice(2);
let plan;
try {
  plan = targetsFromArgs(args);
} catch (err) {
  console.error(`[kb:accept] ${err.message}`);
  process.exit(2);
}

const results = [];
const missing = [];
for (const t of plan.targets) {
  const file = path.join(knowledgeRoot, t.locale, t.chapter, `${t.document}.md`);
  if (!fs.existsSync(file)) {
    missing.push(`${t.locale}/${t.chapter}/${t.document}`);
    continue;
  }
  const markdown = fs.readFileSync(file, "utf8");
  results.push(checkNewCourse({ ...t, markdown }));
}
if (missing.length) console.error(`[kb:accept] ⚠ 找不到文件（跳过）: ${missing.join(", ")}`);

if (plan.rollup) {
  const counts = results.reduce((acc, r) => ({ ...acc, [r.status]: acc[r.status] + 1 }), { ok: 0, warn: 0, fail: 0 });
  fs.writeFileSync(outputJson, `${JSON.stringify({ generatedAt: new Date().toISOString().slice(0, 10), counts, results }, null, 2)}\n`);
  fs.writeFileSync(outputMarkdown, renderNewCourseMarkdown({ generatedAt: new Date().toISOString().slice(0, 10), results }));
  console.log(`[kb:accept] ${plan.label} → ok ${counts.ok} / warn ${counts.warn} / fail ${counts.fail} → docs/new-course-acceptance.md`);
  process.exit(0);
}

const icons = { ok: "✅", warn: "⚠️", fail: "❌" };
console.log(`[kb:accept] ${plan.label}`);
let blockingFail = false;
for (const r of results) {
  const bad = r.checks.filter((c) => !c.pass);
  if (bad.some((c) => c.level === "blocking")) blockingFail = true;
  console.log(`${icons[r.status]} ${r.locale}/${r.chapter}/${r.document}`);
  for (const c of bad) console.log(`    ${c.level === "blocking" ? "❌" : "⚠️"} ${c.label}: ${c.detail}`);
}
console.log(blockingFail ? "[kb:accept] ❌ 存在 blocking 未过项，验收不通过" : "[kb:accept] ✅ 全部 blocking 通过");
process.exit(blockingFail ? 1 : 0);
