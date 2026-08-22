import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const knowledgeRoot = path.join(root, "content/kline-buty/docs/knowledge");
const outFile = path.join(root, "public/search-index.json");

function assertKnowledgeRoot() {
  if (!fs.existsSync(knowledgeRoot)) {
    console.error(
      "[search-index] 知识库缺失：请先执行 git submodule update --init"
    );
    process.exit(1);
  }
}

function stripMarkdown(md) {
  return md
    .replace(/^---[\s\S]*?---/, "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*`~|_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseTitle(raw, fallback) {
  const fm = raw.match(/^---\n([\s\S]*?)\n---/);
  if (fm) {
    const t = fm[1].match(/^title:\s*(.+)$/m);
    if (t && t[1].trim()) return t[1].trim().replace(/^["']|["']$/g, "");
  }
  const h1 = raw.match(/^#\s+(.+)$/m);
  return h1 ? h1[1].trim() : fallback;
}

/** frontmatter title 的前导序号，用于章内排序 */
function orderOf(raw) {
  const t = parseTitle(raw, "");
  const m = t.match(/^(\d+)/);
  return m ? Number(m[1]) : 999;
}

function main() {
  assertKnowledgeRoot();
  const entries = [];

  for (const locale of ["zh", "en"]) {
    const localeRoot = path.join(knowledgeRoot, locale);
    if (!fs.existsSync(localeRoot)) continue;
    const chapters = fs
      .readdirSync(localeRoot, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();

    for (const chapterSlug of chapters) {
      const dir = path.join(localeRoot, chapterSlug);
      // 篇章导语（标题取 README H1）
      let chapterTitle = chapterSlug;
      try {
        const raw = fs.readFileSync(path.join(dir, "README.md"), "utf8");
        const h1 = raw.match(/^#\s+(.+)$/m);
        if (h1) chapterTitle = h1[1].trim();
        entries.push({
          url: `/${locale}/knowledge/${chapterSlug}`,
          title: chapterTitle,
          chapter: chapterTitle,
          text: stripMarkdown(raw).slice(0, 2500),
        });
      } catch {
        // 导语缺失，宽容跳过
      }

      const files = fs
        .readdirSync(dir)
        .filter((f) => f.endsWith(".md") && f !== "README.md");
      // 按 frontmatter title 前导序号排序
      const withOrder = files.map((file) => {
        const raw = fs.readFileSync(path.join(dir, file), "utf8");
        return { file, raw, order: orderOf(raw) };
      });
      withOrder.sort((a, b) => a.order - b.order);

      for (const { file, raw } of withOrder) {
        const docSlug = file.replace(/\.md$/, "");
        entries.push({
          url: `/${locale}/knowledge/${chapterSlug}/${docSlug}`,
          title: parseTitle(raw, file.replace(/\.md$/, "")),
          chapter: chapterTitle,
          text: stripMarkdown(raw).slice(0, 2500),
        });
      }
    }
  }

  fs.writeFileSync(outFile, JSON.stringify(entries));
  console.log(`[search-index] ${entries.length} 条索引已生成`);
}

main();
