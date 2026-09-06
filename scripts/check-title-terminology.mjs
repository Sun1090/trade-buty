/** R10.3：扫描 zh/en 同 slug 课程标题，检查交易术语是否对齐。 */
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { checkTitlePairs, renderTitleTerminologyMarkdown } from "./title-terminology-lib.mjs";

const root = process.cwd();
const knowledgeRoot = path.join(root, "content/kline-buty/docs/knowledge");
const outputJson = path.join(root, "docs/title-terminology.json");
const outputMarkdown = path.join(root, "docs/title-terminology.md");

function readTitles(locale) {
  const localeRoot = path.join(knowledgeRoot, locale);
  const result = new Map();
  if (!fs.existsSync(localeRoot)) return result;
  for (const chapter of fs.readdirSync(localeRoot, { withFileTypes: true })) {
    if (!chapter.isDirectory()) continue;
    const chapterRoot = path.join(localeRoot, chapter.name);
    for (const file of fs.readdirSync(chapterRoot).filter((name) => name.endsWith(".md") && name !== "README.md")) {
      const document = file.slice(0, -3);
      const raw = fs.readFileSync(path.join(chapterRoot, file), "utf8");
      const title = matter(raw).data.title;
      result.set(`${chapter.name}/${document}`, typeof title === "string" ? title : "");
    }
  }
  return result;
}

if (!fs.existsSync(knowledgeRoot)) {
  console.error("[title-terminology] 知识库缺失：请先 git submodule update --init");
  process.exit(1);
}

const zh = readTitles("zh");
const en = readTitles("en");
const keys = [...new Set([...zh.keys(), ...en.keys()])].sort();
const pairs = keys.map((key) => {
  const [chapter, document] = key.split("/");
  return { chapter, document, zhTitle: zh.get(key) ?? "", enTitle: en.get(key) ?? "" };
});
const results = checkTitlePairs(pairs);
const counts = results.reduce((acc, result) => ({ ...acc, [result.status]: acc[result.status] + 1 }), { pass: 0, review: 0, gap: 0 });
const report = { generatedAt: new Date().toISOString().slice(0, 10), counts, results };
fs.writeFileSync(outputJson, `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(outputMarkdown, renderTitleTerminologyMarkdown(report));
console.log(`[title-terminology] pass ${counts.pass} / review ${counts.review} / gap ${counts.gap} → docs/title-terminology.md`);
