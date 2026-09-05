/**
 * R9.8：7 天未访温和提示的状态持久化。
 *
 * 设计目标：
 * - 每次用户进入任意内容页（mount 内容组件时）调用 `touchLastVisit(now)` 写入 `tb-last-visit`
 * - layout 端 `shouldShowReturnNudge(now)` 判断距上次访问 ≥ 7d 且距上次提示 ≥ 7d 才提示
 * - 提示触发后调用 `markNudgeShown(now)` 写入 `tb-last-visit-nudge`
 * - 全部 SSR 安全（无 localStorage → 返回 null / false）
 * - 字段防御：storage 里的脏 JSON / 非数字 / 负数都按"无记录"处理
 *
 * 与 onboarding.ts / invite-ref.ts 共用 safeStorage 模式。
 */

const STORAGE_KEY = "tb-last-visit";
const NUDGE_SHOWN_KEY = "tb-last-visit-nudge";

/** 距上次访问多久后弹提示（毫秒） */
export const RETURN_NUDGE_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

function safeStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function readNum(key: string): number | null {
  const ls = safeStorage();
  if (!ls) return null;
  try {
    const raw = ls.getItem(key);
    if (raw == null) return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return null;
    return n;
  } catch {
    return null;
  }
}

function writeNum(key: string, value: number): void {
  const ls = safeStorage();
  if (!ls) return;
  try {
    ls.setItem(key, String(Math.floor(value)));
  } catch {
    // ignore
  }
}

/** 记录当前访问时间 */
export function touchLastVisit(now: number = Date.now()): void {
  writeNum(STORAGE_KEY, now);
}

/** 读取上次访问时间（ms）。无记录返回 null。 */
export function getLastVisitAt(): number | null {
  return readNum(STORAGE_KEY);
}

/** 记录本次提示已展示。防抖用——同 7 天内最多展示一次。 */
export function markNudgeShown(now: number = Date.now()): void {
  writeNum(NUDGE_SHOWN_KEY, now);
}

/** 读取上次提示时间（ms）。无记录返回 null。 */
export function getLastNudgeShownAt(): number | null {
  return readNum(NUDGE_SHOWN_KEY);
}

/**
 * 是否应该展示"7 天未访"提示。
 *
 * 规则：
 * 1. 必须有 lastVisit 记录（首次访问用户不弹）
 * 2. 距 lastVisit ≥ 7d
 * 3. 距 lastNudgeShown ≥ 7d（如果从未弹过也满足）
 * 4. 现在距 lastVisit 不能超过 90d（超过视为"太久没来"，归零 lastVisit 并返回 false）
 *
 * @param now 当前时刻（ms），便于测试时注入
 */
export function shouldShowReturnNudge(
  now: number,
  lastVisitAt: number | null = getLastVisitAt(),
  lastNudgeShownAt: number | null = getLastNudgeShownAt(),
): boolean {
  if (lastVisitAt == null) return false;
  if (now - lastVisitAt < RETURN_NUDGE_INTERVAL_MS) return false;
  // 超过 90d 未访 → 视为"断签"，不弹提示，等下次正常访问
  if (now - lastVisitAt > 90 * 24 * 60 * 60 * 1000) return false;
  if (lastNudgeShownAt != null && now - lastNudgeShownAt < RETURN_NUDGE_INTERVAL_MS) {
    return false;
  }
  return true;
}

/**
 * 距离上次访问的天数（向下取整）。无记录返回 null。
 */
export function daysSinceLastVisit(
  now: number,
  lastVisitAt: number | null = getLastVisitAt(),
): number | null {
  if (lastVisitAt == null) return null;
  const diff = now - lastVisitAt;
  if (diff < 0) return 0;
  return Math.floor(diff / (24 * 60 * 60 * 1000));
}
