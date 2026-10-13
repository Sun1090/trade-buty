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
import { isLocalDateStr, localDateStr, shiftDate } from "./date-utils";
import { isRecord, readStorageJson } from "./storage-json";
import { DAILY_SOURCE_CAP_SEC } from "./study-caps";

const KEY = "tb-study-time";

/** 隐私页承诺的保留窗口：以台账里最新的那一天为终点向前保留 90 个日历日（锚不是今天，见 `addStudyTime`） */
export const STUDY_LEDGER_KEEP_DAYS = 90;

export type StudySource = "read" | "quiz" | "replay";

interface DayEntry {
  read?: number;
  quiz?: number;
  replay?: number;
}

type Ledger = Record<string, DayEntry>;

function readLedger(): Ledger {
  const parsed = readStorageJson(KEY);
  if (!isRecord(parsed)) return {};

  const out: Ledger = {};
  for (const [day, rawEntry] of Object.entries(parsed)) {
    if (!isLocalDateStr(day) || !isRecord(rawEntry)) continue;
    const entry: DayEntry = {};
    for (const source of ["read", "quiz", "replay"] as const) {
      const value = rawEntry[source];
      if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
        entry[source] = Math.min(value, DAILY_SOURCE_CAP_SEC);
      }
    }
    if (Object.keys(entry).length > 0) out[day] = entry;
  }
  return out;
}

/**
 * 累加某来源当日学习秒数。防呆是**按天算**的：当日单源封顶 `DAILY_SOURCE_CAP_SEC`，
 * 于累加处夹一次、`readLedger` 读旧台账时再夹一次。两道闸互为备份——备份意味着**行为侧看不出**
 * 哪一道单独失效（R16.320 修复前实测：改任一处，本模块当时 12 条全绿），所以钉它的是
 * `study-caps.ts` 那侧的静态判据（两处夹点必须真的读同一个常量），不是这里的用例数。
 * 读侧那处一改，「外部写坏的超限值由读侧夹回上限」与「上限只有一个主人」两条当场红——
 * 这里点名用例标题而不是数条数：条数会随用例增删变，标了时间也会（R16.323）。
 *
 * **本函数自己不夹单次调用**，但单次调用并非没有上限：上限长在**调用点**，一共三处
 * （`quiz.tsx` 的 `QUIZ_SESSION_CAP_SEC`、`replay-trainer.tsx` 的 `REPLAY_ROUND_CAP_SEC`、
 * 复习那两处的 `REVIEW_CREDIT_SEC`），全部住在 `study-caps.ts`。
 * 这里曾经写着「单次调用没有上限……旧注释里的『单次 ≤4h』在代码里不存在」——**那句是错的**
 * （`148389d` 只翻了本文件，没看调用点；`quiz.tsx` 那个 `4 * 3600` 从 R4.2 起就在那儿）。
 * 阅读那一源（`reading-time-tracker.tsx` 每 5 秒喂 5 秒）确实没有单次闸，
 * 所以「一次报多少就加多少，直到当日那一源被上面那道闸压到上限」只对 read 成立。
 */
export function addStudyTime(source: StudySource, seconds: number, day: string = localDateStr()): void {
  if (!Number.isFinite(seconds) || seconds <= 0) return;
  try {
    const ledger = readLedger();
    const entry = ledger[day] ?? {};
    entry[source] = Math.min((entry[source] ?? 0) + seconds, DAILY_SOURCE_CAP_SEC);
    ledger[day] = entry;
    // 按日历裁剪，锚定台账里最新的一天：稀疏用户的 90 条记录可能横跨一年以上，
    // 按条数裁剪会留下远超 90 天的数据，与隐私页「以最后一次学习那天为终点向前保留 90 个日历日」的说法不符。
    const days = Object.keys(ledger).sort(); // YYYY-MM-DD 字典序即时间序
    const cutoff = shiftDate(days[days.length - 1], -(STUDY_LEDGER_KEEP_DAYS - 1));
    for (const d of days) {
      if (d >= cutoff) break;
      delete ledger[d];
    }
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

/**
 * 台账实际覆盖的头尾两天（`YYYY-MM-DD`，本地日历；台账为空时两头都是 null）。
 * 裁剪锚在「最新有记录的那一天」（见 `addStudyTime` 里的 cutoff），所以隔了一段没学习之后，
 * 总秒数覆盖的并不是「今天往前 90 天」——要说清这一点只能把这两天点名出来。
 */
export function getStudyLedgerSpan(): { firstDay: string | null; lastDay: string | null } {
  const days = Object.keys(readLedger()).sort(); // YYYY-MM-DD 字典序即时间序
  return { firstDay: days[0] ?? null, lastDay: days[days.length - 1] ?? null };
}

/** 今日学习秒数（便捷） */
export function getTodayStudySeconds(): DayStudy {
  return getStudySeconds(localDateStr());
}

/**
 * 学习台账秒数 → 分钟数的唯一口径：向下取整。
 *
 * 为什么住在这里而不是 `weekly-summary.ts`：换算的输入是**这本台账**的去重秒数，
 * 口径该跟数据源走；「周」与「今日」只是取哪几天的差别。原先它叫 `weekMinutes`，
 * 头顶写着「全站唯一口径」，而同一本台账的秒→分钟在 `daily-goal.ts` 还长着第二份
 * 私有副本（`Math.floor(getTodayStudySeconds().total / 60)`）——那句话从来没有主人守着。
 *
 * 为什么取整方向要紧：逐日取整再相加会把 30 秒的一天抬成「1 分钟」，7 天各 30 秒
 * （整周 210 秒）能报成 7 分钟，而同一页的周度摘要报 3 分钟。本模块开头承诺
 * 「绝不放松口径凑数」，所以合计必须是**先加秒、后取整**。
 */
export function studyMinutes(totalSeconds: number): number {
  return Math.floor((Number.isFinite(totalSeconds) ? totalSeconds : 0) / 60);
}
