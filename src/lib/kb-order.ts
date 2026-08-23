/**
 * 篇章规范顺序（与 kline-buty zh 版 01–27 对应）。
 * 知识库文件名/H1 可能不带序号（en 已去除），排序以本表为准；
 * 未收录的新篇章按字母序追加在末尾。
 */
export const CHAPTER_ORDER: string[] = [
  "getting-started",
  "spot",
  "stocks",
  "futures",
  "crypto-perpetuals",
  "markets-instruments",
  "technical-analysis",
  "trading-system",
  "pitfalls",
  "trading-practice",
  "system-integration",
  "market-ecosystem",
  "financial-history",
  "wealth-allocation",
  "quant-practice",
  "data-interpretation",
  "global-markets",
  "regulation-compliance",
  "tools-platforms",
  "financial-statements",
  "industry-research",
  "reading-list",
  "behavioral-finance",
  "bonds-rates",
  "forex-trading",
  "career",
  "options-strategies",
];

export function chapterRank(slug: string): number {
  const idx = CHAPTER_ORDER.indexOf(slug);
  if (idx !== -1) return idx;
  // 未知篇章排到末尾（1000+），按首字符 ASCII 区分字母序
  return 1000 + slug.charCodeAt(0);
}
