/** R10.2：从内容清单生成待补内容优先级报告。 */
import fs from "node:fs";
import path from "node:path";
import { rankContentGaps, renderContentGapMarkdown } from "./content-gap-ranking-lib.mjs";

const root = process.cwd();
const inventoryPath = path.join(root, "docs/content-inventory.json");
const outputJson = path.join(root, "docs/content-gap-priorities.json");
const outputMarkdown = path.join(root, "docs/content-gap-priorities.md");

if (!fs.existsSync(inventoryPath)) {
  console.error("[gap-priority] 缺少 docs/content-inventory.json，请先运行 npm run kb:inventory");
  process.exit(1);
}

const inventory = JSON.parse(fs.readFileSync(inventoryPath, "utf8"));
const missing = inventory.missing ?? { chapters: [], documents: [] };
const chapterSet = new Set(missing.chapters);
const gaps = [
  ...missing.chapters.map((chapter) => ({ chapter, document: "（整章）", importance: 100, searchDemand: 50 })),
  ...missing.documents.flatMap((item) => item.documents.map((document) => ({
    chapter: item.chapter,
    document,
    importance: chapterSet.has(item.chapter) ? 100 : 60,
    searchDemand: 50,
  }))),
];
const ranked = rankContentGaps(gaps);
const report = { generatedAt: new Date().toISOString().slice(0, 10), count: ranked.length, gaps: ranked };
fs.writeFileSync(outputJson, `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(outputMarkdown, renderContentGapMarkdown(report));
console.log(`[gap-priority] ${ranked.length} 个内容缺口，已生成优先级报告`);
