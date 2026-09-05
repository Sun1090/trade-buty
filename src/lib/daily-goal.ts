/**
 * R4.1：每日学习目标——时间档位制（5/15/30 分钟，默认 15）。
 * 进度口径 = R4.2 学习时长台账的去重总时长（max(read, quiz+replay)）。
 *
 * R4.9 最低门槛兜底：阅读计时 5 秒一个 tick（reading-time-tracker），
 * 打开课程页停留 ≥5 秒即计入当日 read——「打开即算活跃」。
 * 旧版「篇数」目标（tb-daily-goal）保留字段不再读取，新 key 独立。
 */
import { getTodayStudySeconds } from "./study-time";

const GOAL_KEY = "tb-daily-goal-min";

export const GOAL_TIERS = [5, 15, 30] as const;

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 读取每日目标分钟数（必须为合法档位，否则回落默认 15） */
export function getDailyGoalMin(): number {
  try {
    const v = parseInt(localStorage.getItem(GOAL_KEY) ?? "", 10);
    return (GOAL_TIERS as readonly number[]).includes(v) ? v : 15;
  } catch {
    return 15;
  }
}

/** 设置每日目标（只接受 5/15/30 档位） */
export function setDailyGoalMin(n: number): void {
  const clamped = (GOAL_TIERS as readonly number[]).includes(n) ? n : 15;
  try {
    localStorage.setItem(GOAL_KEY, String(clamped));
    localStorage.setItem("tb-daily-goal-date", todayStr());
    window.dispatchEvent(new Event("tb-goal"));
  } catch {
    // ignore
  }
}

/** 今日已学分钟数（向下取整，来自学习时长台账） */
export function getTodayStudyMinutes(): number {
  return Math.floor(getTodayStudySeconds().total / 60);
}
