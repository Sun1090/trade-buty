/**
 * R12.5：回放练习时长统计——纯聚合器。
 *
 * 数据语义（与 R12 系列一致：本地数据优先，不伪造历史信息）：
 * - 回放历史（tb-replay-history）每条记录自带真实时间戳 at，轮数可直接按天聚合。
 * - 耗时 durationSec 由 R12.5 起随新记录写入；旧记录缺省即「无时长」，
 *   不回推、不估算，统计口径内不计入时长，并给出 no-round-durations 警告。
 * - 时长清洗：负数/非数 → 按无时长处理；单轮超过 `REPLAY_ROUND_CAP_SEC` → 截到该上限。
 *   那句「与 study-time 防呆一致」此前只是字面像：上限住在 `study-caps.ts`，
 *   两处各自 import，而「单轮 ≤ 当日每源」这条关系由 `study-caps.test.ts` 钉住。
 */
import { isLocalDateStr, localDateStr, shiftDate } from "./date-utils";
import { DAILY_SOURCE_CAP_SEC, REPLAY_ROUND_CAP_SEC } from "./study-caps";

export interface ReplayHistoryEntry {
  at?: unknown;
  symbol?: unknown;
  interval?: unknown;
  total?: unknown;
  correct?: unknown;
  bestStreak?: unknown;
  durationSec?: unknown;
}

export interface ReplayTimeBucket {
  date: string;
  rounds: number;
  durationSec: number;
  /** 当日判断正确率；当日无回放为 null */
  accuracyPct: number | null;
  /** 当日有时长数据的轮数（可能 < rounds，旧记录无时长） */
  timedRounds: number;
}

export interface ReplayTimeTrend {
  version: 1;
  days: ReplayTimeBucket[];
  allTime: {
    totalRounds: number;
    totalDurationSec: number;
    avgSecPerRound: number | null;
    bestStreak: number;
    bestAccuracyPct: number | null;
  };
  summary: {
    roundsInRange: number;
    durationInRangeSec: number;
    timedRoundsInRange: number;
    avgSecInRange: number | null;
    accuracyInRangePct: number | null;
    activeDays: number;
    /**
     * 窗口里有几天「每轮耗时相加」超过了台账的当日单源封顶。
     *
     * 这块的时长只被**单轮**闸夹（`safeDuration`），而 `/stats` 下面那张「台账学习时长」
     * 读的是学习台账，它另有**当日**闸。所以一天做满 3 轮 × 4 小时，这块报 12 小时、
     * 台账报 8 小时——同一屏上「部分」大于「整体」。这个计数就是给界面判断
     * 「要不要说明这件事」用的：为 0 时两个数必然一致，不该冒出任何解释。
     */
    daysOverDailyCapInRange: number;
  };
  dataSource: "local-replay-history" | "no-replay-history";
  hasHistory: boolean;
  hasDurations: boolean;
  warnings: string[];
}

const safeNonNegative = (value: unknown): number => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
};

const safeDuration = (value: unknown): number | null => {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(REPLAY_ROUND_CAP_SEC, Math.round(n));
};

export function normalizeReplayHistory(raw: unknown): ReplayHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (entry): entry is ReplayHistoryEntry => !!entry && typeof entry === "object" && !Array.isArray(entry),
  );
}

export function buildReplayTimeTrend(input: {
  history?: unknown;
  days?: number;
  today?: string;
}): ReplayTimeTrend {
  const history = normalizeReplayHistory(input.history);
  const today =
    isLocalDateStr(input.today)
      ? input.today
      : localDateStr();
  const requestedDays = Number(input.days);
  const days = Math.min(
    365,
    Math.max(7, Number.isFinite(requestedDays) && requestedDays > 0 ? Math.round(requestedDays) : 7),
  );

  const ordered = history
    .flatMap((entry) => {
      const at = safeNonNegative(entry.at);
      if (at <= 0) return [];
      const total = safeNonNegative(entry.total);
      const correct = Math.min(safeNonNegative(entry.correct), total);
      return [
        {
          at,
          date: localDateStr(new Date(at)),
          total,
          correct,
          bestStreak: safeNonNegative(entry.bestStreak),
          durationSec: safeDuration(entry.durationSec),
        },
      ];
    })
    .sort((a, b) => a.at - b.at);

  const startDate = shiftDate(today, -(days - 1));
  const buckets: ReplayTimeBucket[] = [];
  let roundsInRange = 0;
  let durationInRangeSec = 0;
  let timedRoundsInRange = 0;
  let correctInRange = 0;
  let totalInRange = 0;
  // 窗口里有几天「每轮相加」超过了当日封顶（见 `daysOverDailyCapInRange` 的注释）
  let daysOverDailyCapInRange = 0;

  for (let i = 0; i < days; i++) {
    const date = shiftDate(startDate, i);
    const events = ordered.filter((event) => event.date === date);
    const rounds = events.length;
    const durationSec = events.reduce((sum, event) => sum + (event.durationSec ?? 0), 0);
    const timedRounds = events.filter((event) => event.durationSec !== null).length;
    const total = events.reduce((sum, event) => sum + event.total, 0);
    const correct = events.reduce((sum, event) => sum + event.correct, 0);
    roundsInRange += rounds;
    durationInRangeSec += durationSec;
    timedRoundsInRange += timedRounds;
    correctInRange += correct;
    totalInRange += total;
    if (durationSec > DAILY_SOURCE_CAP_SEC) daysOverDailyCapInRange += 1;
    buckets.push({
      date,
      rounds,
      durationSec,
      accuracyPct: total > 0 ? Math.round((Math.min(correct, total) / total) * 100) : null,
      timedRounds,
    });
  }

  // 全量口径（不受时间窗限制）
  const allTotal = ordered.reduce((sum, event) => sum + event.total, 0);
  const allCorrect = ordered.reduce((sum, event) => sum + event.correct, 0);
  const timed = ordered.filter((event) => event.durationSec !== null);
  const totalDurationSec = timed.reduce((sum, event) => sum + (event.durationSec ?? 0), 0);
  const bestStreak = ordered.reduce((max, event) => Math.max(max, event.bestStreak), 0);

  const warnings: string[] = [];
  const hasHistory = ordered.length > 0;
  const hasDurations = timed.length > 0;
  if (!hasHistory) warnings.push("no-replay-history");
  else if (!hasDurations) warnings.push("no-round-durations");

  return {
    version: 1,
    days: buckets,
    allTime: {
      totalRounds: ordered.length,
      totalDurationSec,
      avgSecPerRound: timed.length > 0 ? Math.round(totalDurationSec / timed.length) : null,
      bestStreak,
      bestAccuracyPct: allTotal > 0 ? Math.round((allCorrect / allTotal) * 100) : null,
    },
    summary: {
      roundsInRange,
      durationInRangeSec,
      timedRoundsInRange,
      avgSecInRange: timedRoundsInRange > 0 ? Math.round(durationInRangeSec / timedRoundsInRange) : null,
      accuracyInRangePct: totalInRange > 0 ? Math.round((correctInRange / totalInRange) * 100) : null,
      activeDays: buckets.filter((bucket) => bucket.rounds > 0).length,
      daysOverDailyCapInRange,
    },
    dataSource: hasHistory ? "local-replay-history" : "no-replay-history",
    hasHistory,
    hasDurations,
    warnings,
  };
}
