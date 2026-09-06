/**
 * R10.21：站内搜索同义词词典。
 *
 * 站点搜索是子串评分（见 search-utils），用户输入「定投」时无法命中只写
 * "DCA / dollar-cost averaging" 的英文课程。本词典把交易术语的中英别名归组，
 * 检索前把查询扩展成同组全部词条再取最高分——双语内容互相可达，不依赖分词。
 *
 * 词典同时服务 R10.22 的「无结果诊断」：查不到时能指出可扩展的同义词。
 */

import { score, type SearchEntry } from "./search-utils";

export interface SynonymGroup {
  id: string;
  terms: string[];
}

/** 术语组：zh 别名 / en 别名 / 常见缩写同列，term 统一小写。 */
export const SYNONYM_GROUPS: SynonymGroup[] = [
  { id: "stop-loss", terms: ["止损", "stop loss", "stop-loss"] },
  { id: "take-profit", terms: ["止盈", "take profit", "take-profit"] },
  { id: "dca", terms: ["定投", "dca", "dollar-cost averaging", "定期定额"] },
  { id: "moving-average", terms: ["均线", "移动平均线", "ma", "moving average"] },
  { id: "candlestick", terms: ["k线", "蜡烛图", "candlestick", "candlesticks"] },
  { id: "leverage", terms: ["杠杆", "leverage", "leveraged"] },
  { id: "margin", terms: ["保证金", "margin"] },
  { id: "perpetual", terms: ["永续", "perpetual", "perpetuals", "perp"] },
  { id: "futures", terms: ["期货", "futures"] },
  { id: "spot", terms: ["现货", "spot"] },
  { id: "stock", terms: ["股票", "stock", "stocks", "equity", "equities"] },
  { id: "etf", terms: ["etf", "exchange-traded fund", "交易型开放式指数基金"] },
  { id: "support-resistance", terms: ["支撑", "阻力", "support", "resistance"] },
  { id: "trend", terms: ["趋势", "trend", "trends"] },
  { id: "drawdown", terms: ["回撤", "drawdown", "最大回撤"] },
  { id: "volatility", terms: ["波动率", "volatility", "波动"] },
  { id: "annualized", terms: ["年化", "annualized", "annual return"] },
  { id: "short-selling", terms: ["做空", "卖空", "short selling", "short"] },
  { id: "long", terms: ["做多", "买入", "long position", "long"] },
  { id: "risk-reward", terms: ["盈亏比", "风报比", "risk-reward", "risk reward"] },
  { id: "position-sizing", terms: ["仓位", "头寸", "position sizing", "position"] },
  { id: "backtest", terms: ["回测", "backtest", "backtesting"] },
  { id: "paper-trading", terms: ["模拟盘", "模拟交易", "paper trading"] },
  { id: "trading-psychology", terms: ["交易心理", "心态", "trading psychology"] },
  { id: "compound", terms: ["复利", "compound", "compounding"] },
];

/** @returns {string} 归一化查询：去首尾空白、转小写。 */
export function normalizeQuery(q: string): string {
  return String(q ?? "").trim().toLowerCase();
}

/** 词典自检问题清单（重复词条 / 空组 / 单字组），供测试与诊断复用。 */
export function dictionaryProblems(groups: SynonymGroup[] = SYNONYM_GROUPS): string[] {
  const out: string[] = [];
  const seen = new Map<string, string>();
  for (const g of groups) {
    if (!g.terms || g.terms.length === 0) {
      out.push(`组 ${g.id} 无词条`);
      continue;
    }
    for (const raw of g.terms) {
      const t = normalizeQuery(raw);
      if (!t) {
        out.push(`组 ${g.id} 含空词条`);
        continue;
      }
      if (raw !== t) out.push(`组 ${g.id} 词条「${raw}」未小写归一`);
      if (t.length < 2) out.push(`组 ${g.id} 词条「${t}」过短（≥2 字符）`);
      const owner = seen.get(t);
      if (owner && owner !== g.id) out.push(`词条「${t}」同时属于 ${owner} 与 ${g.id}`);
      else seen.set(t, g.id);
    }
  }
  return out;
}

/** 查询命中的同义组（任一词条与 q 互相包含即命中，词条须 ≥2 字符）。 */
export function matchedGroups(q: string, groups: SynonymGroup[] = SYNONYM_GROUPS): SynonymGroup[] {
  const norm = normalizeQuery(q);
  if (!norm || norm.length < 2) return [];
  return groups.filter((g) =>
    g.terms.some((raw) => {
      const t = normalizeQuery(raw);
      return t.length >= 2 && (t.includes(norm) || norm.includes(t));
    }),
  );
}

/** 扩展查询：原词在前，随后按组序去重输出同义词（小写）。 */
export function expandQuery(q: string, groups: SynonymGroup[] = SYNONYM_GROUPS): string[] {
  const norm = normalizeQuery(q);
  if (!norm) return [];
  const out = [q.trim()];
  for (const g of matchedGroups(q, groups)) {
    for (const raw of g.terms) {
      const t = normalizeQuery(raw);
      if (t && !out.includes(t)) out.push(t);
    }
  }
  return out;
}

/** 带同义词的评分：对扩展后的每个词条取最高分。 */
export function scoreWithSynonyms(
  entry: SearchEntry,
  q: string,
  groups: SynonymGroup[] = SYNONYM_GROUPS,
): number {
  const variants = expandQuery(q, groups);
  let best = 0;
  for (const v of variants) {
    const s = score(entry, v);
    if (s > best) best = s;
  }
  return best;
}
