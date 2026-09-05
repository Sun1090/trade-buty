/**
 * R6.6：知识库图片 alt 检查——无障碍 + SEO。
 * - `![](...)` 空 alt → exit 1（当前知识库 0 例，防回归）
 * - 首行已含「图：」等描述视为合格
 * 用法：npm run check:image-alt
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

const missing = [];
let total = 0;
for (const file of walk(KB)) {
  const rel = path.relative(root, file);
  const lines = fs.readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    const re = /!\[([^\]]*)\]\(([^)]+)\)/g;
    let m;
    while ((m = re.exec(line)) !== null) {
      total++;
      if (!m[1].trim()) missing.push(`${rel}:${i + 1}  ${m[2].slice(0, 60)}`);
    }
  });
}

if (missing.length > 0) {
  console.error(`❌ ${missing.length}/${total} 张图片缺少 alt 文本：`);
  console.error(missing.join("\n"));
  process.exit(1);
}
console.log(`✅ 图片 alt 检查通过（${total} 张图片均有描述）`);
