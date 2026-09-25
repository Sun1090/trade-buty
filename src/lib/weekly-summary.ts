/**
 * R12.19 + R12.20：每周学习目标（可编辑，多设备同步）与周度学习摘要（本地生成）。
 *
 * 设计约束：
 * - 摘要完全本地生成：输入是既有台账/账本读数，不联网、不虚构日期；
 * - 周 = 今天在内向前 7 个自然日（与 WeeklyReport 图表、study-time 台账口径一致）；
 *   这个 7 是 `WEEK_WINDOW_DAYS`，界面上写「近 7 天」的那几句必须由它生成——
 *   「本周 / this week」是日历周，滚动窗口不配叫这个名字（R16.129）；
 * - 周目标档位制（45/90/150 分钟，默认 90），存储 key 独立于日目标；
 * - 「已达成」只基于真实的最近 7 天分钟数，绝不放松口径凑数。
 */

import { localDateStr } from "./date-utils";

/** 滚动窗口长度（含今天）：摘要、周目标、柱状图共用这一个数 */
export const WEEK_WINDOW_DAYS = 7;

/**
 * 「N 天活跃」那一个 N 的尺子：当日去重后 ≥60 秒才算一天。
 * 台账的阅读计时是 5 秒一个 tick（`study-time.ts` 的 R4.9 约定），不设这道槛的话
 * 划过一页就算一天。它是同一屏那根迷你条的反面——那根看的是「有没有记过一次学习
 * 活动」（`activity-calendar`），一秒钟都不到也算有。两个数因此可以互相超出，
 * 两句文案必须各自说出自己的尺子（`i18n-stats.ts` 的 `weekSummaryTpl` / `WeekMiniBar`）。
 */
export const ACTIVE_DAY_MIN_SECONDS = 60;

export const WEEKLY_GOAL_TIERS = [45, 90, 150] as const;
export const DEFAULT_WEEKLY_GOAL_MIN = 90;

const WEEKLY_GOAL_KEY = "tb-weekly-goal-min";

export function getWeeklyGoalMin(storage: Storage = globalThis.localStorage): number {
  try {
    const v = parseInt(storage.getItem(WEEKLY_GOAL_KEY) ?? "", 10);
    return (WEEKLY_GOAL_TIERS as readonly number[]).includes(v) ? v : DEFAULT_WEEKLY_GOAL_MIN;
  } catch {
    return DEFAULT_WEEKLY_GOAL_MIN;
  }
}

export function setWeeklyGoalMin(n: number): void {
  const clamped = (WEEKLY_GOAL_TIERS as readonly number[]).includes(n) ? n : DEFAULT_WEEKLY_GOAL_MIN;
  try {
    localStorage.setItem(WEEKLY_GOAL_KEY, String(clamped));
    window.dispatchEvent(new Event("tb-weekly-goal"));
  } catch {
    // ignore
  }
  // R12.19：登录用户双写云端（fire-and-forget），失败入队
  import("./sync-layer")
    .then(({ syncWeeklyGoalUpsert }) => syncWeeklyGoalUpsert(clamped))
    .catch(() => {});
}

export interface WeeklySummaryInput {
  /** 近 7 天每日学习秒数（oldest → today），来自 getStudySeries(7) */
  dailySeconds: number[];
  /** 阅读完成账本：key → { at? }（既有账本 at 类型可选，容错处理） */
  completions: Record<string, { at?: unknown }>;
  /** 测验尝试账本：key → { at? } */
  quizAttempts: Record<string, { at?: unknown }>;
  /** 复习尝试账本：key → { at? } */
  reviewAttempts: Record<string, { at?: unknown }>;
  /** 回放历史（含 at） */
  replayHistory: { at?: unknown }[];
  weeklyGoalMin: number;
  /** 可注入时钟（测试用） */
  now?: Date;
}

export interface WeeklySummary {
  weekStart: string; // YYYY-MM-DD（6 天前）
  weekEnd: string; // 今天
  totalMinutes: number;
  activeDays: number; // 近 7 天内有学习的自然日数
  completions: number;
  quizAttempts: number;
  reviews: number;
  replayRounds: number;
  goalMin: number;
  goalAchieved: boolean;
  remainingMin: number; // 未达成时还差多少（已达成 = 0）
}

const DAY_MS = 86_400_000;

/**
 * 周学习分钟数的全站唯一口径：秒数向下取整成分钟。
 *
 * 逐日取整再相加会把 30 秒的一天抬成「1 分钟」——7 天各 30 秒（整周 210 秒）能报成
 * 7 分钟，而同一页的周度摘要报 3 分钟。本模块开头承诺「绝不放松口径凑数」，
 * 所以柱状摘要（WeeklyReport）与周度摘要都必须走这里。
 */
export function weekMinutes(totalSeconds: number): number {
  return Math.floor((Number.isFinite(totalSeconds) ? totalSeconds : 0) / 60);
}

/** 本地日期边界（含端点）：近 `WEEK_WINDOW_DAYS` 个自然日的 [窗口首日, 今天] */
function weekBounds(now: Date): { startStr: string; endStr: string } {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  const start = new Date(end.getTime() - (WEEK_WINDOW_DAYS - 1) * DAY_MS);
  return { startStr: localDateStr(start), endStr: localDateStr(end) };
}

/** 按本地日历日比较（字符串字典序即日期序），与台账/stats 页的口径一致 */
function countInRange(values: { at?: unknown }[], startStr: string, endStr: string): number {
  let n = 0;
  for (const v of values) {
    const at = typeof v?.at === "number" ? v.at : Number.NaN;
    if (!Number.isFinite(at)) continue;
    const day = localDateStr(new Date(at));
    if (day >= startStr && day <= endStr) n++;
  }
  return n;
}

export function buildWeeklySummary(input: WeeklySummaryInput): WeeklySummary {
  const now = input.now ?? new Date();
  const { startStr, endStr } = weekBounds(now);
  const daily = (input.dailySeconds ?? []).map((s) => (Number.isFinite(s) && s > 0 ? s : 0)).slice(-WEEK_WINDOW_DAYS);
  const totalSeconds = daily.reduce((a, b) => a + b, 0);
  const totalMinutes = weekMinutes(totalSeconds);
  const goalMin = (WEEKLY_GOAL_TIERS as readonly number[]).includes(input.weeklyGoalMin)
    ? input.weeklyGoalMin
    : DEFAULT_WEEKLY_GOAL_MIN;

  return {
    weekStart: startStr,
    weekEnd: endStr,
    totalMinutes,
    activeDays: daily.filter((s) => s >= ACTIVE_DAY_MIN_SECONDS).length,
    completions: countInRange(Object.values(input.completions ?? {}), startStr, endStr),
    quizAttempts: countInRange(Object.values(input.quizAttempts ?? {}), startStr, endStr),
    reviews: countInRange(Object.values(input.reviewAttempts ?? {}), startStr, endStr),
    replayRounds: countInRange(input.replayHistory ?? [], startStr, endStr),
    goalMin,
    goalAchieved: totalMinutes >= goalMin,
    remainingMin: Math.max(0, goalMin - totalMinutes),
  };
}
