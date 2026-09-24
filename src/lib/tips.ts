/**
 * 交易心得池。
 *
 * 展示分两种取法，不能混用：这些卡片渲染在静态页（SSG）上，服务端 HTML 在构建时就固化了，
 * 所以渲染期必须取确定值——在 render 里取随机会让水合文本对不上，React 会丢掉整棵服务端树
 * 重新渲染（真浏览器里表现为 #418）。随机只允许发生在挂载之后与「换一条」点击里。
 */
export const TIPS_ZH = [
  "不要试图预测市场，学会应对市场。",
  "止损不是亏损，是保护本金的门票。",
  "仓位管理比选对方向更重要。",
  "浮动盈亏不是真盈亏，平仓才算。",
  "亏损时加仓，是新手最昂贵的错误。",
  "截断亏损，让利润奔跑。",
  "顺势而为，不要与趋势对抗。",
  "技术分析不是预测，是概率。",
  "同一笔交易，不同仓位 = 不同的风险。",
  "复盘比交易本身更重要。",
];

export const TIPS_EN = [
  "Don't predict the market — learn to react to it.",
  "A stop loss isn't a loss — it's insurance for your capital.",
  "Position sizing matters more than direction.",
  "Unrealized P&L isn't real P&L — close counts.",
  "Adding to a losing position: a beginner's most expensive mistake.",
  "Cut losses short, let profits run.",
  "The trend is your friend.",
  "Technical analysis isn't prediction — it's probability.",
  "Same trade, different size = different risk.",
  "Reviewing your trades matters more than making them.",
];

function poolOf(locale: string): string[] {
  return locale === "en" ? TIPS_EN : TIPS_ZH;
}

/** 服务端与水合首帧共用的确定值 */
export function getSeedTip(locale: string): string {
  return poolOf(locale)[0];
}

/**
 * 客户端挂载后或「换一条」时的随机取法。
 *
 * 给了 `exclude` 就一定换开这一条：那句按钮叫「换一条心得」，而 10 条的池子按老写法
 * 有 1/10 的概率抽回同一条——点了没反应，按钮就在说谎。两个池子各有 10 条，
 * 由 `tips.test.ts` 钉住「≥2 条」，所以 `rest` 不可能被抽空。
 */
export function getRandomTip(locale: string, exclude?: string): string {
  const pool = poolOf(locale);
  const rest = exclude === undefined ? pool : pool.filter((tip) => tip !== exclude);
  return rest[Math.floor(Math.random() * rest.length)];
}
