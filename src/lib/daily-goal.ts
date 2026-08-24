/**
 * 每日学习目标：设置每天完成 X 篇课程
 * 记录目标值 + 今日已读数（从 progress 实时算）
 */
const GOAL_KEY = "tb-daily-goal";
const DATE_KEY = "tb-daily-goal-date";

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 读取每日目标（默认 3） */
export function getDailyGoal(): number {
  try {
    const v = parseInt(localStorage.getItem(GOAL_KEY) ?? "3", 10);
    return Number.isNaN(v) || v < 1 ? 3 : Math.min(v, 20);
  } catch {
    return 3;
  }
}

/** 设置每日目标 */
export function setDailyGoal(n: number): void {
  try {
    const clamped = Math.min(Math.max(n, 1), 20);
    localStorage.setItem(GOAL_KEY, String(clamped));
    localStorage.setItem(DATE_KEY, todayStr());
    window.dispatchEvent(new Event("tb-goal"));
  } catch {
    // ignore
  }
}

/** 今天是否设置了目标（用于跨天重置判断） */
export function isGoalSetToday(): boolean {
  try {
    return localStorage.getItem(DATE_KEY) === todayStr();
  } catch {
    return false;
  }
}
