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
 * 已知取舍：反引号只删记号、不保护内容，所以 `` `<br>` `` 这种「行内代码里写着尖括号」
 * 会被随后的标签清理一起吃掉。全仓首段与 description 里没有任何一处这种写法
 * （扫描用例逐条核过），因此不做代码区间保护。
 *
 * 最后一步把所有残留的尖括号整体删掉，而不是只删「看起来像完整标签」的片段：一条标签形状
 * 的正则挡不住没闭合的 `<script`，也挡不住 `<scr<scriptipt>` 这种删完一段又拼回一个标签的
 * 写法。这批字符串只流向 React 文本节点与 `<meta content>`（两处都转义），本不构成注入，
 * 但半消毒的值比没消毒更危险——它会让人以为可以往别处送。中间那步按「一对尖括号整体」删而
 * 不指名标签形状，也是同一原因：CodeQL 的库模型认得 `</?[a-zA-Z]…>` 这种「半个 sanitizer」，
 * 而这里要表达的其实是「成对尖括号一律去掉，剩下的尖括号再单独去掉」。实测当前内容里首段与
 * 摘要没有一个含尖括号（zh/en 两棵树下 0 命中），所以这两步不改变任何一句真实文案。
 */
export function plainText(input: string): string {
  return input
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // 内联链接 [文字](地址)
    .replace(/\[([^\]]*)\]\[[^\]]*\]/g, "$1") // 引用式链接 [文字][标签]
    .replace(/<\s*(https?:\/\/[^>]*)>\s*/gi, "$1") // 尖括号包起来的裸链接
    .replace(/<[^>]*>/g, "") // 成对尖括号整对去掉（不指名是标签）
    .replace(/[<>]/g, "") // 没拼成对的尖括号也不留：见上面的取舍
    .replace(/`/g, "") // 行内代码的反引号
    .replace(/\s+/g, " ")
    .trim();
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
