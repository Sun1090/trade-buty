/**
 * R10.16：新章节上线 dry-run。
 * 在真正提交到 kline-buty 前，对一个"草稿章节目录"做站点契约预检：
 *   - 章节名/slug、README（NN · 标题 + description）、课程文件契约
 *   - 显式序号重复、与既有章节/语言树的命名冲突
 *   - 站内自链目标存在性；与站点静态表（CHAPTER_ORDER、章数约束）的集成缺口
 * 用法：
 *   npm run kb:dry-run -- --draft <dir>   # dir 为草稿章节目录（建议放在仓库外/临时目录）
 */
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import {
  chapterNameIssue,
  validateReadme,
  validateLesson,
  findOrderDuplicates,
  planIntegration,
} from "./new-chapter-lib.mjs";
import { CHAPTER_ORDER } from "./nav-chain-lib.mjs";

const root = process.cwd();
const KB = path.join(root, "content/kline-buty/docs/knowledge");

if (!fs.existsSync(KB)) {
  console.error("[kb:dry-run] 知识库缺失：请先 git submodule update --init");
  process.exit(1);
}

const argIdx = process.argv.indexOf("--draft");
const draftArg = argIdx !== -1 ? process.argv[argIdx + 1] : null;
if (!draftArg) {
  console.error("用法：npm run kb:dry-run -- --draft <草稿章节目录>");
  process.exit(2);
}
const draft = path.resolve(root, draftArg);
if (!fs.existsSync(draft) || !fs.statSync(draft).isDirectory()) {
  console.error(`[kb:dry-run] 草稿目录不存在：${draft}`);
  process.exit(2);
}

const chapter = path.basename(draft);
const existing = new Set(
  ["zh", "en"].flatMap((loc) =>
    fs
      .readdirSync(path.join(KB, loc), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name),
  ),
);

const problems = [];
const notes = [];

const nameIssue = chapterNameIssue(chapter);
if (nameIssue) problems.push(`章节名：${nameIssue}`);
if (existing.has(chapter)) {
  problems.push(`章节 ${chapter} 已存在于知识库（非新章节；若是翻译补齐请走 kb:parity 流程）`);
}

const mdFiles = fs.readdirSync(draft).filter((f) => f.endsWith(".md"));
if (!mdFiles.includes("README.md")) problems.push("缺少 README.md（章首页）");

const lessons = [];
for (const f of mdFiles) {
  const raw = fs.readFileSync(path.join(draft, f), "utf8");
  let data = {};
  try {
    ({ data } = matter(raw));
  } catch {
    problems.push(`${f}：frontmatter 解析失败`);
    continue;
  }
  if (f === "README.md") {
    const h1 = raw.match(/^#\s+(.+)$/m)?.[1]?.trim();
    for (const p of validateReadme({
      title: data.title,
      description: data.description,
      h1,
    })) problems.push(`README：${p}`);
  } else {
    const slug = f.replace(/\.md$/, "");
    for (const p of validateLesson({
      slug,
      title: data.title,
      description: data.description,
    })) problems.push(p);
    lessons.push({ slug, title: data.title || "" });
  }
}

for (const { order, slugs } of findOrderDuplicates(lessons)) {
  problems.push(`课程前导序号 ${order} 重复：${slugs.join(", ")}`);
}
if (lessons.length === 0) notes.push("草稿没有课程文件（README 之外的 .md）");

// 站内自链：同章内相对链接目标必须存在（`](./x.md)` / `](x.md)`）
const selfLinkRe = /\]\(((?:\.\/)?[a-z0-9-]+\.md)(?:#[^)]*)?\)/g;
for (const f of mdFiles) {
  const raw = fs.readFileSync(path.join(draft, f), "utf8");
  for (const m of raw.matchAll(selfLinkRe)) {
    const target = path.basename(m[1]);
    if (!mdFiles.includes(target)) {
      problems.push(`${f} → 站内自链目标缺失：${m[1]}`);
    }
  }
}

for (const n of planIntegration({ chapter, existingOrder: CHAPTER_ORDER, zhChapterCount: 27 })) {
  notes.push(n);
}

console.log(`\n[kb:dry-run] 新章节预检：${chapter}`);
console.log(`  草稿：${draft}`);
console.log(`  课程文件：${lessons.length} 篇`);
if (problems.length > 0) {
  console.error(`\n❌ 阻断问题 ${problems.length} 个：`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log("\n✅ 契约预检通过");
if (notes.length > 0) {
  console.log(`\n注意（${notes.length}）`);
  for (const n of notes) console.log(`  - ${n}`);
}
console.log("\n下一步：把草稿并入 content/kline-buty（zh/en 镜像），再 npm run kb:update 触发全量门禁。");
