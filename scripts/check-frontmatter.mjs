/**
 * R6.5：frontmatter 质量检查——description 过短影响 SEO。
 * - 缺 title / description → exit 1
 * - description < 15 字符 → exit 1（过短报警）
 *
 * R16.83：这道检查的分母是知识库里的 md 文件。子模块没 init、目录被改名时 walk 返回
 * 空数组，于是「0 处问题」被打印成绿色通过——而 AGENTS.md 明确要求「构建前确认
 * content/kline-buty/docs/knowledge 存在，缺失要报错而不是发空页」。现在缺根目录直接
 * 失败，扫到的文件数也要过下限并写在结论里。
 *
 * 用法：npm run check:frontmatter
 */
import fs from "node:fs";
import path from "node:path";
import { scanFloorViolation } from "./scan-floor-lib.mjs";

const root = process.cwd();
const KB = path.join(root, "content/kline-buty/docs/knowledge");
/** 实测（2026-09-24）zh+en 两棵树共 419 个 md；低于此下限只会是扫描坏了，不会是上游删了两成课文。 */
const MIN_KB_FILES = 400;

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".md")) out.push(p);
  }
  return out;
}

if (!fs.existsSync(KB)) {
  console.error(`❌ 知识库根目录不存在：${path.relative(root, KB)}——先跑 git submodule update --init`);
  console.error("   没有内容时这道检查只会对着空集合判绿，而站上会直接是空页（AGENTS.md「Submodule Operations」）。");
  process.exit(1);
}

const walked = walk(KB);
const shrunk = scanFloorViolation({ count: walked.length, floor: MIN_KB_FILES, what: "知识库 md 文件" });
if (shrunk) {
  console.error(`❌ ${shrunk}`);
  process.exit(1);
}

const issues = [];
let audited = 0;
for (const file of walked) {
  // 章节 README（导读）按契约走 H1 标题回退，不要求 frontmatter
  if (file.endsWith("README.md")) continue;
  audited += 1;
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
console.log(
  `✅ frontmatter 检查通过：扫到 ${walked.length} 个 md（要求 ${audited} 篇课文 title/description 齐全且长度达标）`,
);
