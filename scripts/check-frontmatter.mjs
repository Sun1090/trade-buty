/**
 * R6.5：frontmatter 质量检查——description 过短影响 SEO。
 * - 缺 title / description → exit 1
 * - description < 15 字符 → exit 1（过短报警）
 * 用法：npm run check:frontmatter
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const KB = path.join(root, "content/kline-buty/docs/knowledge");

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".md")) out.push(p);
  }
  return out;
}

const issues = [];
for (const file of walk(KB)) {
  // 章节 README（导读）按契约走 H1 标题回退，不要求 frontmatter
  if (file.endsWith("README.md")) continue;
  const rel = path.relative(root, file);
  const content = fs.readFileSync(file, "utf8");
  const m = content.match(/^---\n([\s\S]*?)\n---/);
  if (!m) {
    issues.push(`${rel}: 缺少 frontmatter`);
    continue;
  }
  const fm = m[1];
  const title = fm.match(/^title:\s*(.+)$/m)?.[1]?.trim();
  const desc = fm.match(/^description:\s*(.+)$/m)?.[1]?.trim();
  if (!title) issues.push(`${rel}: 缺 title`);
  if (desc === undefined) issues.push(`${rel}: 缺 description`);
  else if (desc.length < 15) issues.push(`${rel}: description 过短（${desc.length} < 15 字符）——影响 SEO`);
}

if (issues.length > 0) {
  console.error(`❌ frontmatter 质量问题 ${issues.length} 处：`);
  console.error(issues.join("\n"));
  process.exit(1);
}
console.log("✅ frontmatter 检查通过（title/description 齐全且长度达标）");
