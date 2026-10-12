/** Q5.1/Q5.2：阻断 README、贡献指南、架构文档、AGENTS、plan、发布版本号与当前实现再次漂移。 */
import fs from "node:fs";
import path from "node:path";
import {
  auditAgentsContract,
  auditArchitectureContract,
  auditContributingContract,
  auditDocNumberClaims,
  auditNeutrality,
  auditPlanContract,
  auditReadmeCounts,
  auditReadmeQuizCounts,
  auditReadmeImplementationReferences,
  auditReleaseChecklist,
  auditReleaseVersion,
  listRepoMarkdown,
} from "./docs-consistency-lib.mjs";
import { MIN_QUESTIONS_PER_CHAPTER, parseQuizMounts } from "./quiz-source-lib.mjs";
import { AUDITED_DOCS } from "./db-assertion-counts.mjs";

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

function readRequiredDoc(relativePath) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) {
    issues.push(`${relativePath}: 文件缺失`);
    return null;
  }
  return fs.readFileSync(fullPath, "utf8");
}

issues.push(...auditReadmeCounts({ en: readmes["README.md"], zh: readmes["README.zh-CN.md"] }, actual));
// 同一屏那句题数由固定题库说了算（R16.312）。章数取内容树现读的 `actual.chapters`，
// 与上面那条同源；题数从 `src/lib/quizzes.ts` 现数，口径与 `check:quiz-coverage` 一致。
const quizMounts = parseQuizMounts(
  fs.readFileSync(path.join(root, "src/lib/quizzes.ts"), "utf8"),
);
issues.push(
  ...auditReadmeQuizCounts(
    { en: readmes["README.md"], zh: readmes["README.zh-CN.md"] },
    {
      chapters: actual.chapters,
      questions: quizMounts.reduce((sum, mount) => sum + (mount.questionCount ?? 0), 0),
    },
  ),
);

// R16.315：现行文档里每一个「数字＋单位」都要有主人。前四轮各修一处手抄（27 / 418 / 81 / 430），
// 这一条把它换成登记制——新增一处无主人的手抄在提交时就红，而不是等下一轮有人路过。
// 主人全部现读：内容树（章/篇）、`src/lib/quizzes.ts`（题数）、`quiz-source-lib` 的纪律常量
// （每章最少题数）、`db-assertion-counts` 的文档清单（对账篇数）。**不取任何文档自己印的数**。
const allMarkdown = {};
for (const relativePath of listRepoMarkdown(root)) {
  allMarkdown[relativePath] = fs.readFileSync(path.join(root, relativePath), "utf8");
}
issues.push(
  ...auditDocNumberClaims({
    all: allMarkdown,
    actual: {
      chapters: actual.chapters,
      lessons: actual.lessons,
      questions: quizMounts.reduce((sum, mount) => sum + (mount.questionCount ?? 0), 0),
      minQuestionsPerChapter: MIN_QUESTIONS_PER_CHAPTER,
      dbAuditedDocs: AUDITED_DOCS.length,
    },
  }),
);
issues.push(...auditReadmeImplementationReferences(readmes));
issues.push(...auditAgentsContract(fs.readFileSync(path.join(root, "AGENTS.md"), "utf8")));
issues.push(...auditPlanContract(fs.readFileSync(path.join(root, "docs/plan.md"), "utf8"), actual.lessons));

const contributing = readRequiredDoc("CONTRIBUTING.md");
if (contributing !== null) issues.push(...auditContributingContract(contributing));
const architecture = readRequiredDoc("docs/architecture.md");
if (architecture !== null) issues.push(...auditArchitectureContract(architecture));
const releaseChecklist = readRequiredDoc("docs/release-checklist.md");
if (releaseChecklist !== null) issues.push(...auditReleaseChecklist(releaseChecklist));

issues.push(...auditNeutrality(readmes, fs.readFileSync(aboutPath, "utf8")));

const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const notes = JSON.parse(
  fs.readFileSync(path.join(root, "src/data/release-notes.json"), "utf8")
);
const versionIssues = auditReleaseVersion({
  packageVersion: pkg.version,
  releases: notes.releases,
});
issues.push(...versionIssues);

if (issues.length > 0) {
  console.error("[docs-consistency] ❌ 文档与当前实现不一致：");
  for (const issue of issues) console.error(`  - ${issue}`);
  process.exit(1);
}
console.log(
  `[docs-consistency] ✅ README/CONTRIBUTING/architecture/AGENTS/plan/版本号与知识库一致（${actual.chapters} 章 / ${actual.lessons} 篇，zh/en 对齐，package ${pkg.version}）`
);
