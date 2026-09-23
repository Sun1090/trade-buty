/**
 * R12.12：统计数据导出（字段版本化）。
 *
 * 设计约束：
 * - 本地生成、不出站——纯数据函数 + 客户端下载助手，不接触网络；
 * - 顶层必须有 format 标识与 version——将来字段增删靠 version 分支迁移，
 *   旧文件可以被将来的导入工具识别并安全跳过/迁移；
 * - 字段命名稳定：新增字段只追加；要改名或改语义，必须连着 version 一起动，
 *   并由 `stats-export.test.ts` 的叶子路径清单显式过一遍（v1 → v2 就是这么走的）；
 * - 对损坏本地数据容错：所有数字来源都经过聚合器/账本读的防崩假体。
 */

import { STUDY_LEDGER_KEEP_DAYS } from "./study-time";

export const STATS_EXPORT_FORMAT = "trade-buty-stats-export";
export const STATS_EXPORT_VERSION = 2 as const;

/**
 * 字段名自 v1 起冻结（文件头契约 + `stats-export.test.ts` 的叶子路径钉死）。
 *
 * **v1 → v2（R16.11）**：v1 有两个键名不副实，用户拿到的是自己的数据，名字却在说别的
 * ——`quizzes.bestPct` 装的是各章最高百分比再取平均，`engagement.totalStudySeconds`
 * 是「近 N 天窗口」的合计（台账本来就只留这些）。走文件头写明的迁移通道：改名 + 版本号 +1，
 * 不顺手改也不追加同义键。窗口天数不再藏进键名（那个数会变），改为随行给出
 * `engagement.studyWindowDays`，值取自裁剪台账用的同一个常量。
 */
export interface StatsExportInput {
  locale: string;
  courses: { readDocs: number; totalDocs: number; doneChapters: number; totalChapters: number; completionPct: number };
  quizzes: { done: number; total: number; avgBestPct: number | null };
  replay: { rounds: number; accuracyPct: number | null; bestStreak: number };
  review: { pending: number; dueToday: number; overdue: number };
  engagement: { studySeconds: number; currentStreak: number; longestStreak: number };
  goals: { dailyGoalMinutes: number };
}

export interface StatsExportPayload {
  format: typeof STATS_EXPORT_FORMAT;
  version: number;
  exportedAt: string;
  locale: string;
  data: {
    courses: StatsExportInput["courses"];
    quizzes: StatsExportInput["quizzes"];
    replay: StatsExportInput["replay"];
    review: StatsExportInput["review"];
    engagement: StatsExportInput["engagement"] & {
      /** `studySeconds` 覆盖的天数，取自裁剪台账的同一个常量 */
      studyWindowDays: number;
    };
    goals: StatsExportInput["goals"];
  };
}

const clampNonNegative = (n: number): number => (Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0);
const clampPct = (n: number | null): number | null =>
  n === null || !Number.isFinite(n) ? null : Math.min(100, Math.max(0, Math.round(n)));

/** 构建版本化导出负载（纯函数；时间可注入便于测试） */
export function buildStatsExport(input: StatsExportInput, now: Date = new Date()): StatsExportPayload {
  return {
    format: STATS_EXPORT_FORMAT,
    version: STATS_EXPORT_VERSION,
    exportedAt: now.toISOString(),
    locale: input.locale === "en" ? "en" : "zh",
    data: {
      courses: {
        readDocs: clampNonNegative(input.courses.readDocs),
        totalDocs: clampNonNegative(input.courses.totalDocs),
        doneChapters: clampNonNegative(input.courses.doneChapters),
        totalChapters: clampNonNegative(input.courses.totalChapters),
        completionPct: clampPct(input.courses.completionPct) ?? 0,
      },
      quizzes: {
        done: clampNonNegative(input.quizzes.done),
        total: clampNonNegative(input.quizzes.total),
        avgBestPct: clampPct(input.quizzes.avgBestPct),
      },
      replay: {
        rounds: clampNonNegative(input.replay.rounds),
        accuracyPct: clampPct(input.replay.accuracyPct),
        bestStreak: clampNonNegative(input.replay.bestStreak),
      },
      review: {
        pending: clampNonNegative(input.review.pending),
        dueToday: clampNonNegative(input.review.dueToday),
        overdue: clampNonNegative(input.review.overdue),
      },
      engagement: {
        studySeconds: clampNonNegative(input.engagement.studySeconds),
        studyWindowDays: STUDY_LEDGER_KEEP_DAYS,
        currentStreak: clampNonNegative(input.engagement.currentStreak),
        longestStreak: clampNonNegative(input.engagement.longestStreak),
      },
      goals: { dailyGoalMinutes: clampNonNegative(input.goals.dailyGoalMinutes) },
    },
  };
}

export function serializeStatsExport(payload: StatsExportPayload): string {
  return JSON.stringify(payload, null, 2);
}

/**
 * 客户端下载助手：仅在浏览器环境调用。
 * 文件名带 UTC 日期，便于多次导出区分。
 */
export function downloadStatsExport(payload: StatsExportPayload): string {
  const datePart = payload.exportedAt.slice(0, 10);
  const filename = `trade-buty-stats-${datePart}.json`;
  const blob = new Blob([serializeStatsExport(payload)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return filename;
}
