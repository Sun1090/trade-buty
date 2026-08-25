/**
 * 每日交易提示池——每次刷新随机展示一条
 */
const TIPS_ZH = [
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

const TIPS_EN = [
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

export function getDailyTip(locale: string): string {
  const pool = locale === "en" ? TIPS_EN : TIPS_ZH;
  return pool[Math.floor(Math.random() * pool.length)];
}