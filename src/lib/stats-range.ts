/**
 * R12.10：统计页时间范围筛选（近 7 天 / 近 30 天）。
 *
 * 口径：
 * - 档位收敛为 7 / 30，与既有趋势图（7 天）和月报视角对齐；
 * - 本地持久化（tb-stats-range-days），切换广播 tb-stats-range；
 * - 读取端永远返回合法档位：非法/缺失值回退 7，不写回存储（只读不写）。
 */

const KEY = "tb-stats-range-days";
export const STATS_RANGE_OPTIONS = [7, 30] as const;
export type StatsRangeDays = (typeof STATS_RANGE_OPTIONS)[number];

const sanitize = (value: unknown): StatsRangeDays => {
  const n = typeof value === "number" ? value : Number(value);
  return n === 30 ? 30 : 7;
};

export function getStatsRangeDays(storage: Storage | undefined = typeof localStorage !== "undefined" ? localStorage : undefined): StatsRangeDays {
  try {
    return sanitize(storage?.getItem(KEY));
  } catch {
    return 7;
  }
}

export function setStatsRangeDays(days: number): StatsRangeDays {
  const safe = sanitize(days);
  try {
    localStorage.setItem(KEY, String(safe));
    window.dispatchEvent(new Event("tb-stats-range"));
  } catch {
    // ignore
  }
  return safe;
}
