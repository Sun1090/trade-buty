/**
 * 敏感话题护栏（输入侧）：荐股/收益承诺类请求直接拒绝，不调模型（省成本）。
 * 输出侧靠 system prompt 约束 + flush 日志观测（流式无法中途撤回，见 route 注释）。
 */

export type SensitiveCategory = "stock-pick" | "profit-promise";

const PATTERNS: { category: SensitiveCategory; re: RegExp }[] = [
  {
    category: "stock-pick",
    re: /推荐.*?(股票|基金|币|标的|etf)|买(哪|什么|点|什么币)|(哪|什么)(股票|币|基金)(值得|可以|应该买|买)|代码是|多少钱(买|建仓)|给个标的|推荐个/,
  },
  {
    category: "profit-promise",
    re: /必涨|稳赚|包赚|保证收益|翻倍|暴涨|抄底.{0,6}稳|年化.{0,6}(保证|承诺)|targets?.{0,10}price|能涨多少/,
  },
  {
    category: "stock-pick",
    re: /recommend\s+(a\s+)?(stock|coin|fund|etf|ticker)|which\s+(stock|coin|crypto|fund)\s+(to\s+buy|should i buy)|what\s+should\s+i\s+buy|give\s+me\s+a\s+(stock|coin|ticker)/i,
  },
  {
    category: "profit-promise",
    re: /guaranteed\s+profit|sure\s+win|will\s+(moon|pump|rise\s+for\s+sure)|price\s+target|risk-?free\s+(return|profit)/i,
  },
];

/** 输出侧轻量探测：回答出现「标的+买入动作」时返回 true（仅用于日志观测，流式无法撤回） */
export function looksLikeRecommendation(text: string): boolean {
  const t = text.trim().slice(0, 2000);
  const hasAction = /(买|卖|买入|卖出|建仓|清仓|加仓|buy|sell|long|short)/i.test(t);
  const hasTicker = /[A-Z]{2,5}(USD|USDT)?\b|\d+(?:元|块|美元)/.test(t);
  return hasAction && hasTicker;
}

export function matchSensitiveRequest(text: string): SensitiveCategory | null {
  const t = text.trim().slice(0, 500);
  if (!t) return null;
  for (const { category, re } of PATTERNS) {
    if (re.test(t)) return category;
  }
  return null;
}
