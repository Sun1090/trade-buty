/**
 * 学习活动日历：记录每天的学习日期（用于热力图）
 * 数据来源：progress 的 at 时间? progress 没记时间。用阅读时长记录补充。
 * 这里用一个简单的活动记录——每次 touchStreak 记录当天日期。
 */
const KEY = "tb-activity";

export function readActivityDates(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

/** 记录今天有学习活动（touchStreak 内部调用） */
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function recordActivity(): void {
  try {
    const dates = readActivityDates();
    const today = todayStr();
    if (!dates.includes(today)) {
      dates.push(today);
      localStorage.setItem(KEY, JSON.stringify(dates.slice(-365)));
    }
  } catch {
    // ignore
  }
}