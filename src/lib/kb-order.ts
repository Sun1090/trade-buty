/**
 * 站内学习路径顺序（curated）——**不是**知识库 H1 的 01–27 编号。
 * 实测 27 篇里有 19 篇两者不一致：`stocks` 在本表第 3 位、标题却是「04 · 股票篇」；
 * `data-interpretation` 第 16 位、标题是「26 · 数据解读实战篇」。所以本表只用于排序，
 * 界面上要标篇章编号一律取标题里的 `NN ·`（en 树的 H1 与 zh 同号，因此两边一致）。
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
