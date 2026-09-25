/**
 * 学习活动日历：记录「哪一天有过学习动作」，给热力图和小条图用。
 *
 * 只有一个写入者：`recordActivity()`，由 `touchStreak()` 在连续天数真的前进时调用
 * （`streak.ts` 里 `recordActivity()` 那一行）。`touchStreak()` 自己的调用方是
 * 标记已读（`progress.ts`）、错题入库（`wrongbook.ts`）与 `progress-helpers.ts`。
 * 存的就是 `tb-activity` 这一个日期字符串数组：不读 `tb-progress-completions` 里的
 * `at` 完成时间戳，也不读阅读时长（`tb-reading-time` 只被 `reading-time.ts` 读写）。
 */
import { isLocalDateStr, localDateStr } from "./date-utils";
import { readStorageJson } from "./storage-json";

const KEY = "tb-activity";

export function readActivityDates(): string[] {
  const parsed = readStorageJson(KEY);
  if (!Array.isArray(parsed)) return [];
  return [
    ...new Set(
      parsed.filter(
        (value): value is string =>
          isLocalDateStr(value),
      ),
    ),
  ];
}

/** 记录今天有学习活动（touchStreak 内部调用） */
export function recordActivity(): void {
  try {
    const dates = readActivityDates();
    const today = localDateStr();
    if (!dates.includes(today)) {
      dates.push(today);
      localStorage.setItem(KEY, JSON.stringify(dates.slice(-365)));
    }
  } catch {
    // ignore
  }
}
