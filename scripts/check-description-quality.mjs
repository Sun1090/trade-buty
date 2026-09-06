/** R10.4：扫描知识库课程 frontmatter description，输出可运营质量报告。 */
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { scoreDescription, renderDescriptionQualityMarkdown } from "./description-quality-lib.mjs";

const root = process.cwd();
const knowledgeRoot = path.join(root, "content/kline-buty/docs/knowledge");
const outputJson = path.join(root, "docs/description-quality.json");
const outputMarkdown = path.join(root, "docs/description-quality.md");

if (!fs.existsSync(knowledgeRoot)) {
  console.error("[description-quality] 知识库缺失：请先 git submodule update --init");
  process.exit(1);
}

const results = [];
for (const locale of ["zh", "en"]) {
  const localeRoot = path.join(knowledgeRoot, locale);
  if (!fs.existsSync(localeRoot)) continue;
  for (const chapter of fs.readdirSync(localeRoot, { withFileTypes: true })) {
    if (!chapter.isDirectory()) continue;
    const chapterRoot = path.join(localeRoot, chapter.name);
    for (const file of fs.readdirSync(chapterRoot).filter((name) => name.endsWith(".md") && name !== "README.md")) {
      const document = file.slice(0, -3);
      const data = matter(fs.readFileSync(path.join(chapterRoot, file), "utf8")).data;
      const scored = scoreDescription({ title: data.title, description: data.description });
      results.push({ locale, chapter: chapter.name, document, ...scored });
    }
  }
}
results.sort((a, b) => a.locale.localeCompare(b.locale) || a.chapter.localeCompare(b.chapter) || a.document.localeCompare(b.document));
const counts = results.reduce((acc, result) => ({ ...acc, [result.status]: acc[result.status] + 1 }), { pass: 0, review: 0, gap: 0 });
const report = { generatedAt: new Date().toISOString().slice(0, 10), counts, results };
fs.writeFileSync(outputJson, `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(outputMarkdown, renderDescriptionQualityMarkdown(report));
console.log(`[description-quality] pass ${counts.pass} / review ${counts.review} / gap ${counts.gap} → docs/description-quality.md`);
