/**
 * 回访提示在 sessionStorage 里的两个键，派发方（`auth-provider`）与消费方
 * （`return-nudge-toast`）共用一份字面量。
 *
 * 单独成模块是因为派发侧刻意不把 `@/lib/last-visit` 静态引进主 chunk（懒加载），
 * 而这两个键名又必须两边一模一样——抄两遍就会有一个键读不到另一个键写下的东西。
 */

/** 有提示待弹（lazy toast 可能挂载晚于事件，靠它补消费一次） */
export const RETURN_NUDGE_PENDING_KEY = "tb-return-nudge-pending";

/**
 * R16.189：这一次待弹的**实测**未访天数。
 * 事件里带着同一个数字，但事件错过了就没有第二次；而 `touchLastVisit` 已经先把
 * 本次访问时间写进台账，事后任何「重新量一遍」都会量出 0。所以间隔必须存下来。
 */
export const RETURN_NUDGE_DAYS_KEY = "tb-return-nudge-days";

/** 同会话只弹一次的去重标记 */
export const RETURN_NUDGE_SHOWN_KEY = "tb-return-nudge-shown";
