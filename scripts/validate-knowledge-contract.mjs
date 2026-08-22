import fs from "node:fs";
import path from "node:path";

/**
 * 知识库契约校验（宽容模式：只报警不失败）。
 * 契约见 AGENTS.md「知识库契约」：
 * 1. docs/knowledge/{zh,en}/ 双语根；zh 应完整 27 篇章，en 允许逐步补齐
 * 2. 篇章为英文 slug 目录，内含 README.md（H1 标题格式 NN · 名称）
 * 3. 课程文件名为英文 slug .md，frontmatter title 带前导序号
 */
const knowledgeRoot = path.join(
  process.cwd(),
  "content/kline-buty/docs/knowledge"
);

let warnings = 0;
function warn(msg) {
  console.warn(`[contract] ⚠ ${msg}`);
  warnings++;
}

if (!fs.existsSync(knowledgeRoot)) {
  console.error(
    "[contract] ✗ content/kline-buty/docs/knowledge 不存在，请先 git submodule update --init"
  );
  process.exit(1);
}

for (const locale of ["zh", "en"]) {
  const root = path.join(knowledgeRoot, locale);
  if (!fs.existsSync(root)) {
    warn(`${locale} 语言根目录缺失`);
    continue;
  }
  const chapters = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== "scripts");
  if (chapters.length === 0) {
    warn(`${locale}: 没有任何篇章目录`);
    continue;
  }
  if (locale === "zh" && chapters.length !== 27) {
    warn(`zh 篇章数 ${chapters.length} ≠ 27`);
  }
  if (/[^a-z0-9-]/.test(chapters.map((c) => c.name).join(""))) {
    for (const c of chapters) {
      if (!/^[a-z0-9-]+$/.test(c.name))
        warn(`篇章目录应为英文 slug: ${locale}/${c.name}`);
    }
  }
  for (const c of chapters) {
    const full = path.join(root, c.name);
    const readme = path.join(full, "README.md");
    if (!fs.existsSync(path.join(full, "README.md"))) {
      warn(`篇章缺少 README.md: ${locale}/${c.name}`);
    }
    for (const f of fs.readdirSync(full)) {
      if (!f.endsWith(".md") || f === "README.md") continue;
      if (!/^[a-z0-9-]+\.md$/.test(f)) {
        warn(`课程文件名应为英文 slug: ${locale}/${c.name}/${f}`);
        continue;
      }
      const raw = fs.readFileSync(path.join(full, f), "utf8");
      if (!raw.startsWith("---")) {
        warn(`缺 frontmatter（标题与描述已降级处理）: ${locale}/${c.name}/${f}`);
        continue;
      }
      const fm = raw.slice(4, raw.indexOf("\n---", 3));
      if (!/^title:/m.test(fm)) warn(`frontmatter 缺 title: ${locale}/${c.name}/${f}`);
      if (!/^description:/m.test(fm)) warn(`frontmatter 缺 description: ${locale}/${c.name}/${f}`);
    }
  }
}

console.log(
  warnings === 0
    ? "[contract] ✓ 知识库契约校验通过"
    : `[contract] 校验完成，${warnings} 条警告（宽容模式，构建继续）`
);
