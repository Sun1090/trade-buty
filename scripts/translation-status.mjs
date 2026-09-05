/**
 * R6.7：中英标题对照表——翻译进度可视化数据源。
 * 扫描 zh/en 双语言根目录，生成 docs/translation-status.md：
 * 章节级 + 课程级对照与完成率。
 * 用法：npm run kb:translation-status
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const KB = path.join(root, "content/kline-buty/docs/knowledge");
const zhDir = path.join(KB, "zh");
const enDir = path.join(KB, "en");
const OUT = path.join(root, "docs/translation-status.md");

function chapters(dir) {
  if (!fs.existsSync(dir)) return new Map();
  const m = new Map();
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const docs = fs
      .readdirSync(path.join(dir, e.name))
      .filter((f) => f.endsWith(".md") && f !== "README.md")
      .sort();
    m.set(e.name, docs);
  }
  return m;
}

const zh = chapters(zhDir);
const en = chapters(enDir);

const titleOf = (locale, chapter) => {
  try {
    const readme = fs.readFileSync(path.join(KB, locale, chapter, "README.md"), "utf8");
    return readme.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? chapter;
  } catch {
    return chapter;
  }
};

const lines = [
  "# 知识库中英翻译进度",
  "",
  `> 自动生成于 ${new Date().toISOString().slice(0, 10)}（npm run kb:translation-status），勿手改。`,
  "",
];

let chDone = 0;
const chRows = [];
for (const [ch, zhDocs] of [...zh.entries()].sort()) {
  const enDocs = en.get(ch);
  const hasEn = enDocs !== undefined;
  if (hasEn) chDone++;
  const docOverlap = hasEn ? zhDocs.filter((d) => enDocs.includes(d)).length : 0;
  chRows.push(
    `| ${titleOf("zh", ch)} | ${ch} | ${zhDocs.length} | ${hasEn ? `✅ ${enDocs.length} 篇` : "—"} | ${hasEn ? `${docOverlap}/${zhDocs.length}` : "0%"} |`,
  );
}

lines.push(
  `## 章节级：${chDone}/${zh.size} 章有英文版`,
  "",
  "| 中文标题 | slug | zh 课程 | en 章节版本 | en 课程覆盖 |",
  "|---|---|---|---|---|",
  ...chRows,
  "",
);
fs.writeFileSync(OUT, lines.join("\n") + "\n");
console.log(`✅ 翻译进度表已生成：docs/translation-status.md（章节 ${chDone}/${zh.size}）`);
