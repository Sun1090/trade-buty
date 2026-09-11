/**
 * R12.6：streak 断档后的温和恢复提示——纯决策函数。
 *
 * 原则（与内容宪法一致）：
 * - 只陈列事实：确实断签、历史最长、今日已学分钟数；不回填、不伪造连续天数；
 * - 口吻温和、面向行动：「今天做一件 5 分钟的小事就算数」，不制造焦虑；
 * - 动作有优先级：到期复习 > 继续未读章节 > 回放热身（从真实本地数据推导，
 *   无到期复习就不推荐复习）；
 * - 今日已破零（todayMinutes > 0）或未断签时不显示，避免噪音。
 */

export interface StreakRecoveryAction {
  kind: "review" | "continue" | "replay";
  href: string;
}

export type StreakRecoveryReason =
  | "streak-broken-idle"
  | "streak-intact"
  | "already-active-today";

export interface StreakRecoverySuggestion {
  version: 1;
  show: boolean;
  reason: StreakRecoveryReason;
  /** 历史最长连续天数（展示用，事实数据） */
  longest: number;
  /** 建议动作（最多 2 个，按优先级排序） */
  actions: StreakRecoveryAction[];
}

const safeNonNegative = (value: unknown): number => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
};

export function buildStreakRecovery(input: {
  broken: unknown;
  longest: unknown;
  todayMinutes: unknown;
  dueReviews: unknown;
  /** 是否还有未读完的章节（由调用方根据进度推导） */
  hasUnfinishedChapter: unknown;
  locale?: string;
}): StreakRecoverySuggestion {
  const locale = input.locale === "en" ? "en" : "zh";
  const broken = input.broken === true;
  const longest = safeNonNegative(input.longest);
  const todayMinutes = safeNonNegative(input.todayMinutes);
  const dueReviews = safeNonNegative(input.dueReviews);
  const hasUnfinishedChapter = input.hasUnfinishedChapter === true;

  if (!broken) {
    return { version: 1, show: false, reason: "streak-intact", longest, actions: [] };
  }
  if (todayMinutes > 0) {
    // 今天已经重新开始学习（streak 已记为 1），不再打扰
    return { version: 1, show: false, reason: "already-active-today", longest, actions: [] };
  }

  const actions: StreakRecoveryAction[] = [];
  if (dueReviews > 0) actions.push({ kind: "review", href: `/${locale}/review` });
  if (hasUnfinishedChapter) actions.push({ kind: "continue", href: `/${locale}/path` });
  if (actions.length < 2) actions.push({ kind: "replay", href: `/${locale}/replay` });

  return {
    version: 1,
    show: true,
    reason: "streak-broken-idle",
    longest,
    actions: actions.slice(0, 2),
  };
}
