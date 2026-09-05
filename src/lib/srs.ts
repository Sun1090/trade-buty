/**
 * R5：间隔重复复习（SRS）纯函数核心。
 *
 * R5.1 艾宾浩斯间隔表（天）——lib 内常量，可调整：
 *   1 / 3 / 7 / 14 / 30
 *
 * R5.5 状态机（文档注释即状态图）：
 *
 *   new/wrong ──记错──▶ stage=0（1 天后到期）
 *   stage=N ──答对──▶ stage=N+1（intervals[N+1] 天后到期）
 *   stage=last ──答对──▶ mastered（掌握，移出错题本）
 *   stage=N ──记错──▶ stage=0（1 天后到期）
 *
 * R5.6 兼容旧错题：无 SRS 字段的条目按入库时间（at）回填，
 *   due = 入库日 + intervals[0]，过期即出现在复习队列。
 *
 * 全部日期使用 R4.8 的本地日期口径（date-utils）。
 */
import { localDateStr, shiftDate } from "./date-utils";

/** R5.1：艾宾浩斯间隔表（天） */
export const EBBINGHAUS_INTERVALS = [1, 3, 7, 14, 30] as const;

export interface SrsState {
  /** 当前阶段（0 = 刚记错；等于 intervals 下标） */
  stage: number;
  /** 下次复习日期 YYYY-MM-DD */
  due: string;
  /** 上次复习日期（可缺省） */
  last?: string;
}

export type SrsOutcome = SrsState | "mastered";

/** R5.5：状态机转移——答对推进、答错重置 */
export function srsOnAnswer(
  current: SrsState | null,
  correct: boolean,
  today: string = localDateStr(),
): SrsOutcome {
  if (!correct) {
    return { stage: 0, due: shiftDate(today, EBBINGHAUS_INTERVALS[0]), last: today };
  }
  const stage = current?.stage ?? 0;
  if (stage >= EBBINGHAUS_INTERVALS.length - 1) {
    return "mastered"; // 走完最后一档，掌握
  }
  const nextStage = stage + 1;
  return { stage: nextStage, due: shiftDate(today, EBBINGHAUS_INTERVALS[nextStage]), last: today };
}

/** R5.2：是否到期（到期日 ≤ 今天即到期，含过期） */
export function isSrsDue(due: string | undefined, today: string = localDateStr()): boolean {
  if (!due) return true; // 无日期视为旧数据，按待回填处理 → 到期
  return due <= today;
}

/** R5.4：是否过期未复（到期日 < 今天），用于温和红色提醒 */
export function isSrsOverdue(due: string | undefined, today: string = localDateStr()): boolean {
  if (!due) return false; // 旧数据不标红，避免给新用户制造焦虑
  return due < today;
}

/** R5.6：旧错题回填——按入库时间推算到期日 */
export function backfillSrs(createdAt: number, today: string = localDateStr()): SrsState {
  const createdAtDay = localDateStr(new Date(createdAt));
  return { stage: 0, due: shiftDate(createdAtDay, EBBINGHAUS_INTERVALS[0]) };
}

/** 条目的有效 SRS 状态：有字段用字段，没有则按入库时间回填 */
export function effectiveSrs(
  entry: { srsStage?: number; srsDue?: string; at: number },
  today: string = localDateStr(),
): SrsState {
  if (entry.srsDue) {
    return { stage: entry.srsStage ?? 0, due: entry.srsDue };
  }
  return backfillSrs(entry.at, today);
}

/** 展示用：距到期还有几天（负数为已过期天数） */
export function daysUntilDue(due: string, today: string = localDateStr()): number {
  const [y1, m1, d1] = due.split("-").map(Number);
  const [y2, m2, d2] = today.split("-").map(Number);
  return Math.round((Date.UTC(y1, m1 - 1, d1) - Date.UTC(y2, m2 - 1, d2)) / 86_400_000);
}
