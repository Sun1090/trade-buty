/**
 * R3.2：章节 AI 导读覆盖检查（运营用）。
 *
 * 导读入口在每章页面无条件渲染（受 R3.9/10 总开关控制），
 * 覆盖缺口主要在 en 语言根目录（zh 必有全部 27 章）。
 * 运行：npm run summary:coverage
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const kbDir = join(root, "content/kline-buty/docs/knowledge");

if (!existsSync(kbDir)) {
  console.error("❌ 知识库不存在：请先 git submodule update --init");
  process.exit(1);
}

const titles = JSON.parse(readFileSync(join(root, "src/lib/kb-titles.json"), "utf8"));
const zhChapters = Object.keys(titles.zh ?? {}).sort();

console.log(`# 章节 AI 导读覆盖（${zhChapters.length} 章）\n`);
console.log("| 章节 | slug | zh 导读 | en 导读 |");
console.log("|---|---|---|---|");
let enOk = 0;
for (const c of zhChapters) {
  const hasEnPage = existsSync(join(kbDir, "en", c));
  if (hasEnPage) enOk++;
  console.log(
    `| ${titles.zh[c].title ?? c} | ${c} | ✅ | ${hasEnPage ? "✅" : "—（en 目录待补）"} |`,
  );
}
console.log(
  `\n- zh：${zhChapters.length}/${zhChapters.length}\n- en：${enOk}/${zhChapters.length}\n- 入口开关：受 NEXT_PUBLIC_AI_ENABLED / AI_API_KEY 控制（R3.9/10）`,
);
