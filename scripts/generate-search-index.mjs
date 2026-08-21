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
    .replace(/^---[\s\S]*?---/, "") // frontmatter
    .replace(/```[\s\S]*?```/g, " ") // 代码块
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // 图片
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // 链接保留文字
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

function main() {
  assertKnowledgeRoot();
  const chapters = fs
    .readdirSync(knowledgeRoot, { withFileTypes: true })
    .filter((e) => e.isDirectory() && /^\d{2}-/.test(e.name))
    .map((e) => e.name)
    .sort();

  const entries = [];
  for (const dir of chapters) {
    const num = dir.slice(0, 2);
    const chapterTitle = dir.replace(/^\d{2}-/, "");
    // 篇章导语本身也可搜
    try {
      const raw = fs.readFileSync(
        path.join(knowledgeRoot, dir, "README.md"),
        "utf8"
      );
      entries.push({
        url: `/knowledge/${num}`,
        title: `${num} ${chapterTitle}（篇章导语）`,
        chapter: chapterTitle,
        text: stripMarkdown(raw.replace(/^---[\s\S]*?---/, "")).slice(0, 2500),
      });
    } catch {
      // 导语缺失，宽容跳过
    }
    const files = fs
      .readdirSync(path.join(knowledgeRoot, dir))
      .filter((f) => f.endsWith(".md") && f !== "README.md")
      .sort();
    for (const file of files) {
      const raw = fs.readFileSync(path.join(knowledgeRoot, dir, file), "utf8");
      const slugMatch = file.match(/^(\d{2})-/);
      const docSlug = slugMatch ? slugMatch[1] : encodeURIComponent(file.replace(/\.md$/, ""));
      entries.push({
        url: `/knowledge/${num}/${docSlug}`,
        title: parseTitle(raw, file.replace(/\.md$/, "")),
        chapter: chapterTitle,
        text: stripMarkdown(raw.replace(/^---[\s\S]*?---/, "")).slice(0, 2500),
      });
    }
  }

  fs.writeFileSync(outFile, JSON.stringify(entries));
  console.log(`[search-index] ${entries.length} 条索引已生成`);
}

main();
