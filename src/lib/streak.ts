/**
 * 学习连续天数（streak）计算 + 存储
 *
 * 记录每天的学习活动（标记已读/做测验/做回放），
 * 计算当前连续学习天数和历史最长记录。
 */
import { readActivityDates, recordActivity } from "./activity-calendar";
import { localDateStr, daysBetween } from "./date-utils";

const KEY = "tb-streak";

interface StreakData {
  /** 最后学习日期 YYYY-MM-DD */
  lastDate: string;
  /** 当前连续天数 */
  current: number;
  /** 历史最长连续天数 */
  longest: number;
  /** R4.8：最后学习时刻的时间戳（时区宽限判断用） */
  lastTs?: number;
}

const todayStr = () => localDateStr();
const yesterdayStr = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return localDateStr(d);
};

/** R4.8：跨时区/夏令时宽限窗——距上次活动不足 36h 视为未断签 */
const GRACE_MS = 36 * 3600_000;

/** 读取连续天数数据 */
export function readStreak(): StreakData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { lastDate: "", current: 0, longest: 0, lastTs: 0 };
    const parsed = JSON.parse(raw) as StreakData;
    parsed.lastTs = parsed.lastTs ?? 0; // 旧数据迁移
    return parsed;
  } catch {
    return { lastDate: "", current: 0, longest: 0, lastTs: 0 };
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

    // R4.8：昨天有记录 → +1；跨时区/夏令时导致日历跳天但实际间隔
    // 不足 36h（lastTs 宽限窗）同样视为连续，不误判断签
    if (data.lastDate === yesterdayStr()) {
      data.current += 1;
    } else if (data.lastTs && Date.now() - data.lastTs < GRACE_MS && daysBetween(data.lastDate, today) >= 1) {
      data.current += 1;
    } else {
      // 断了，重新计 1
      data.current = 1;
    }

    data.lastDate = today;
    data.lastTs = Date.now();
    data.longest = Math.max(data.longest, data.current);
    localStorage.setItem(KEY, JSON.stringify(data));
    recordActivity(); // 记录到活动日历

    // 广播让消费方刷新
    window.dispatchEvent(new Event("tb-streak"));
  } catch {
    // localStorage 不可用时静默
  }
}

/** 获取当前连续天数（今天/昨天有活动，或 lastTs 在 36h 宽限窗内） */
export function getCurrentStreak(): number {
  const data = readStreak();
  const today = todayStr();
  const yesterday = yesterdayStr();

  if (data.lastDate === today || data.lastDate === yesterday) {
    return data.current;
  }
  if (data.lastTs && Date.now() - data.lastTs < GRACE_MS) {
    return data.current;
  }
  return 0;
}

/**
 * R4.3：断签挽回信息——昨天没学且已不在宽限窗内时，
 * 给 UI 一次「从头再来」的说明（不造假数据：连续天数确实已清零重计）。
 */
export function getStreakBreak(): { broken: boolean; longest: number } {
  const data = readStreak();
  const today = todayStr();
  const yesterday = yesterdayStr();
  const inGrace =
    data.lastDate === today ||
    data.lastDate === yesterday ||
    (data.lastTs !== undefined && data.lastTs > 0 && Date.now() - data.lastTs < GRACE_MS);
  // 无任何历史（lastDate 为空）不算「断签」，是还没开始
  const broken = data.lastDate !== "" && !inGrace;
  return { broken, longest: data.longest };
}

/**
 * 获取最近 7 天（含今天）的活动状态，用于分享卡的迷你日历。
 * 始终返回 7 项，缺失日期视为未学习。
 */
export function getRecentDays(daysBack = 7): { date: string; active: boolean }[] {
  const activity = new Set(readActivityDates());
  const out: { date: string; active: boolean }[] = [];
  for (let i = daysBack - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const date = `${yyyy}-${mm}-${dd}`;
    out.push({ date, active: activity.has(date) });
  }
  return out;
}
