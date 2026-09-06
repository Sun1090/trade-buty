/**
 * R10.14：中英 slug 冲突检查（CI 门禁，纯读 KB 无需构建）。
 * 站点 URL 身份 = `/{locale}/knowledge/{chapter}/{doc}`，slug 即身份：
 *   1. slug 必须为小写字母数字连字符（README.md 章首页豁免）；
 *   2. 同 locale 内章节/课程无大小写折叠或数字前缀变体并存（01-foo vs foo）；
 *   3. 中英两侧同一课必须逐字同 slug——zh 01-foo / en foo 这类镜像漂移
 *      会破坏 hreflang/canonical 与跨语言链接配对（本检查核心）。
 * 只读不写；用法：npm run check:slug-conflicts
 */
import fs from "node:fs";
import path from "node:path";
import {
  README,
  isLegalSlug,
  findIdentityConflicts,
  crossLocaleSlugConflicts,
} from "./slug-conflict-lib.mjs";

const root = process.cwd();
const KB = path.join(root, "content/kline-buty/docs/knowledge");
const LOCALES = ["zh", "en"];

if (!fs.existsSync(KB)) {
  console.error("[slug-conflicts] 知识库缺失：请先 git submodule update --init");
  process.exit(1);
}

const problems = [];
let docTotal = 0;

function chapterSlugs(locale) {
  const dir = path.join(KB, locale);
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
    .map((e) => e.name)
    .sort();
}

function docSlugs(locale, chapter) {
  const dir = path.join(KB, locale, chapter);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(/\.md$/, ""))
    .sort();
}

const perLocale = {};
for (const locale of LOCALES) {
  if (!fs.existsSync(path.join(KB, locale))) {
    problems.push(`locale 根缺失: ${locale}/`);
    continue;
  }
  const chapters = chapterSlugs(locale);
  perLocale[locale] = { chapters, docs: new Map() };

  for (const ch of chapters) {
    if (!isLegalSlug(ch)) problems.push(`章节 slug 非法: ${locale}/${ch}`);
    const docs = docSlugs(locale, ch);
    perLocale[locale].docs.set(ch, docs);
    for (const d of docs) {
      if (d === README.replace(/\.md$/, "")) continue; // 章首页不计入课程
      docTotal += 1;
      if (!isLegalSlug(d))
        problems.push(`课程 slug 非法: ${locale}/${ch}/${d}.md`);
    }
    for (const c of findIdentityConflicts(chapters)) {
      problems.push(`章节身份冲突(${c.why}): ${locale}/${c.a} ↔ ${c.b}`);
    }
    for (const c of findIdentityConflicts(docs)) {
      problems.push(`课程身份冲突(${c.why}): ${locale}/${ch}/${c.a} ↔ ${c.b}`);
    }
  }
}

// 跨语言：共享章节内，同身份键必须逐字同 slug
const zhDocs = perLocale.zh.docs;
const enDocs = perLocale.en.docs;
for (const ch of [...zhDocs.keys()].sort()) {
  if (!enDocs.has(ch)) continue;
  for (const c of crossLocaleSlugConflicts(zhDocs.get(ch), enDocs.get(ch))) {
    problems.push(
      `双语 slug 冲突(${c.why}): ${ch}/ zh「${c.zh}」↔ en「${c.en}」`,
    );
  }
}

if (problems.length > 0) {
  console.error(`❌ slug 冲突检查失败：${problems.length} 个问题`);
  for (const p of problems) console.error(`  - ${p}`);
  console.error("kb:update 后若出现上述漂移，请先在 kline-buty 修正 slug 再同步。");
  process.exit(1);
}
console.log(
  `✅ slug 零冲突：zh/en 各 ${perLocale.zh.chapters.length}/${perLocale.en.chapters.length} 章 · 课程 ${docTotal} · 双语镜像逐字一致`,
);
