/**
 * R16.50：跨语言组件里的静态文案属性不得写死单一语言。
 *
 * `title` / `aria-label` / `alt` / `placeholder` / `label` 这类属性的值会原样出现在
 * **另一种语言**的界面上：`src/components/read-aloud.tsx` 的 `title="语速"` 就是在英文
 * 界面里冒出中文提示。此前手工清过一轮写死的可访问名称，没有门禁所以又长回来一处，
 * 因此这条巡检把「字面量里含中日韩文字」的写法钉成失败——值必须来自 prop 或 locale 分支。
 *
 * 只扫 `src` 下的 `.tsx`（测试文件除外）：测试夹具本身就是中文用例，扫它只会逼人改夹具。
 * 判据只看「字面量含中日韩文字」——把英文写死在同一处同样是错的，但那是 ASCII，
 * 这条巡检认不出来，得靠用例（`read-aloud.test.tsx` 按 locale 断言提示文字）。
 *
 * 退出码非 0 表示违规。运行：npm run check:localized-labels
 */
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** 会被屏幕阅读器或提示气泡直接念出来的静态属性，值必须是带引号的字面量 */
const ATTR_RE = /(?:^|[\s({,])(title|aria-label|alt|placeholder|label)=(?:"([^"]*)"|'([^']*)')/g;

/** 中日韩文字：命中即认为这条字面量是某一种语言写死的 */
const CJK_RE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;

/** 逐行找出写死单一语言的文案属性（行注释与块注释行跳过） */
export function scanSource(source) {
  const hits = [];
  source.split("\n").forEach((text, index) => {
    const trimmed = text.trimStart();
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return;
    for (const match of text.matchAll(ATTR_RE)) {
      const value = match[2] ?? match[3] ?? "";
      if (CJK_RE.test(value)) hits.push({ line: index + 1, attr: match[1], value });
    }
  });
  return hits;
}

function tsxFiles(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) tsxFiles(full, out);
    else if (entry.name.endsWith(".tsx") && !entry.name.endsWith(".test.tsx")) out.push(full);
  }
  return out;
}

/** 扫一棵源码树，返回每个文件的违规点 */
export function findUnlocalizedLabels(srcDir) {
  return tsxFiles(srcDir)
    .map((file) => ({ file: relative(root, file), hits: scanSource(readFileSync(file, "utf8")) }))
    .filter((entry) => entry.hits.length > 0);
}

export function main() {
  const offenders = findUnlocalizedLabels(join(root, "src"));
  if (offenders.length === 0) {
    console.log("[localized-labels] ✅ 跨语言组件里没有写死单一语言的文案属性");
    return;
  }
  for (const entry of offenders) {
    for (const hit of entry.hits) {
      console.error(
        `[localized-labels] ${entry.file}:${hit.line} ${hit.attr}="${hit.value}" — 这个值会原样出现在另一种语言的界面上`,
      );
    }
  }
  console.error(
    `[localized-labels] 共 ${offenders.length} 个文件违规：把字面量改成按 locale 取的 prop（例：label={locale === "en" ? "Speaking rate" : "语速"}）`,
  );
  process.exit(1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
