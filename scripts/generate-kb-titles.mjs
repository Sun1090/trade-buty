import fs from "node:fs";
import path from "node:path";

/**
 * 生成知识库标题映射（供 edge runtime 使用，不能碰 fs/gray-matter 的地方读它）。
 * 输出: src/lib/kb-titles.json { [locale]: { [chapterSlug]: { title, docs: { [docSlug]: title } } } }
 * 用法: npm run prebuild 的一部分；生成文件不入库（.gitignore）。
 */
const root = process.cwd();
const knowledgeRoot = path.join(root, "content/kline-buty/docs/knowledge");
const outFile = path.join(root, "src/lib/kb-titles.json");

function parseTitle(raw, fallback) {
  const fm = raw.match(/^---\n([\s\S]*?)\n---/);
  if (fm) {
    const t = fm[1].match(/^title:\s*(.+)$/m);
    if (t && t[1].trim()) return t[1].trim().replace(/^["']|["']$/g, "");
  }
  const h1 = raw.match(/^#\s+(.+)$/m);
  return h1 ? h1[1].trim() : fallback;
}

function main() {
  if (!fs.existsSync(knowledgeRoot)) {
    console.error("[kb-titles] 知识库缺失：请先 git submodule update --init");
    process.exit(1);
  }
  const out = {};
  for (const locale of ["zh", "en"]) {
    const localeRoot = path.join(knowledgeRoot, locale);
    if (!fs.existsSync(localeRoot)) continue;
    out[locale] = {};
    const chapters = fs
      .readdirSync(localeRoot, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
    for (const chapter of chapters) {
      const dir = path.join(localeRoot, chapter);
      let title = chapter;
      try {
        const raw = fs.readFileSync(path.join(dir, "README.md"), "utf8");
        const h1 = raw.match(/^#\s+(.+)$/m);
        if (h1) title = h1[1].trim();
      } catch {
        // 宽容跳过
      }
      const docs = {};
      for (const f of fs.readdirSync(dir)) {
        if (!f.endsWith(".md") || f === "README.md") continue;
        const raw = fs.readFileSync(path.join(dir, f), "utf8");
        docs[f.replace(/\.md$/, "")] = parseTitle(raw, f.replace(/\.md$/, ""));
      }
      out[locale][chapter] = { title, docs };
    }
  }
  fs.writeFileSync(outFile, JSON.stringify(out));
  const n = Object.values(out).reduce(
    (s, ch) => s + Object.values(ch).reduce((a, c) => a + Object.keys(c.docs).length, 0),
    0
  );
  console.log(`[kb-titles] ${n} 篇标题已生成`);
}

main();
