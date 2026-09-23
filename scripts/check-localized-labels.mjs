/**
 * R16.50 / R16.51：跨语言界面里的静态文案不得写死单一语言。
 *
 * 两类写法会被这道巡检钉住：
 * 1. **属性值**——`title` / `aria-label` / `alt` / `placeholder` / `label` 会被屏幕阅读器
 *    和提示气泡直接念出来，写死中文就是让英文界面冒中文（`read-aloud` 的 `title="语速"` 是第一例）；
 * 2. **JSX 文本节点**——`>…<` 之间的裸文字（复习页一次有七条界面字没问语言，其中五处正是这个
 *    形状，是第二例）。
 *    走表达式的写法 `{locale === "en" ? "Back" : "返回"}` 天然不在这个形状里，所以不会被误伤：
 *    判据是「这一处根本没问语言」，而不是「这里是中文」。
 *
 * 手工清过一轮写死的可访问名称之后没有门禁，所以同一类又长回来——这条巡检补的是那一层。
 *
 * 两个已知盲区，写清楚而不是假装没有：
 * - 判据只看中日韩文字，把**英文**写死在同一处它认不出来（ASCII 没有语言特征），
 *   那半边靠按 locale 的用例兜（`review-client.test.tsx`、`ai-chapter-quiz.test.tsx`）；
 * - `LOCALE_FREE_SURFACES` 里那几个文件拿不到 locale，各自的归属见清单注释。
 *
 * 退出码非 0 表示违规。运行：npm run check:localized-labels
 */
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, sep } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** 会被屏幕阅读器或提示气泡直接念出来的静态属性，值必须是带引号的字面量 */
const ATTR_RE = /(?:^|[\s({,])(title|aria-label|alt|placeholder|label)=(?:"([^"]*)"|'([^']*)')/g;

/** JSX 文本节点：`>` 与 `<` 之间、不含标签与表达式的裸文字 */
const TEXT_NODE_RE = />([^<>{}]*)</g;

/** 中日韩文字：命中即认为这一处是按某一种语言写死的 */
const CJK_RE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;

/**
 * 拿不到 locale 的表面，逐条写明归属：
 * - 根级 `not-found.tsx` / `error.tsx`：整页在 `[locale]` 之外，语言无从判定，
 *   三条备选路与代价见 docs/roadmap.md 的 R16.41；
 * - 分享卡的降级图：payload 解码失败时访客语言无从判定（正常的三张卡都按 `p.locale` 出文案，
 *   课程页的 OG 卡也已在 R16.51 改按 locale），要不要把这一张的品牌行改成中英并列见 R16.52。
 */
export const LOCALE_FREE_SURFACES = [
  ["src", "app", "not-found.tsx"].join(sep),
  ["src", "app", "error.tsx"].join(sep),
  ["src", "app", "share", "[kind]", "[path]", "opengraph-image.tsx"].join(sep),
];

function isLocaleFree(relativePath) {
  return LOCALE_FREE_SURFACES.includes(relativePath);
}

/** 去掉块注释与行注释，避免注释里的示例被当成界面文案 */
function withoutComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//"))
    .join("\n");
}

/** 一个文件里的两类违规：属性值与 JSX 文本节点 */
export function scanSource(source) {
  const hits = [];
  source.split("\n").forEach((text, index) => {
    const trimmed = text.trimStart();
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return;
    for (const match of text.matchAll(ATTR_RE)) {
      const value = match[2] ?? match[3] ?? "";
      if (CJK_RE.test(value)) hits.push({ line: index + 1, kind: "attr", where: match[1], value });
    }
  });
  const stripped = withoutComments(source);
  const lineAt = (offset) => stripped.slice(0, offset).split("\n").length;
  for (const match of stripped.matchAll(TEXT_NODE_RE)) {
    const value = match[1];
    if (!value.trim() || !CJK_RE.test(value)) continue;
    hits.push({
      // 行号取中文真正落在哪一行：匹配从 `>` 起算，文本可能已经在下一行
      line: lineAt(match.index + 1 + value.search(CJK_RE)),
      kind: "text",
      where: "JSX 文本",
      value: value.replace(/\s+/g, " ").trim(),
    });
  }
  return hits.sort((a, b) => a.line - b.line);
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

/** 扫一棵源码树，返回每个文件的违规点（跳过拿不到 locale 的表面） */
export function findUnlocalizedLabels(srcDir) {
  return tsxFiles(srcDir)
    .map((file) => ({ file: relative(root, file), source: readFileSync(file, "utf8") }))
    .filter((entry) => !isLocaleFree(entry.file))
    .map((entry) => ({ file: entry.file, hits: scanSource(entry.source) }))
    .filter((entry) => entry.hits.length > 0);
}

export function main() {
  const offenders = findUnlocalizedLabels(join(root, "src"));
  if (offenders.length === 0) {
    console.log("[localized-labels] ✅ 界面文案没有写死单一语言（属性与 JSX 文本节点两类都查了）");
    return;
  }
  for (const entry of offenders) {
    for (const hit of entry.hits) {
      console.error(
        `[localized-labels] ${entry.file}:${hit.line} ${hit.where} = "${hit.value}" — 这一处没问语言，却会原样出现在另一种语言的界面上`,
      );
    }
  }
  console.error(
    `[localized-labels] 共 ${offenders.length} 个文件违规：改成按 locale 取的表达式或词条` +
      `（例：{locale === "en" ? "Back" : "返回"}，或走 src/lib/i18n.ts 的字典）`,
  );
  process.exit(1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
