/**
 * R3.12：双语话术复核——扫描 i18n.ts 的 en 字典是否残留中文文案。
 * 退出码非 0 表示有残留，供 CI 门禁使用。运行：npm run check:ai-copy
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
// R12.22：stats 字典已拆分到 i18n-stats.ts，两文件的 en 块都要扫描
const files = ["src/lib/i18n.ts", "src/lib/i18n-stats.ts"];
let enBlock = "";
for (const file of files) {
  const src = readFileSync(join(root, file), "utf8");
  const match = /const en: [A-Za-z]+ = \{/.exec(src);
  if (!match) {
    console.error(`❌ ${file} 未找到 en 字典`);
    process.exit(1);
  }
  const start = match.index;
  const end = src.indexOf("};", start);
  enBlock += src.slice(start, end) + "\n";
}

// 所有单/双/反引号字符串字面量中的 CJK
const violations = [];
const re = /(['"`])((?:\\.|(?!\1)[\s\S])*)\1/g;
let m;
const hasCJK = (s) => /[\u4e00-\u9fff\u3400-\u4dbf]/.test(s);
while ((m = re.exec(enBlock)) !== null) {
  if (hasCJK(m[2])) {
    const line = enBlock.slice(0, m.index).split("\n").length;
    violations.push(`  en 字典第 ${line} 行: ${m[2].slice(0, 60)}`);
  }
}

if (violations.length > 0) {
  console.error(`❌ en 字典残留中文文案 ${violations.length} 处：`);
  console.error(violations.join("\n"));
  process.exit(1);
} else {
  console.log("✅ en 字典无中文残留（R3.12 通过）");
}
