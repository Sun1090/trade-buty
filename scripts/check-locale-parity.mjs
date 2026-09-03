import fs from "node:fs";
import path from "node:path";

/**
 * 中英内容 parity 跟踪：对比 zh/en 的章节与文档集合，输出缺失清单。
 * 用法: npm run kb:parity [-- --strict]
 * 默认只报告（exit 0）；--strict 下缺失即失败（用于发版门禁）。
 */
const knowledgeRoot = path.join(
  process.cwd(),
  "content/kline-buty/docs/knowledge"
);
const strict = process.argv.includes("--strict");

function docsOf(locale, chapter) {
  const dir = path.join(knowledgeRoot, locale, chapter);
  if (!fs.existsSync(dir)) return null;
  return new Set(
    fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".md") && f !== "README.md")
      .map((f) => f.replace(/\.md$/, ""))
  );
}

function main() {
  if (!fs.existsSync(knowledgeRoot)) {
    console.error("[parity] 知识库缺失：请先 git submodule update --init");
    process.exit(1);
  }
  const zhChapters = new Set(
    fs
      .readdirSync(path.join(knowledgeRoot, "zh"), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
  );
  const enRoot = path.join(knowledgeRoot, "en");
  const enChapters = fs.existsSync(enRoot)
    ? new Set(
        fs
          .readdirSync(enRoot, { withFileTypes: true })
          .filter((e) => e.isDirectory())
          .map((e) => e.name)
      )
    : new Set();

  let missingChapters = 0;
  let missingDocs = 0;
  const lines = [];

  for (const ch of [...zhChapters].sort()) {
    if (!enChapters.has(ch)) {
      lines.push(`  缺整章: en/${ch}/（整章未翻译）`);
      missingChapters++;
      continue;
    }
    const zhDocs = docsOf("zh", ch) ?? new Set();
    const enDocs = docsOf("en", ch) ?? new Set();
    const lacking = [...zhDocs].filter((d) => !enDocs.has(d));
    if (lacking.length > 0) {
      missingDocs += lacking.length;
      lines.push(`  ${ch}: 缺 ${lacking.length} 篇 → ${lacking.join(", ")}`);
    }
  }
  const extra = [...enChapters].filter((c) => !zhChapters.has(c));
  for (const ch of extra) lines.push(`  注意: en/${ch}/ 在 zh 无对应章节`);

  const total = missingChapters + missingDocs;
  console.log(
    `[parity] zh ${zhChapters.size} 章 / en ${enChapters.size} 章；缺失：${missingChapters} 章整章 + ${missingDocs} 篇文档`
  );
  if (lines.length > 0) console.log(lines.join("\n"));
  if (strict && total > 0) {
    console.error("[parity] --strict 模式：存在缺失，构建阻断");
    process.exit(1);
  }
}

main();
