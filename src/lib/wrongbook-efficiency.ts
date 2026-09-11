/**
 * R12.4：错题复习效率统计——纯聚合器。
 *
 * 数据语义（与 R12.2/R12.3 一致：本地数据优先，不伪造历史日期）：
 * - 当前错题本（tb-wrong）是「待复习」权威来源，永久可读。
 * - 复习应答台账（tb-review-attempts）记录每次 SRS 应答的时间与结果；
 *   旧错题没有台账时不回推日期，报告 dataSource: "current-wrongbook-only"
 *   并给出 no-review-dates 警告。
 *
 * 全部日期使用 R4.8 的本地日期口径（date-utils）。
 */
import { EBBINGHAUS_INTERVALS } from "./srs";
import { localDateStr, shiftDate } from "./date-utils";

export interface ReviewAttemptEntry {
  chapter?: string;
  questionIdx?: unknown;
  correct?: unknown;
  mastered?: unknown;
  /** 应答后的 SRS 阶段（mastered 时为最后一档） */
  stage?: unknown;
  at?: unknown;
}

export interface WrongbookEntryInput {
  at?: unknown;
  srsStage?: unknown;
  srsDue?: unknown;
}

export interface WrongbookEfficiencyBucket {
  date: string;
  reviews: number;
  correct: number;
  mastered: number;
  /** 当日复习正确率；当日无复习为 null */
  accuracyPct: number | null;
}

export interface WrongbookEfficiency {
  version: 1;
  days: WrongbookEfficiencyBucket[];
  latest: {
    /** 当前错题本条目数 */
    pending: number;
    /** 今天到期（含过期） */
    dueToday: number;
    overdue: number;
    /** 台账中掌握（mastered）总次数 */
    masteredAllTime: number;
    /** 当前条目平均 SRS 阶段进度（0–100；阶段越靠后越接近掌握） */
    avgStagePct: number | null;
  };
  summary: {
    reviewsInRange: number;
    correctInRange: number;
    accuracyPct: number | null;
    masteredInRange: number;
    activeDays: number;
    avgReviewsPerDay: number;
  };
  dataSource: "local-review-ledger" | "current-wrongbook-only";
  hasLedger: boolean;
  warnings: string[];
}

const MAX_STAGE = EBBINGHAUS_INTERVALS.length - 1;

const safeNonNegative = (value: unknown): number => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
};

export function normalizeReviewLedger(
  raw: Record<string, unknown> | undefined | null,
): Record<string, ReviewAttemptEntry> {
  if (!raw) return {};
  const out: Record<string, ReviewAttemptEntry> = {};
  for (const [key, entry] of Object.entries(raw)) {
    if (typeof key !== "string" || key.length === 0) continue;
    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      out[key] = entry as ReviewAttemptEntry;
    }
  }
  return out;
}

export function buildWrongbookEfficiency(input: {
  /** 当前错题本条目（tb-wrong） */
  wrongEntries?: Record<string, WrongbookEntryInput | null | undefined>;
  /** 复习应答台账（tb-review-attempts） */
  attempts?: Record<string, unknown>;
  days?: number;
  today?: string;
}): WrongbookEfficiency {
  const wrongEntries = input.wrongEntries ?? {};
  const attempts = normalizeReviewLedger(input.attempts);
  const hasLedger = Object.keys(attempts).length > 0;
  const today =
    input.today && /^\d{4}-\d{2}-\d{2}$/.test(input.today)
      ? input.today
      : localDateStr();
  const requestedDays = Number(input.days);
  const days = Math.min(
    365,
    Math.max(7, Number.isFinite(requestedDays) && requestedDays > 0 ? Math.round(requestedDays) : 7),
  );

  // —— 当前错题本：待复习口径（永久可用，与有无台账无关） ——
  const entries = Object.values(wrongEntries).filter(
    (entry): entry is WrongbookEntryInput => !!entry && typeof entry === "object",
  );
  let dueToday = 0;
  let overdue = 0;
  let stageSum = 0;
  for (const entry of entries) {
    const due =
      typeof entry.srsDue === "string" && /^\d{4}-\d{2}-\d{2}$/.test(entry.srsDue)
        ? entry.srsDue
        : shiftDate(localDateStr(new Date(safeNonNegative(entry.at))), EBBINGHAUS_INTERVALS[0]);
    const stage = Math.min(MAX_STAGE, safeNonNegative(entry.srsStage));
    stageSum += stage;
    if (due <= today) dueToday += 1;
    // 与 isSrsOverdue 一致：旧数据（无 srsDue）不算过期
    if (typeof entry.srsDue === "string" && due < today) overdue += 1;
  }

  // —— 台账：时间序列（只统计有真实时间戳的应答） ——
  const ordered = Object.entries(attempts)
    .flatMap(([key, raw]) => {
      const at = safeNonNegative(raw.at);
      if (at <= 0) return [];
      const chapter =
        typeof raw.chapter === "string" && raw.chapter.length > 0
          ? raw.chapter
          : key.split(":")[0] ?? "";
      if (!chapter) return [];
      return [
        {
          chapter,
          correct: raw.correct === true,
          mastered: raw.mastered === true,
          at,
          date: localDateStr(new Date(at)),
        },
      ];
    })
    .sort((a, b) => a.at - b.at || a.chapter.localeCompare(b.chapter));

  const startDate = shiftDate(today, -(days - 1));
  const buckets: WrongbookEfficiencyBucket[] = [];
  let reviewsInRange = 0;
  let correctInRange = 0;
  let masteredInRange = 0;

  for (let i = 0; i < days; i++) {
    const date = shiftDate(startDate, i);
    const events = ordered.filter((event) => event.date === date);
    const reviews = events.length;
    const correct = events.filter((event) => event.correct).length;
    const mastered = events.filter((event) => event.mastered).length;
    reviewsInRange += reviews;
    correctInRange += correct;
    masteredInRange += mastered;
    buckets.push({
      date,
      reviews,
      correct,
      mastered,
      accuracyPct: reviews > 0 ? Math.round((correct / reviews) * 100) : null,
    });
  }

  const masteredAllTime = ordered.filter((event) => event.mastered).length;
  const warnings: string[] = [];
  if (!hasLedger) warnings.push("no-review-dates");

  return {
    version: 1,
    days: buckets,
    latest: {
      pending: entries.length,
      dueToday,
      overdue,
      masteredAllTime,
      avgStagePct:
        entries.length > 0 ? Math.round((stageSum / entries.length / MAX_STAGE) * 100) : null,
    },
    summary: {
      reviewsInRange,
      correctInRange,
      accuracyPct: reviewsInRange > 0 ? Math.round((correctInRange / reviewsInRange) * 100) : null,
      masteredInRange,
      activeDays: buckets.filter((bucket) => bucket.reviews > 0).length,
      avgReviewsPerDay: Math.round((reviewsInRange / days) * 10) / 10,
    },
    dataSource: hasLedger ? "local-review-ledger" : "current-wrongbook-only",
    hasLedger,
    warnings,
  };
}
