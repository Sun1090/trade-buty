/** Markdown 纯函数工具——从 content.ts 抽出，可独立测试 */

/**
 * 把一小段 markdown 收成纯文本：只处理「会被当成界面文案」的那几种写法。
 *
 * 课文正文走 `rewriteLinks`（`content.ts`）把相对链接换成站内路由，但**导语与摘要**
 * 不走那条路——它们是从原文里截出来的，链接语法就原样留在卡片文字和
 * `<meta name="description">` 里（`forex-trading/README.md:3` 那一条把
 * `[09-市场与品种专题篇/01-外汇市场.md](…)` 送进了 22 个页面的可见文字）。
 * 内容仓的原文不该改（那是 kline-buty 的地盘），所以在本侧把它读成人类看得懂的话。
 *
 * 已知取舍：反引号只删记号、不保护内容，尖括号清理又跑在删记号之前，所以 `` `<br>` `` 这种
 * 「行内代码里写着尖括号」会连同里面的字一起被吃掉。全仓首段与 description 里没有任何一处
 * 这种写法（扫描用例逐条核过），因此不做代码区间保护。
 *
 * 尖括号那一步写成扫描（`dropAngleSpans`）而不是 `/<[^>]*>/` 之类的正则，原因有二。其一是
 * 正确性：一条标签形状的正则挡不住没闭合的 `<script`，也挡不住 `<scr<scriptipt>` 这种删完
 * 一段又拼回一个标签的写法。其二是工具信号：CodeQL 的 incomplete-html-sanitization 只看正则
 * 本身长得像不像消毒器，不看后面还跟着什么步骤，凡模式里带 `<…>` 形状就判「值里可能还剩
 * `<script`」——实测换过两种写法各报一轮。而这里要的从来不是消毒：这批字符串只流向 React
 * 文本节点与 `<meta content>`（两处都转义），本不构成注入，但半消毒的值比没消毒更危险，
 * 它会让人以为可以往别处送。实测当前内容里首段与摘要没有一个含尖括号（zh/en 两棵树下 0
 * 命中），所以这一步不改变任何一句真实文案。
 */
export function plainText(input: string): string {
  return dropAngleSpans(
    input
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // 内联链接 [文字](地址)
      .replace(/\[([^\]]*)\]\[[^\]]*\]/g, "$1"), // 引用式链接 [文字][标签]
  )
    .replace(/`/g, "") // 行内代码的反引号
    .replace(/\s+/g, " ")
    .trim();
}

/** 裸链接只脱壳：`<https://a.b>` 里的地址要留在文案里 */
const BARE_LINK_RE = /^\s*https?:\/\/\S+\s*$/i;

/**
 * 成对尖括号整段去掉（`<b>x</b>` → `x`），落单的尖括号只删自己（`a < b` → `a  b`）。
 * 写成逐字符扫描，是为了让「不留尖括号」这件事不依赖任何含尖括号的正则——见 `plainText` 的说明。
 */
function dropAngleSpans(input: string): string {
  let out = "";
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (ch === ">") {
      i += 1; // 没有配对的右括号：只删它自己
      continue;
    }
    if (ch !== "<") {
      out += ch;
      i += 1;
      continue;
    }
    const close = input.indexOf(">", i + 1);
    if (close === -1) {
      i += 1; // 没闭合的 `<script`：只删这个 `<`，后面的文字照常留着
      continue;
    }
    const span = input.slice(i + 1, close);
    if (BARE_LINK_RE.test(span)) out += span;
    i = close + 1;
  }
  return out;
}

/** 读正文第一段有效段落（跳过标题/frontmatter/引用前缀），去粗体，截 120 字 */
export function readFirstParagraph(md: string): string {
  for (const line of md.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || t.startsWith("---")) continue;
    return plainText(t.replace(/^>\s*/, "").replace(/\*\*/g, "")).slice(0, 120);
  }
  return "";
}

/** 提取第一个 H1 标题文本 */
export function extractH1(md: string): string {
  const m = md.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : "";
}

/** frontmatter title 的前导数字（章内排序） */
export function titleOrder(title: string): number {
  const m = title.match(/^(\d+)/);
  return m ? Number(m[1]) : 999;
}
