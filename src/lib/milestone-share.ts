/**
 * R13.22 社交功能轻量化：用户主动发起的学习里程碑分享。
 *
 * 设计边界（对应 docs/social-features-review.md 的结论）：
 * - 纯函数、无网络：只把聚合进度（已读篇数 / 完成篇章数 / 连续天数）渲染成一段分享文案；
 * - 不引入账号、好友关系、排行榜或可见性开关——分享与否完全由用户点击决定；
 * - 文案只陈述「我读到哪」，不做名次比较、不承诺收益、不使用焦虑或稀缺话术；
 * - 分享 URL 指向公开学习路线，绝不把进度明细编码进链接。
 */

export interface MilestoneStats {
  /** 已读课程数 */
  readDocs: number;
  /** 总课程数 */
  totalDocs: number;
  /** 已完成篇章数 */
  doneChapters: number;
  /** 总篇章数 */
  totalChapters: number;
  /** 当前连续学习天数 */
  currentStreak: number;
}

export type MilestoneKey =
  | "first-lesson"
  | "ten-lessons"
  | "first-chapter"
  | "five-chapters"
  | "streak-7"
  | "half-path"
  | "all-lessons";

export interface Milestone {
  key: MilestoneKey;
  /** 越大越「进阶」，用于在多个已达成里程碑里选一个代表 */
  rank: number;
}

interface MilestoneRule extends Milestone {
  achieved: (stats: MilestoneStats) => boolean;
}

/** 里程碑阶梯：rank 递增，selectMilestone 取已达成的最高 rank。 */
export const MILESTONE_LADDER: readonly MilestoneRule[] = [
  { key: "first-lesson", rank: 10, achieved: (s) => s.readDocs >= 1 },
  { key: "ten-lessons", rank: 20, achieved: (s) => s.readDocs >= 10 },
  { key: "first-chapter", rank: 30, achieved: (s) => s.doneChapters >= 1 },
  { key: "five-chapters", rank: 40, achieved: (s) => s.doneChapters >= 5 },
  { key: "streak-7", rank: 50, achieved: (s) => s.currentStreak >= 7 },
  {
    key: "half-path",
    rank: 60,
    achieved: (s) => s.totalDocs > 0 && s.readDocs >= Math.ceil(s.totalDocs / 2),
  },
  {
    key: "all-lessons",
    rank: 70,
    achieved: (s) => s.totalDocs > 0 && s.readDocs >= s.totalDocs,
  },
];

function safeCount(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value);
}

/** 返回当前已达成的最高阶里程碑；一个都没达成就返回 null。 */
export function selectMilestone(stats: MilestoneStats): Milestone | null {
  let best: Milestone | null = null;
  for (const rule of MILESTONE_LADDER) {
    if (!rule.achieved(stats)) continue;
    if (!best || rule.rank > best.rank) best = { key: rule.key, rank: rule.rank };
  }
  return best;
}

/**
 * 把聚合数据填进分享模板。只替换白名单占位符，未识别的 `{x}` 原样保留，
 * 这样调用方无法通过模板注入额外数据。
 */
export function fillShareText(template: string, stats: MilestoneStats): string {
  const values: Record<string, string> = {
    read: String(safeCount(stats.readDocs)),
    total: String(safeCount(stats.totalDocs)),
    done: String(safeCount(stats.doneChapters)),
    chapters: String(safeCount(stats.totalChapters)),
    streak: String(safeCount(stats.currentStreak)),
  };
  return template.replace(/\{(read|total|done|chapters|streak)\}/g, (_, key: string) => values[key]);
}

/** 分享链接只指向公开学习路线，绝不携带进度或身份参数。 */
export function buildShareUrl(origin: string, locale: "zh" | "en"): string {
  const base = origin.replace(/\/+$/, "");
  return `${base}/${locale}/path`;
}
