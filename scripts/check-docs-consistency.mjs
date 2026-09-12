/** Q5.1/Q5.2：阻断 README、AGENTS、plan 与当前知识库和实现再次漂移。 */
import fs from "node:fs";
import path from "node:path";
import {
  auditAgentsContract,
  auditNeutrality,
  auditPlanContract,
  auditReadmeCounts,
} from "./docs-consistency-lib.mjs";

const root = process.cwd();
const knowledgeRoot = path.join(root, "content/kline-buty/docs/knowledge");

function countLocale(locale) {
  const localeRoot = path.join(knowledgeRoot, locale);
  if (!fs.existsSync(localeRoot)) throw new Error(`缺少知识库语言目录：${localeRoot}`);
  const chapters = fs.readdirSync(localeRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  let lessons = 0;
  for (const chapter of chapters) {
    const chapterRoot = path.join(localeRoot, chapter.name);
    lessons += fs.readdirSync(chapterRoot).filter((file) => file.endsWith(".md") && file !== "README.md").length;
  }
  return { chapters: chapters.length, lessons };
}

const actual = countLocale("zh");
const en = countLocale("en");
const issues = [];
if (actual.chapters !== en.chapters || actual.lessons !== en.lessons) {
  issues.push(`zh 与 en 内容规模不一致：zh ${actual.chapters}/${actual.lessons}，en ${en.chapters}/${en.lessons}`);
}

const readmes = {
  "README.md": fs.readFileSync(path.join(root, "README.md"), "utf8"),
  "README.zh-CN.md": fs.readFileSync(path.join(root, "README.zh-CN.md"), "utf8"),
};
const aboutPath = path.join(root, "src/app/[locale]/about/page.tsx");
issues.push(...auditReadmeCounts({ en: readmes["README.md"], zh: readmes["README.zh-CN.md"] }, actual));
issues.push(...auditAgentsContract(fs.readFileSync(path.join(root, "AGENTS.md"), "utf8")));
issues.push(...auditPlanContract(fs.readFileSync(path.join(root, "docs/plan.md"), "utf8"), actual.lessons));
issues.push(...auditNeutrality(readmes, fs.readFileSync(aboutPath, "utf8")));

if (issues.length > 0) {
  console.error("[docs-consistency] ❌ 文档与当前实现不一致：");
  for (const issue of issues) console.error(`  - ${issue}`);
  process.exit(1);
}
console.log(`[docs-consistency] ✅ README/AGENTS/plan 与知识库一致（${actual.chapters} 章 / ${actual.lessons} 篇，zh/en 对齐）`);
