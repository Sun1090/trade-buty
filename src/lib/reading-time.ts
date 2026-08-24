/**
 * 阅读时长统计：记录每篇课程的停留时间（秒）
 * 只记录本地，用于仪表盘展示
 */
const KEY = "tb-reading-time";

interface ReadingTimeData {
  /** key = chapter/doc, value = 秒 */
  [key: string]: number;
}

export function readReadingTime(): ReadingTimeData {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as ReadingTimeData;
  } catch {
    return {};
  }
}

/** 获取某篇课程的阅读时长（秒） */
export function getReadingTime(chapter: string, doc: string): number {
  return readReadingTime()[`${chapter}/${doc}`] ?? 0;
}

/** 累加阅读时长（秒） */
export function addReadingTime(chapter: string, doc: string, seconds: number): void {
  try {
    const all = readReadingTime();
    const key = `${chapter}/${doc}`;
    all[key] = (all[key] ?? 0) + seconds;
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // ignore
  }
}

/** 总阅读时长（秒） */
export function getTotalReadingTime(): number {
  const all = readReadingTime();
  return Object.values(all).reduce((s, v) => s + v, 0);
}

/** 格式化秒为 xh xm xs */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}
