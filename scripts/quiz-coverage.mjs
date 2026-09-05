/**
 * R2.12：AI 出题覆盖率看板（运营用）。
 *
 * 输出每章：是否有站方固定题库、是否可 AI 出题（kb-titles 有章名即可出）。
 * 纯离线脚本，不访问 Supabase；运行：npm run quiz:coverage
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const titles = JSON.parse(readFileSync(join(root, "src/lib/kb-titles.json"), "utf8"));
const quizzesSrc = readFileSync(join(root, "src/lib/quizzes.ts"), "utf8");
const fixedChapters = new Set([...quizzesSrc.matchAll(/^  "([a-z-]+)": \{/gm)].map((m) => m[1]));

const chapters = Object.keys(titles.zh ?? {}).sort();
let fixed = 0;
const rows = chapters.map((c) => {
  const hasFixed = fixedChapters.has(c);
  if (hasFixed) fixed++;
  const title = titles.zh[c].title ?? c;
  return `| ${title} | ${c} | ${hasFixed ? "✅ 固定题" : "🤖 仅 AI 出题"} | ${titles.en?.[c] ? "✅" : "—"} |`;
});

console.log(`# AI 出题覆盖率（${chapters.length} 章）

- 站方固定题库：${fixed}/${chapters.length}
- AI 章节出题：${chapters.length}/${chapters.length}（全部可出，24h 缓存 + 固定题回退）
- 英文章节元数据：${Object.keys(titles.en ?? {}).length}/${chapters.length}

| 章节 | slug | 出题来源 | en 元数据 |
|---|---|---|---|
${rows.join("\n")}
`);
