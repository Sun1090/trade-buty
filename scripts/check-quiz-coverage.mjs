/**
 * R6.4：题库覆盖率报告——27 章 × 站方固定题库覆盖情况。
 * AI 章节出题已覆盖全部 27 章（R2.1）；固定题库按真实
 * questions 数组计数，缺口或题量不足会阻断。
 * 用法：npm run check:quiz-coverage
 */
import fs from "node:fs";
import path from "node:path";
import { parseQuizMounts } from "./quiz-source-lib.mjs";

const root = process.cwd();
const zhDir = path.join(root, "content/kline-buty/docs/knowledge/zh");
const titles = JSON.parse(fs.readFileSync(path.join(root, "src/lib/kb-titles.json"), "utf8"));
const quizzesSrc = fs.readFileSync(path.join(root, "src/lib/quizzes.ts"), "utf8");
const mounts = new Map(parseQuizMounts(quizzesSrc).map((entry) => [entry.key, entry]));

const chapters = fs
  .readdirSync(zhDir, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort();

const rows = [];
let covered = 0;
for (const c of chapters) {
  const mount = mounts.get(c);
  const hasQuiz = Boolean(mount && mount.questionCount !== null && mount.questionCount >= 3);
  if (hasQuiz) covered++;
  const qCount = mount?.questionCount ?? 0;
  rows.push(
    `| ${titles.zh?.[c]?.title ?? c} | ${c} | ${hasQuiz ? `✅ 固定题 ${qCount} 道` : "🤖 AI 出题"} |`,
  );
}

console.log(`# 题库覆盖率（${chapters.length} 章）

- 站方固定题库：${covered}/${chapters.length}（每章最少 3 道达标）
- AI 章节出题：${chapters.length}/${chapters.length}（24h 缓存 + 固定题回退）

| 章节 | slug | 出题来源 |
|---|---|---|
${rows.join("\n")}
`);

// R6.4 的回归线：固定题库/元数据覆盖与题目数必须完整。
const missingTitles = chapters.filter((c) => !titles.zh?.[c]);
if (missingTitles.length > 0) {
  console.error(`❌ kb-titles 缺少章节元数据：${missingTitles.join(", ")}`);
  process.exit(1);
}
const missingQuizzes = chapters.filter((c) => !mounts.has(c));
const malformedQuizzes = chapters.filter((c) => {
  const mount = mounts.get(c);
  return mount && (mount.questionCount === null || mount.questionCount < 3);
});
if (missingQuizzes.length > 0 || malformedQuizzes.length > 0) {
  if (missingQuizzes.length > 0) {
    console.error(`❌ 缺少固定题库：${missingQuizzes.join(", ")}`);
  }
  if (malformedQuizzes.length > 0) {
    console.error(`❌ 固定题不足 3 道：${malformedQuizzes.join(", ")}`);
  }
  process.exit(1);
}
const totalQuestions = [...mounts.values()].reduce((sum, mount) => sum + (mount.questionCount ?? 0), 0);
console.log(`✅ 题库覆盖率达标（${covered}/${chapters.length} 章，共 ${totalQuestions} 道固定题）`);
