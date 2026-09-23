/**
 * R4.8：本地日期工具——全站「今天」的唯一口径。
 * 一律使用本地日历字段（getters），跨时区/夏令时不会产生 UTC 偏移误差。
 */

/** 本地日期 → YYYY-MM-DD */
export function localDateStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}


/** Strict calendar-date validation; format-only regexes accept impossible dates such as 2026-02-31. */
export function isLocalDateStr(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
}

/** 本地日历日 → 该日 23:59:59.999 的时间戳（毫秒）；非法日历日期返回 NaN。 */
export function localDayEndMs(dateStr: string): number {
  if (!isLocalDateStr(dateStr)) return Number.NaN;
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day, 23, 59, 59, 999).getTime();
}

/** 日期字符串加减天数（走 UTC 正午避免 DST 边界跳变） */
export function shiftDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  // 用正午构造，加减一天后取本地日历字段不受 DST 影响
  const dt = new Date(y, m - 1, d, 12, 0, 0);
  dt.setDate(dt.getDate() + days);
  return localDateStr(dt);
}

/** b - a 的天数差（按日历日期，忽略时间） */
export function daysBetween(a: string, b: string): number {
  const pa = a.split("-").map(Number);
  const pb = b.split("-").map(Number);
  const ta = Date.UTC(pa[0], pa[1] - 1, pa[2]);
  const tb = Date.UTC(pb[0], pb[1] - 1, pb[2]);
  return Math.round((tb - ta) / 86_400_000);
}
