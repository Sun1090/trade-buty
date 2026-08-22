import fs from "node:fs";
import path from "node:path";

/**
 * 知识库契约校验（宽容模式：只报警不失败）。
 * 契约见 AGENTS.md「知识库契约」：
 * 1. 篇章目录名以两位数字开头 NN-名称/
 * 2. 每个篇章目录内有 README.md
 * 3. 课程文件名以两位数字开头（章内序号，NN-标题.md）
 * 4. frontmatter 含 title 与 description
 */
const root = process.cwd();
const knowledgeRoot = path.join(root, "content/kline-buty/docs/knowledge");

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

function frontmatterOf(raw) {
  if (!raw.startsWith("---")) return null;
  const end = raw.indexOf("\n---", 3);
  if (end < 0) return null;
  return raw.slice(4, end);
}

const entries = fs.readdirSync(knowledgeRoot, { withFileTypes: true });
const chapterDirs = entries.filter(
  (e) => e.isDirectory() && e.name !== "scripts" // 知识库自带维护脚本目录
);
const numbered = chapterDirs.filter((e) => /^\d{2}-/.test(e.name));

if (numbered.length === 0) {
  warn("没有任何以两位数字开头的篇章目录——结构可能已重构，站点将渲染为空");
} else if (numbered.length < chapterDirs.length) {
  for (const d of chapterDirs) {
    if (!/^\d{2}-/.test(d.name)) warn(`篇章目录不符合 NN- 约定，将被跳过: ${d.name}`);
  }
}

for (const dir of numbered) {
  const full = path.join(knowledgeRoot, dir.name);
  if (!fs.existsSync(path.join(full, "README.md"))) {
    warn(`篇章缺少 README.md（导语将缺失）: ${dir.name}`);
  }
  for (const f of fs.readdirSync(full)) {
    if (!f.endsWith(".md") || f === "README.md") continue;
    if (!/^\d{2}-/.test(f)) {
      warn(`课程文件名未以两位数字开头（URL slug 将退化为 URL 编码）: ${dir.name}/${f}`);
      continue;
    }
    const raw = fs.readFileSync(path.join(full, f), "utf8");
    const fm = frontmatterOf(raw);
    if (fm === null) {
      warn(`缺 frontmatter（标题与描述已降级处理）: ${dir.name}/${f}`);
      continue;
    }
    if (!/^title:/m.test(fm)) warn(`frontmatter 缺 title: ${dir.name}/${f}`);
    if (!/^description:/m.test(fm)) warn(`frontmatter 缺 description: ${dir.name}/${f}`);
  }
}

console.log(
  warnings === 0
    ? `[contract] ✓ 知识库契约校验通过（${numbered.length} 个篇章）`
    : `[contract] 校验完成，${warnings} 条警告（宽容模式，构建继续）`
);
