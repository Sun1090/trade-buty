/**
 * R6.3：测验挂载点校验——quizzes.ts 的每个 chapterNum 必须是真实篇章，
 * 每个 docSlug 必须存在于该章课程文件中（否则课末测验挂在不存在的课上）。
 * 违规 → exit 1，CI 阻断。
 * 用法：npm run check:quiz-mounts
 */
import fs from "node:fs";
import path from "node:path";
import { parseQuizMounts } from "./quiz-source-lib.mjs";

const root = process.cwd();
const KB = path.join(root, "content/kline-buty/docs/knowledge");
const zhDir = path.join(KB, "zh");

const src = fs.readFileSync(path.join(root, "src/lib/quizzes.ts"), "utf8");
const entries = parseQuizMounts(src);

if (entries.length === 0) {
  console.error("❌ quizzes.ts 未解析到任何挂载点（AST 解析失配？）");
  process.exit(1);
}

const issues = [];
const seen = new Set();
for (const { key, chapterNum, docSlug, questionCount } of entries) {
  if (seen.has(key)) {
    issues.push(`${key}: 测验挂载键重复`);
    continue;
  }
  seen.add(key);
  if (!chapterNum) {
    issues.push(`${key}: 缺少 chapterNum`);
    continue;
  }
  if (!docSlug) {
    issues.push(`${key}: 缺少 docSlug`);
    continue;
  }
  if (key !== chapterNum) issues.push(`${key}: 键名与 chapterNum(${chapterNum}) 不一致`);
  const chapterDir = path.join(zhDir, chapterNum);
  if (!fs.existsSync(chapterDir)) {
    issues.push(`${chapterNum}: 知识库中不存在该篇章目录`);
    continue;
  }
  const hasDoc = fs.existsSync(path.join(chapterDir, `${docSlug}.md`));
  if (!hasDoc) issues.push(`${chapterNum}: docSlug "${docSlug}" 不存在对应课程文件`);
  if (questionCount === null) issues.push(`${key}: questions 不是数组`);
  else if (questionCount < 3) issues.push(`${key}: 固定题仅 ${questionCount} 道（至少 3 道）`);
}

if (issues.length > 0) {
  console.error(`❌ 测验挂载点问题 ${issues.length} 处：`);
  console.error(issues.join("\n"));
  process.exit(1);
}
console.log(`✅ 测验挂载点校验通过（${entries.length} 章挂载，chapter/doc 均存在）`);
