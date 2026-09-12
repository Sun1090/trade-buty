/**
 * R12.23：统计数据一致性校验——跨聚合器口径对账。
 *
 * 统计页同一屏展示五个聚合器（总览/课程/测验/复习/回放）与 learn-stats
 * 的汇总，任何口径漂移都会让用户看到互相矛盾的数字。此审计器把
 * 「同一事实的多个口径」收敛为一组可断言的恒等式与范围约束：
 *
 * - 课程：overview ↔ courseTrend 的 readDocs/doneChapters/totalDocs/completionPct 必须一致
 * - 测验：overview.quizzes.done ↔ quizTrend.latest.doneQuizzes 必须一致
 * - 回放：overview.replay.rounds ↔ replayTrend.allTime.totalRounds 必须一致
 * - 错题：stats.wrongCount ↔ reviewTrend.latest.pending 必须一致，
 *   且 overdue ≤ dueToday ≤ pending
 * - 所有百分比字段必须 ∈ [0,100] 或 null（绝不 NaN）
 *
 * 供测试与开发期诊断使用；返回的问题列表为空即口径一致。
 */
import type { LearningOverview } from "./learning-overview";
import type { CourseCompletionTrend } from "./course-completion-trend";
import type { QuizScoreTrend } from "./quiz-score-trend";
import type { WrongbookEfficiency } from "./wrongbook-efficiency";
import type { ReplayTimeTrend } from "./replay-time-trend";

export interface StatsLike {
  wrongCount?: number;
  currentWrong?: number;
  avgQuizScore?: number | null;
  replayAccuracy?: number | null;
}

export interface ConsistencyIssue {
  code: string;
  detail: string;
}

export interface StatsConsistencyInput {
  overview?: LearningOverview | null;
  courseTrend?: CourseCompletionTrend | null;
  quizTrend?: QuizScoreTrend | null;
  reviewTrend?: WrongbookEfficiency | null;
  replayTrend?: ReplayTimeTrend | null;
  stats?: StatsLike | null;
}

const pctOk = (value: number | null | undefined): boolean =>
  value === null || value === undefined || (Number.isFinite(value) && value >= 0 && value <= 100);

export function auditStatsConsistency(input: StatsConsistencyInput): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];
  const { overview, courseTrend, quizTrend, reviewTrend, replayTrend, stats } = input;

  if (!overview) {
    issues.push({ code: "missing-overview", detail: "learning overview is required for consistency audit" });
    return issues;
  }

  // —— 课程口径 ——
  if (courseTrend) {
    if (overview.courses.readDocs !== courseTrend.latest.readDocs) {
      issues.push({
        code: "course-read-docs-mismatch",
        detail: `overview=${overview.courses.readDocs} vs courseTrend=${courseTrend.latest.readDocs}`,
      });
    }
    if (overview.courses.doneChapters !== courseTrend.latest.doneChapters) {
      issues.push({
        code: "course-done-chapters-mismatch",
        detail: `overview=${overview.courses.doneChapters} vs courseTrend=${courseTrend.latest.doneChapters}`,
      });
    }
    if (overview.courses.totalDocs !== courseTrend.latest.totalDocs) {
      issues.push({
        code: "course-total-docs-mismatch",
        detail: `overview=${overview.courses.totalDocs} vs courseTrend=${courseTrend.latest.totalDocs}`,
      });
    }
    if (overview.courses.completionPct !== courseTrend.latest.completionPct) {
      issues.push({
        code: "course-completion-pct-mismatch",
        detail: `overview=${overview.courses.completionPct} vs courseTrend=${courseTrend.latest.completionPct}`,
      });
    }
  }

  // —— 测验口径 ——
  if (quizTrend) {
    if (overview.quizzes.done !== quizTrend.latest.doneQuizzes) {
      issues.push({
        code: "quiz-done-mismatch",
        detail: `overview=${overview.quizzes.done} vs quizTrend=${quizTrend.latest.doneQuizzes}`,
      });
    }
  }

  // —— 回放口径 ——
  if (replayTrend) {
    if (overview.replay.rounds !== replayTrend.allTime.totalRounds) {
      issues.push({
        code: "replay-rounds-mismatch",
        detail: `overview=${overview.replay.rounds} vs replayTrend=${replayTrend.allTime.totalRounds}`,
      });
    }
  }

  // —— 错题口径 ——
  if (stats && reviewTrend) {
    const wrongCount = stats.currentWrong ?? stats.wrongCount;
    if (wrongCount !== undefined && wrongCount !== reviewTrend.latest.pending) {
      issues.push({
        code: "wrong-pending-mismatch",
        detail: `stats=${wrongCount} vs reviewTrend=${reviewTrend.latest.pending}`,
      });
    }
  }
  if (reviewTrend) {
    const { pending, dueToday, overdue } = reviewTrend.latest;
    if (!(0 <= overdue && overdue <= dueToday && dueToday <= pending)) {
      issues.push({
        code: "wrong-range-inversion",
        detail: `expected 0 ≤ overdue(${overdue}) ≤ dueToday(${dueToday}) ≤ pending(${pending})`,
      });
    }
  }

  // —— 百分比范围 ——
  const pcts: [string, number | null | undefined][] = [
    ["overview.courses.completionPct", overview.courses.completionPct],
    ["overview.quizzes.bestPct", overview.quizzes.bestPct],
    ["overview.replay.accuracyPct", overview.replay.accuracyPct],
    ["quizTrend.latest.bestPct", quizTrend?.latest.bestPct],
    ["quizTrend.latest.avgPct", quizTrend?.latest.avgPct],
    ["quizTrend.summary.bestInRangePct", quizTrend?.summary.bestInRangePct],
    ["reviewTrend.summary.accuracyPct", reviewTrend?.summary.accuracyPct],
    ["reviewTrend.latest.avgStagePct", reviewTrend?.latest.avgStagePct],
    ["replayTrend.summary.accuracyInRangePct", replayTrend?.summary.accuracyInRangePct],
    ["replayTrend.allTime.bestAccuracyPct", replayTrend?.allTime.bestAccuracyPct],
  ];
  for (const [name, value] of pcts) {
    if (!pctOk(value)) {
      issues.push({ code: "pct-out-of-range", detail: `${name}=${String(value)} not in [0,100] or null` });
    }
  }

  return issues;
}
