/**
 * R10.22：站内搜索无结果诊断。
 *
 * 场景：查询在索引里零命中时，空状态不再只有一句「没有匹配的结果」，
 * 而是给出可操作的诊断（复用 R10.21 同义词组匹配 + R8.11 编辑距离）：
 * - 空 / 过短（<2 字符）：同义词扩展与模糊匹配都要求 ≥2 字符，提示继续输入
 * - coverage-gap：查询命中同义词组，但组内所有说法在站内都无命中——
 *   如实告知「已按这些同义说法搜过」，避免用户误以为搜索坏了；
 *   同时这是内容缺口信号（词典词条超出正文词汇，运营可据此补课）
 * - typo：查询疑似常见词拼写/用词偏差——按编辑距离推荐最接近的候选词
 * - no-match：其余情况维持通用空态（热门词兜底）
 *
 * 纯函数：不读 fs、不依赖全局状态。候选词由调用方传入
 * （搜索页 = 同义词组词条 + 索引标题/篇章，避免客户端 import 数据文件）。
 */

import { levenshtein, normalizeForDistance } from "./url-suggest";
import {
  type SynonymGroup,
  SYNONYM_GROUPS,
  expandQuery,
  matchedGroups,
  normalizeQuery,
} from "./search-synonyms";

export type NoResultsKind =
  | "empty"
  | "too-short"
  | "coverage-gap"
  | "typo"
  | "no-match";

export interface NoResultsDiagnosis {
  kind: NoResultsKind;
  /** 实际尝试过的检索词（原词 + 同义扩展，小写去重，≥2 字符） */
  tried: string[];
  /** 命中的同义词组 id（coverage-gap 时非空） */
  groupIds: string[];
  /** 命中的同义词组全部词条（coverage-gap 展示用） */
  groupTerms: string[];
  /** 编辑距离推荐的候选词（typo 时非空） */
  suggestions: string[];
}

/** 扩展后实际尝试的检索词：原词在前、小写去重、只留 ≥2 字符。 */
export function triedVariants(
  query: string,
  groups: SynonymGroup[] = SYNONYM_GROUPS,
): string[] {
  const out: string[] = [];
  for (const v of expandQuery(query, groups)) {
    const t = normalizeQuery(v);
    if (t.length < 2 || out.includes(t)) continue;
    out.push(t);
  }
  return out;
}

/** 与查询长度对应的可接受编辑距离上限（越长容忍越多笔误）。 */
function distanceThreshold(qlen: number): number {
  if (qlen <= 3) return 1;
  if (qlen <= 6) return 2;
  return 3;
}

/**
 * 编辑距离近义词推荐：从候选词里挑与查询最接近的（去重、排除自身）。
 * 候选顺序稳定（同距离按原顺序），返回前 k 个。空查询/过短查询返回 []。
 */
export function similarTerms(
  query: string,
  candidates: string[],
  { k = 3 }: { k?: number } = {},
): string[] {
  const norm = normalizeQuery(query);
  if (!norm || norm.length < 2) return [];
  const max = distanceThreshold(norm.length);
  const scored: Array<{ term: string; dist: number; idx: number }> = [];
  const seen = new Set<string>();
  candidates.forEach((raw, idx) => {
    const t = normalizeQuery(raw);
    if (!t || t.length < 2) return;
    const key = normalizeForDistance(raw);
    if (seen.has(key)) return;
    seen.add(key);
    const qkey = normalizeForDistance(norm);
    const dist = levenshtein(qkey, key);
    if (dist > 0 && dist <= max) scored.push({ term: raw.trim(), dist, idx });
  });
  scored.sort((a, b) => a.dist - b.dist || a.idx - b.idx);
  return scored.slice(0, k).map((s) => s.term);
}

/** 零结果诊断：调用方只在 `results.length === 0` 时调用。 */
export function diagnoseNoResults(
  query: string,
  options: {
    candidates?: string[];
    groups?: SynonymGroup[];
    k?: number;
  } = {},
): NoResultsDiagnosis {
  const { candidates = [], groups = SYNONYM_GROUPS, k = 3 } = options;
  const base: NoResultsDiagnosis = {
    kind: "no-match",
    tried: [],
    groupIds: [],
    groupTerms: [],
    suggestions: [],
  };
  const norm = normalizeQuery(query);
  if (!norm) return { ...base, kind: "empty" };
  if (norm.length < 2) return { ...base, kind: "too-short" };
  const matched = matchedGroups(query, groups);
  const suggestions = similarTerms(query, candidates, { k });
  let kind: NoResultsKind;
  if (matched.length > 0 && suggestions.length === 0) kind = "coverage-gap";
  else if (suggestions.length > 0) kind = "typo";
  else kind = "no-match";
  return {
    kind,
    tried: triedVariants(query, groups),
    groupIds: matched.map((g) => g.id),
    groupTerms: [...new Set(matched.flatMap((g) => g.terms))],
    suggestions,
  };
}
