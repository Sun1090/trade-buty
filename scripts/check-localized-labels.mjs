/**
 * R16.50 / R16.51：跨语言界面里的静态文案不得写死单一语言。
 *
 * 三类写法会被这道巡检钉住：
 * 1. **属性值**——`title` / `aria-label` / `alt` / `placeholder` / `label` 会被屏幕阅读器
 *    和提示气泡直接念出来，写死中文就是让英文界面冒中文（`read-aloud` 的 `title="语速"` 是第一例）；
 * 2. **JSX 文本节点**——`>…<` 之间的裸文字（复习页一次有七条界面字没问语言，其中五处正是这个
 *    形状，是第二例）。
 *    走表达式的写法 `{locale === "en" ? "Back" : "返回"}` 天然不在这个形状里，所以不会被误伤：
 *    判据是「这一处根本没问语言」，而不是「这里是中文」。
 * 3. **属性表达式里的字符串字面量**——`label={{ enter: "全屏", exit: "退出" }}` 把文案裹进
 *    对象字面量，前两类的形状都套不上它（值不是引号字面量，也不是 `>…<` 之间的裸文字），
 *    而它和写死在引号里做的是同一件事。图表页的全屏按钮是第一例。这一类认内容不认变量名：
 *    一条中文字面量只有在**紧邻**位置（`?` / `:` 之间）摆着另一种说法时才放行，
 *    所以 `title={en ? "Calendar" : "日历"}` 不管别名怎么写都不误伤，
 *    而 `labels={{ share: "Share", preview: "预览卡面" }}` 这种一半一半的会报出来。
 *
 * 手工清过一轮写死的可访问名称之后没有门禁，所以同一类又长回来——这条巡检补的是那一层。
 *
 * 两个已知盲区，写清楚而不是假装没有：
 * - 判据只看中日韩文字，把**英文**写死在同一处它认不出来（ASCII 没有语言特征），
 *   那半边靠按 locale 的用例兜（`review-client.test.tsx`、`ai-chapter-quiz.test.tsx`、
 *   `kline-chart.test.tsx` 的读屏名字一条）；
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

/** 属性表达式（`foo={{ … }}` / `foo={fn(…)}`）：从 `={` 之后一路看到行尾 */
const ATTR_EXPR_RE = /(?:^|[\s({,])([\w-]+)=\{/g;

/** 表达式里的字符串字面量（单引号、双引号、反引号，不跨行） */
const STRING_LITERAL_RE = /"([^"\\\n]*)"|'([^'\\\n]*)'|`([^`\\\n]*)`/g;

/** 拉丁字母：一条字面量里有它，就算它提供了另一种语言的写法 */
const LATIN_RE = /[A-Za-z]/;

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

/**
 * 取一个 JSX 属性表达式的正文：从 `={` 的 `{` 之后一路扫到配对的 `}`。
 * 字符串里出现的花括号不算深度（`{{ enter: "全屏" }}` 的两层 `{` 都要数），
 * 扫到文件末尾还没配平就返回 null——宁可放过，不要猜半截表达式。
 */
function expressionBody(source, from) {
  let depth = 1;
  let quote = "";
  for (let i = from; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (ch === "\\") i += 1;
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") quote = ch;
    else if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(from, i);
    }
  }
  return null;
}

/** 一条字面量是不是「备好了另一种说法」的另一半：带拉丁字母、且不含中日韩文字 */
function isOtherLanguage(value) {
  return LATIN_RE.test(value) && !CJK_RE.test(value);
}

/**
 * 属性表达式里的中文字面量。
 *
 * 「问了语言」在这一带的写法是把两种语言并排摆出来（`en ? "Calendar" : "日历"`、
 * `locale === "zh" ? "返回" : "Back"`），变量名各站不同，所以认内容不认变量：
 * 一条中文字面量只有在**紧邻**的位置上（`?` / `:` 之间）有一条另一种语言的字面量作伴时才算问过语言。
 * `{{ enter: "全屏", exit: "退出" }}` 里没有这种配对——它把中文写死了两次。
 */
function attrExprHits(stripped, push) {
  for (const match of stripped.matchAll(ATTR_EXPR_RE)) {
    const from = match.index + match[0].length;
    const body = expressionBody(stripped, from);
    if (body === null) continue;
    const literals = [];
    for (const lit of body.matchAll(STRING_LITERAL_RE)) {
      literals.push({
        value: lit[1] ?? lit[2] ?? lit[3] ?? "",
        start: lit.index,
        end: lit.index + lit[0].length,
      });
    }
    literals.forEach((lit, i) => {
      if (!CJK_RE.test(lit.value)) return;
      const paired = [literals[i - 1], literals[i + 1]].some((neighbor) => {
        if (!neighbor || !isOtherLanguage(neighbor.value)) return false;
        const [first, second] = neighbor.start < lit.start ? [neighbor, lit] : [lit, neighbor];
        return /^[?:\s]*$/.test(body.slice(first.end, second.start));
      });
      if (paired) return;
      push({
        kind: "attrExpr",
        where: `${match[1]}={…}`,
        value: lit.value,
        offset: from + lit.start + lit.value.search(CJK_RE),
      });
    });
  }
}

/** 一个文件里的三类违规：属性值、属性表达式里的字面量、JSX 文本节点 */
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
  attrExprHits(stripped, ({ offset, ...hit }) => hits.push({ line: lineAt(offset), ...hit }));
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
    console.log(
      "[localized-labels] ✅ 界面文案没有写死单一语言（属性值、属性表达式里的字面量、JSX 文本节点三类都查了）",
    );
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
