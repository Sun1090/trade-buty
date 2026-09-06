/**
 * R10.15：课程摘要与 SEO description 去重检查（CI 门禁，纯读 KB 无需构建）。
 * 规则（与站点 SEO 语义对齐：description 落到每页 meta description）：
 *   1. 同一 locale 内，不同文档的 description 归一化后不得相同（含章节 README）；
 *   2. description 不得只是标题的复述（去掉 "NN · " 序号后归一化相等）。
 * 只读不写；产物 docs/description-dupes.md。
 * 用法：npm run check:description-dupes
 */
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import {
  findDescriptionDuplicates,
  findTitleClones,
} from "./description-dupes-lib.mjs";

const root = process.cwd();
const KB = path.join(root, "content/kline-buty/docs/knowledge");

if (!fs.existsSync(KB)) {
  console.error("[description-dupes] 知识库缺失：请先 git submodule update --init");
  process.exit(1);
}

const entries = [];
for (const locale of ["zh", "en"]) {
  const localeRoot = path.join(KB, locale);
  if (!fs.existsSync(localeRoot)) continue;
  for (const chapter of fs.readdirSync(localeRoot, { withFileTypes: true })) {
    if (!chapter.isDirectory()) continue;
    const chapterRoot = path.join(localeRoot, chapter.name);
    for (const file of fs.readdirSync(chapterRoot).filter((n) => n.endsWith(".md"))) {
      const doc = file.replace(/\.md$/, "");
      const { data } = matter(fs.readFileSync(path.join(chapterRoot, file), "utf8"));
      entries.push({
        locale,
        chapter: chapter.name,
        doc,
        title: typeof data.title === "string" ? data.title : "",
        description: typeof data.description === "string" ? data.description : "",
      });
    }
  }
}

const dupeGroups = findDescriptionDuplicates(entries);
const titleClones = findTitleClones(entries);
const problems = [];
for (const g of dupeGroups) {
  problems.push(`description 重复（${g.locale}）：${g.docs.join(" ＝ ")}`);
}
for (const c of titleClones) {
  problems.push(`description 复述标题（${c.locale}/${c.chapter}/${c.doc}）`);
}

const lines = [
  "# 课程摘要 / SEO description 去重报告",
  "",
  `> 自动生成于 ${new Date().toISOString().slice(0, 10)}（npm run check:description-dupes，R10.15 门禁）`,
  "",
  `- 检查文档 ${entries.length} 篇（zh+en，含章节 README）`,
  `- 跨文档重复组：${dupeGroups.length} 个`,
  `- 复述标题的 description：${titleClones.length} 个`,
  ...(problems.length > 0
    ? ["", "## 待处理问题", "", ...problems.map((p) => `- [ ] ${p}`)]
    : ["", "（无问题）"]),
  "",
];
fs.writeFileSync(path.join(root, "docs/description-dupes.md"), lines.join("\n"));

if (problems.length > 0) {
  console.error(`❌ description 去重检查失败：${problems.length} 个问题`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(
  `✅ description 去重：${entries.length} 篇零重复、零标题复述 → docs/description-dupes.md`,
);
