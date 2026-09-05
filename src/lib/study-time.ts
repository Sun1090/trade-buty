/**
 * R4.2：学习时长统一台账——按「本地日期 × 来源」记录秒数。
 *
 * 三源：read（阅读计时）/ quiz（测验）/ replay（回放）。
 * 去重口径（R4.2 核心约定）：阅读计时与做题/回放可能同时进行（同一页面
 * 同时计时），单日总时长 = max(read, quiz + replay)，绝不重复叠加重叠时段。
 *
 * R4.9 最低门槛约定：阅读计时 5 秒一个 tick（reading-time-tracker），
 * 打开课程页停留 ≥5 秒即计入当日 read——「打开即算活跃」的兜底口径。
 * quiz/replay 由组件在会话结束时上报实际耗时。
 */
import { localDateStr } from "./date-utils";

const KEY = "tb-study-time";

export type StudySource = "read" | "quiz" | "replay";

interface DayEntry {
  read?: number;
  quiz?: number;
  replay?: number;
}

type Ledger = Record<string, DayEntry>;

function readLedger(): Ledger {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Ledger;
  } catch {
    return {};
  }
}

/** 累加某来源当日学习秒数（单次 ≤4h、单日单源 ≤8h 防呆） */
export function addStudyTime(source: StudySource, seconds: number, day: string = localDateStr()): void {
  if (!Number.isFinite(seconds) || seconds <= 0) return;
  try {
    const ledger = readLedger();
    const entry = ledger[day] ?? {};
    entry[source] = Math.min((entry[source] ?? 0) + seconds, 8 * 3600);
    ledger[day] = entry;
    // 只保留最近 90 天，控制体积
    const days = Object.keys(ledger).sort();
    while (days.length > 90) delete ledger[days.shift() as string];
    localStorage.setItem(KEY, JSON.stringify(ledger));
    window.dispatchEvent(new Event("tb-study-time"));
  } catch {
    // ignore
  }
}

export interface DayStudy {
  date: string;
  read: number;
  quiz: number;
  replay: number;
  /** 去重后总秒数 = max(read, quiz + replay) */
  total: number;
}

export function getStudySeconds(day: string): DayStudy {
  const e = readLedger()[day] ?? {};
  const read = e.read ?? 0;
  const quiz = e.quiz ?? 0;
  const replay = e.replay ?? 0;
  return { date: day, read, quiz, replay, total: Math.max(read, quiz + replay) };
}

/** 近 n 天序列（含今天，旧→新），周报/柱状图用 */
export function getStudySeries(n: number, today: string = localDateStr()): DayStudy[] {
  const out: DayStudy[] = [];
  const [y, m, d] = today.split("-").map(Number);
  for (let i = n - 1; i >= 0; i--) {
    const dt = new Date(y, m - 1, d, 12, 0, 0);
    dt.setDate(dt.getDate() - i);
    out.push(getStudySeconds(localDateStr(dt)));
  }
  return out;
}

/** 全部台账去重总秒数（口径对账用：统计页总时长 = Σ各日 max(read, quiz+replay)） */
export function getTotalStudySeconds(): number {
  const ledger = readLedger();
  return Object.keys(ledger).reduce((sum, day) => sum + getStudySeconds(day).total, 0);
}

/** 今日学习秒数（便捷） */
export function getTodayStudySeconds(): DayStudy {
  return getStudySeconds(localDateStr());
}

