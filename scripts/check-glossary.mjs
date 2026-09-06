/**
 * R10.13：术语表双语一致性检查（R6.8 升级为 CI 门禁）。
 * 数据源：src/lib/glossary-data.json（页面/脚本共用同一份）。
 * - 结构：term/en/def/defEn 齐全、非空；zh/en 主词各自唯一（不区分大小写）
 * - 语言侧：term/def 含中文，en/defEn 为英文
 * - 双语一致性：zh 主词须在 zh 语料出现 ≥1 次；en 主词须在 en 语料出现 ≥1 次
 *   （缺失 = 词条超出正文词汇 → 需先补 KB 内容或改选语料实际用词）
 * - 报告式输出 docs/glossary-coverage.md
 * 用法：npm run check:glossary
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const CJK = /[\u4e00-\u9fff]/;
const LATIN = /[A-Za-z]{2,}/;

const data = JSON.parse(
  fs.readFileSync(path.join(root, "src/lib/glossary-data.json"), "utf8"),
);

function corpus(locale) {
  const kb = path.join(root, `content/kline-buty/docs/knowledge/${locale}`);
  const out = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".md")) out.push(fs.readFileSync(p, "utf8"));
    }
  })(kb);
  return out.join("\n");
}

const zh = corpus("zh");
const en = corpus("en");

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** en 主词匹配：按非字母数字切 token，容忍 / 与空格分隔、末词复数（P/E Ratio、Futures/Perpetual、RSIs） */
function enTermRegex(enTerm) {
  const tokens = enTerm.split(/[^A-Za-z0-9]+/).filter(Boolean);
  const body = tokens
    .map((t, i) => (i < tokens.length - 1 ? esc(t) : `${esc(t)}s?`))
    .join("[\\s/]+");
  return new RegExp(`\\b${body}\\b`, "i");
}

const problems = [];
const seenZh = new Set();
const seenEn = new Set();

for (const t of data) {
  const label = `${t.term} / ${t.en}`;
  if (!t.term || !t.en || !t.def || !t.defEn) {
    problems.push(`结构：词条缺少字段（${label}）`);
    continue;
  }
  if (!CJK.test(t.term) || !CJK.test(t.def)) problems.push(`语言侧：term/def 应含中文（${label}）`);
  if (CJK.test(t.en) || !LATIN.test(t.defEn) || CJK.test(t.defEn))
    problems.push(`语言侧：en/defEn 应为英文（${label}）`);
  const zk = t.term.trim();
  const ek = t.en.trim().toLowerCase();
  if (seenZh.has(zk)) problems.push(`唯一性：zh 主词重复（${t.term}）`);
  if (seenEn.has(ek)) problems.push(`唯一性：en 主词重复（${t.en}）`);
  seenZh.add(zk);
  seenEn.add(ek);

  const zhHits = zh.includes(t.term) || zh.includes(t.term.replace(/\s+/g, ""));
  if (!zhHits) problems.push(`双语一致性：zh 主词「${t.term}」在 zh 语料零出现`);
  const enHits = enTermRegex(t.en).test(en);
  if (!enHits) problems.push(`双语一致性：en 主词「${t.en}」在 en 语料零出现`);
}

const lines = [
  "# 术语表交叉覆盖报告",
  "",
  `> 自动生成于 ${new Date().toISOString().slice(0, 10)}（npm run check:glossary，R10.13 双语门禁）`,
  "",
  `- 术语表共 ${data.length} 个词条（zh/en 双语定义）`,
  `- zh 孤儿词条（zh 正文零出现）：${data.filter((t) => !(zh.includes(t.term) || zh.includes(t.term.replace(/\s+/g, "")))).length} 个`,
  `- en 孤儿词条（en 正文零出现）：${data.filter((t) => !enTermRegex(t.en).test(en)).length} 个`,
  ...(problems.length > 0
    ? ["", "## 待处理问题", "", ...problems.map((p) => `- [ ] ${p}`)]
    : ["", "（无问题）"]),
  "",
];
fs.writeFileSync(path.join(root, "docs/glossary-coverage.md"), lines.join("\n"));

if (problems.length > 0) {
  console.error(`❌ 术语表双语检查失败：${problems.length} 个问题`);
  for (const p of problems) console.error(`  - ${p}`);
  console.error("新增词条时，请确认其在该语言正文中实际出现（KB 补内容或改选语料用词）。");
  process.exit(1);
}
console.log(
  `✅ 术语表双语一致：${data.length} 词条 · 双语语料零缺失 → docs/glossary-coverage.md`,
);
