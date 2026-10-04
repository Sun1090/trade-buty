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
 * - 分享卡的降级图：payload 解码失败时访客语言无从判定（正常的三张卡都按 `p.locale` 出文案，
 *   课程页的 OG 卡也已在 R16.51 改按 locale），要不要把这一张的品牌行改成中英并列见 R16.52。
 *
 * R16.295 从这份清单里移走了根级 `not-found.tsx` / `error.tsx`，**不是因为它们拿到了 locale**
 * （还是 `DEFAULT_LOCALE`，三条路与代价仍然开着，见 R16.41），而是因为这两页原先的毛病
 * 与「语言选哪个」无关：同一张页面上标题写死英文、tagline 写死中文，一句话的中英混搭。
 * 拿不到 locale 只意味着「这一页说哪门语言」，不意味着「这门语言里可以两句话各说一种」。
 * 它们现在与站内所有页面一样按字典取值，因此适用下面第三节那层「同页不得混两种语言」的判据。
 */
export const LOCALE_FREE_SURFACES = [
  ["src", "app", "share", "[kind]", "[path]", "opengraph-image.tsx"].join(sep),
];

/**
 * R16.295：一份文件里不许同时出现中文字面量与英文界面字面量。
 *
 * 为什么单开一节而不并进前三类：前三类的判据是「这一处根本没问语言」，而这一页的每一处
 * **都**取了字典（`getDict(DEFAULT_LOCALE)`），字典是对的——混搭发生在**字典之外**：
 * 有人新加一句时顺手写死，于是标题成了英文、tagline 成了中文，而两条都躺在同一个 `<h1>` 里。
 * 「这一页用哪门语言」是待拍板的产品问题（R16.41/R16.52），**「这一页不许两句话各说一种语言」不是**：
 * 无论最后拍成中英并列还是跟随 URL，它都成立。
 *
 * 判据按**文件**而不是按属性：拿不到 locale 的边界页是少数，按文件判才判得着「这张页面混了」。
 * 判「英文界面字」而不是「英文」：装饰性的品牌名与缩写（FAQ、Trade Buty）天然两种语言都出现。
 */
export const SINGLE_LANGUAGE_FILES = [
  ["src", "app", "not-found.tsx"].join(sep),
  ["src", "app", "error.tsx"].join(sep),
];

function isLocaleFree(relativePath) {
  return LOCALE_FREE_SURFACES.includes(relativePath);
}

/**
 * R16.295 的第四节：一份文件里的界面文案不许中英混搭。
 *
 * 认的是「界面字」而不是「英文」——带拉丁字母又有空格/大小写分词的才是界面文案，
 * `FAQ`、`Trade Buty` 这类品牌名与缩写两种语言都出现，不算混搭。
 *
 * 返回的形状与前三类一致（file + 行号 + 值），好让 `main` 用同一套报错。
 */
export function scanSingleLanguage(source) {
  const stripped = withoutComments(source);
  const literals = [];
  for (const lit of stripped.matchAll(STRING_LITERAL_RE)) {
    const value = lit[1] ?? lit[2] ?? lit[3] ?? "";
    if (!value.trim()) continue;
    literals.push({ value, offset: lit.index });
  }
const textNodes = [];
  for (const match of stripped.matchAll(TEXT_NODE_RE)) {
    const value = match[1].replace(/<[^<>]*>/g, " ").replace(/\s+/g, " ").trim();
    if (value) textNodes.push({ value, offset: match.index + 1 });
  }

  /**
   * 像界面文案：拉丁字母 + 空格 + 没有 `=`。
   *
   * 两条负向判据都是被实测逼出来的：只认「空格」不够，className 的 Tailwind 值
   * （`mt-10 flex flex-wrap justify-center gap-3`）也有空格，第一版因此把八行 className
   * 当英文界面字报出来；于是加 `=` 排除（Tailwind 修饰符与工具类都带 `=`）。
   * 标识符形状的字符串——`FAQ`、`Trade Buty`、`manifest.webmanifest`、本文件自己的报错
   * 文案——没有空格、带斜杠或带 `=`，同样被排除。剩下的就是真会印在页面上的句子。
   */
  // 品牌名与缩写放行：`Trade Buty`、`FAQ` 与两种语言都共处一站，不算「一句英文」。
  // 判据是「含空格但每个词都是首字母大写」——句子很少是这个形状。
  const BRAND_SHAPE_RE = /^(?:[A-Z][A-Za-z0-9]*)(?: [A-Z][A-Za-z0-9]*)*$/;
  const looksLikeUi = (value) =>
    LATIN_RE.test(value) && !CJK_RE.test(value) && value.includes(" ") && !value.includes("=")
    && !BRAND_SHAPE_RE.test(value)
    // 单个词也不是句子（`Retry` / `Search` 这类按钮与链接文案）
    && !/^[A-Z][a-z]+$/.test(value);

  // 中文那一半也走文本节点：属性值里的中文（aria-label="篇章导航" 之类）不算这一页的
  // 界面文案，它属于前三类的射程；从字符串字面量里捞会连门禁自己的报错文案一起捞进来。
  const cjk = textNodes.filter((lit) => CJK_RE.test(lit.value));
  const latin = textNodes.filter((lit) => looksLikeUi(lit.value));
  if (cjk.length === 0 || latin.length === 0) return [];

  const lineAt = (offset) => stripped.slice(0, offset).split("\n").length;
  const hits = [];
  // 报成对的那一方：中文是本地化的主角（「这一处没问语言」），英文那半边是它混进来的。
  // 两边都报会让一条违规变成两条噪音，反而看不出是哪一对。
  for (const lit of cjk) {
    hits.push({ line: lineAt(lit.offset + lit.value.search(CJK_RE)), kind: "mixed", where: "中文文案", value: lit.value });
  }
  for (const lit of latin) {
    hits.push({ line: lineAt(lit.offset), kind: "mixed", where: "英文界面字", value: lit.value });
  }
  return hits.sort((a, b) => a.line - b.line);
}

/** 拿不到 locale 的边界页：查「同页不得中英混搭」，查法与前三类不同故分开 */
export function findMixedLanguageFiles() {
  return SINGLE_LANGUAGE_FILES.map((rel) => {
    const source = readFileSync(join(root, rel), "utf8");
    return { file: rel, hits: scanSingleLanguage(source) };
  }).filter((entry) => entry.hits.length > 0);
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
  const offenders = [
    ...findUnlocalizedLabels(join(root, "src")),
    ...findMixedLanguageFiles(),
  ];
  if (offenders.length === 0) {
    console.log(
      "[localized-labels] ✅ 界面文案没有写死单一语言（属性值、属性表达式里的字面量、JSX 文本节点三类都查了）",
    );
    console.log(
      `[localized-labels] ✅ 拿不到 locale 的 ${SINGLE_LANGUAGE_FILES.length} 个边界页也没有中英混搭（R16.295）`,
    );
    return;
  }
  for (const entry of offenders) {
    for (const hit of entry.hits) {
      const reason = hit.kind === "mixed"
        ? "这一页两种语言各说一句话——无论最后拍成哪一种版式，混搭都不是其中任何一种"
        : "这一处没问语言，却会原样出现在另一种语言的界面上";
      console.error(
        `[localized-labels] ${entry.file}:${hit.line} ${hit.where} = "${hit.value}" — ${reason}`,
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
