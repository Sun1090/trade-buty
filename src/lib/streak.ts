/**
 * 学习连续天数（streak）计算 + 存储
 *
 * 记录每天的学习活动（标记已读/做测验/做回放），
 * 计算当前连续学习天数和历史最长记录。
 */
import { recordActivity } from "./activity-calendar";

const KEY = "tb-streak";

interface StreakData {
  /** 最后学习日期 YYYY-MM-DD */
  lastDate: string;
  /** 当前连续天数 */
  current: number;
  /** 历史最长连续天数 */
  longest: number;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 读取连续天数数据 */
export function readStreak(): StreakData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { lastDate: "", current: 0, longest: 0 };
    return JSON.parse(raw) as StreakData;
  } catch {
    return { lastDate: "", current: 0, longest: 0 };
  }
}

/**
 * 记录今日学习活动（调一次即可，幂等——同一天多次调用不增天数）。
 * 应在 markRead / recordWrong / saveQuizProgress 等处调用。
 */
export function touchStreak(): void {
  try {
    const data = readStreak();
    const today = todayStr();

    // 今天已经记录过，不重复
    if (data.lastDate === today) return;

    // 昨天有记录 → 连续 +1
    if (data.lastDate === yesterdayStr()) {
      data.current += 1;
    } else {
      // 断了，重新计 1
      data.current = 1;
    }

    data.lastDate = today;
    data.longest = Math.max(data.longest, data.current);
    localStorage.setItem(KEY, JSON.stringify(data));
    recordActivity(); // 记录到活动日历

    // 广播让消费方刷新
    window.dispatchEvent(new Event("tb-streak"));
  } catch {
    // localStorage 不可用时静默
  }
}

/** 获取当前连续天数（如果最后学习日期不是今天或昨天，返回 0） */
export function getCurrentStreak(): number {
  const data = readStreak();
  const today = todayStr();
  const yesterday = yesterdayStr();

  if (data.lastDate === today || data.lastDate === yesterday) {
    return data.current;
  }
  return 0;
}
