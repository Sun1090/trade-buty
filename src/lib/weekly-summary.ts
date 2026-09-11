/**
 * R12.19 + R12.20：每周学习目标（可编辑，多设备同步）与周度学习摘要（本地生成）。
 *
 * 设计约束：
 * - 摘要完全本地生成：输入是既有台账/账本读数，不联网、不虚构日期；
 * - 周 = 今天在内向前 7 个自然日（与 WeeklyReport 图表、study-time 台账口径一致）；
 * - 周目标档位制（45/90/150 分钟，默认 90），存储 key 独立于日目标；
 * - 「已达成」只基于真实的最近 7 天分钟数，绝不放松口径凑数。
 */

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

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 本地日期边界（含端点）：近 7 个自然日的 [6 天前, 今天] */
function weekBounds(now: Date): { startStr: string; endStr: string } {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  const start = new Date(end.getTime() - 6 * DAY_MS);
  return { startStr: toDateStr(start), endStr: toDateStr(end) };
}

/** 按本地日历日比较（字符串字典序即日期序），与台账/stats 页的口径一致 */
function countInRange(values: { at?: unknown }[], startStr: string, endStr: string): number {
  let n = 0;
  for (const v of values) {
    const at = typeof v?.at === "number" ? v.at : Number.NaN;
    if (!Number.isFinite(at)) continue;
    const day = toDateStr(new Date(at));
    if (day >= startStr && day <= endStr) n++;
  }
  return n;
}

export function buildWeeklySummary(input: WeeklySummaryInput): WeeklySummary {
  const now = input.now ?? new Date();
  const { startStr, endStr } = weekBounds(now);
  const daily = (input.dailySeconds ?? []).map((s) => (Number.isFinite(s) && s > 0 ? s : 0)).slice(-7);
  const totalSeconds = daily.reduce((a, b) => a + b, 0);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const goalMin = (WEEKLY_GOAL_TIERS as readonly number[]).includes(input.weeklyGoalMin)
    ? input.weeklyGoalMin
    : DEFAULT_WEEKLY_GOAL_MIN;

  return {
    weekStart: startStr,
    weekEnd: endStr,
    totalMinutes,
    activeDays: daily.filter((s) => s >= 60).length, // ≥1 分钟算活跃（台账 tick 5s，避免 5 秒误触凑活跃）
    completions: countInRange(Object.values(input.completions ?? {}), startStr, endStr),
    quizAttempts: countInRange(Object.values(input.quizAttempts ?? {}), startStr, endStr),
    reviews: countInRange(Object.values(input.reviewAttempts ?? {}), startStr, endStr),
    replayRounds: countInRange(input.replayHistory ?? [], startStr, endStr),
    goalMin,
    goalAchieved: totalMinutes >= goalMin,
    remainingMin: Math.max(0, goalMin - totalMinutes),
  };
}
