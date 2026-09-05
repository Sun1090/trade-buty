/**
 * R4.8：本地日期工具——全站「今天」的唯一口径。
 * 一律使用本地日历字段（getters），跨时区/夏令时不会产生 UTC 偏移误差。
 */

/** 本地日期 → YYYY-MM-DD */
export function localDateStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
