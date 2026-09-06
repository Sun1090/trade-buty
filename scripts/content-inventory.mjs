/** R10.1：生成内容清单 JSON 与 Markdown 覆盖率报告。 */
import fs from "node:fs";
import path from "node:path";
import { buildContentInventory, renderContentInventoryMarkdown } from "./content-inventory-lib.mjs";

const root = process.cwd();
const knowledgeRoot = path.join(root, "content/kline-buty/docs/knowledge");
const outputJson = path.join(root, "docs/content-inventory.json");
const outputMarkdown = path.join(root, "docs/content-inventory.md");

function scanLocale(locale) {
  const directory = path.join(knowledgeRoot, locale);
  if (!fs.existsSync(directory)) return {};
  const result = {};
  for (const chapterEntry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (!chapterEntry.isDirectory()) continue;
    const chapterPath = path.join(directory, chapterEntry.name);
    const documents = fs.readdirSync(chapterPath)
      .filter((file) => file.endsWith(".md") && file !== "README.md")
      .sort();
    result[chapterEntry.name] = { documents };
  }
  return result;
}

if (!fs.existsSync(knowledgeRoot)) {
  console.error("[inventory] 知识库缺失：请先 git submodule update --init");
  process.exit(1);
}

const report = buildContentInventory(scanLocale("zh"), scanLocale("en"), new Date().toISOString().slice(0, 10));
fs.writeFileSync(outputJson, `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(outputMarkdown, renderContentInventoryMarkdown(report));
console.log(`[inventory] ${report.coverage.document.translated}/${report.coverage.document.total} 篇课程覆盖（${report.coverage.document.percent}%）`);
