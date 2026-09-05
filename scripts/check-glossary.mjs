/**
 * R6.8：术语表（glossary）与正文交叉覆盖检查。
 * - 术语表里的术语在知识库正文零出现 → 候选待补内容的"孤儿术语"
 * - 报告式输出 docs/glossary-coverage.md
 * 用法：npm run check:glossary
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const glossarySrc = fs.readFileSync(
  path.join(root, "src/app/[locale]/glossary/page.tsx"),
  "utf8",
);

// 提取术语：TERMS 数组中 zh 字段（name: "..." 或 term: "..." 或中文键）
const termRe = /(?:term|name|zh)\s*:\s*"([^"]{2,20})"/g;
const terms = new Set();
let m;
while ((m = termRe.exec(glossarySrc)) !== null) {
  if (/[\u4e00-\u9fff]/.test(m[1])) terms.add(m[1]);
}

// 拼接全部知识库 zh 正文
const KB = path.join(root, "content/kline-buty/docs/knowledge/zh");
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".md")) out.push(p);
  }
  return out;
}
const corpus = walk(KB).map((f) => fs.readFileSync(f, "utf8")).join("\n");

const orphans = [...terms].filter((t) => !corpus.includes(t));

const lines = [
  "# 术语表交叉覆盖报告",
  "",
  `> 自动生成于 ${new Date().toISOString().slice(0, 10)}（npm run check:glossary）`,
  "",
  `- 术语表共 ${terms.size} 个术语`,
  `- 孤儿术语（正文零出现，候选补充内容或删除词条）：${orphans.length} 个`,
  "",
  ...(orphans.length > 0 ? orphans.map((t) => `- [ ] ${t}`) : ["（无孤儿术语）"]),
  "",
];
fs.writeFileSync(path.join(root, "docs/glossary-coverage.md"), lines.join("\n"));
console.log(
  `✅ 术语交叉覆盖：${terms.size} 术语 / 孤儿 ${orphans.length} 个 → docs/glossary-coverage.md`,
);
