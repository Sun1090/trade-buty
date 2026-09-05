/**
 * R8.6 新手引导进度持久化。
 *
 * 设计目标：
 * - 三步：path / replay / review；用户看完任意一步可 Next；Finish/Skip 后不再展示
 * - localStorage key: tb-onboarded（true=已完成/已跳过）
 * - 不抛错：无 localStorage（SSR / 隐私模式）时静默返回 null/false
 * - 字段防御：storage 里脏 JSON / 非 boolean 值都按未开始处理
 */

const STORAGE_KEY = "tb-onboarded";

export type OnboardStep = "path" | "replay" | "review";
export const ONBOARD_STEPS: OnboardStep[] = ["path", "replay", "review"];

function safeStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/** 是否已结束引导（Finish 或 Skip）。无 storage 时返回 false。 */
export function hasOnboarded(): boolean {
  const ls = safeStorage();
  if (!ls) return false;
  try {
    const raw = ls.getItem(STORAGE_KEY);
    return raw === "1" || raw === "true";
  } catch {
    return false;
  }
}

/**
 * 当前应该展示哪一步。返回 null 表示不再展示。
 * step 索引越界、storage 缺失都返回 null（视为已结束）。
 */
export function getCurrentStep(): OnboardStep | null {
  const ls = safeStorage();
  if (!ls) return null;
  try {
    const raw = ls.getItem(STORAGE_KEY);
    if (raw === "1" || raw === "true") return null;
    if (raw === "path" || raw === "replay" || raw === "review") return raw;
    return null;
  } catch {
    return null;
  }
}

/** 进入下一步；到末步自动标记结束。返回新的当前步。 */
export function advanceStep(current: OnboardStep): OnboardStep | "done" {
  const idx = ONBOARD_STEPS.indexOf(current);
  if (idx < 0) return "done";
  if (idx >= ONBOARD_STEPS.length - 1) {
    markDone();
    return "done";
  }
  const next = ONBOARD_STEPS[idx + 1];
  persist(next);
  return next;
}

/** 记录指定步为当前步（用于回退/重看）。 */
export function setStep(step: OnboardStep): void {
  persist(step);
}

/** 标记引导结束（Finish 或 Skip）。 */
export function markDone(): void {
  persist("1");
}

/** 重置引导（用于测试 / 主动重看）。 */
export function resetOnboarding(): void {
  const ls = safeStorage();
  if (!ls) return;
  try { ls.removeItem(STORAGE_KEY); } catch { /* noop */ }
}

function persist(value: OnboardStep | "1"): void {
  const ls = safeStorage();
  if (!ls) return;
  try { ls.setItem(STORAGE_KEY, value); } catch { /* noop */ }
}

export const ONBOARDING_STORAGE_KEY = STORAGE_KEY;
