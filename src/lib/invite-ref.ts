/**
 * R8.5 邀请参数 (?ref=xxx) 持久化与读取。
 *
 * 设计目标：
 * - URL 上的 ?ref=xxx 进入页面时调用 recordInvite(ref) 写入 localStorage
 * - TTL 30 天（按产品决策）
 * - 多 tab 同步：监听 storage 事件让其他标签页也能读取
 * - 不抛错：无 localStorage（SSR / 隐私模式）时静默返回 null
 *
 * 注意：ref 值不做任何校验——后端统计时会去重 + 风控。
 * ref 长度上限 64 字符以防被滥用塞大字符串。
 */

const STORAGE_KEY = "tb-invite-ref";
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 天
const MAX_LEN = 64;

export interface InviteRefRecord {
  ref: string;
  /** Unix ms */
  expiresAt: number;
  /** Unix ms，写入时记录 */
  recordedAt: number;
}

function safeStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function isValidRef(ref: string): boolean {
  if (!ref || ref.length > MAX_LEN) return false;
  // 只允许 URL-safe 字符（字母数字、-、_）
  return /^[A-Za-z0-9_-]+$/.test(ref);
}

/** 写入邀请 ref（带 TTL）。无效输入静默忽略。 */
export function recordInvite(ref: string, now: number = Date.now()): boolean {
  if (!isValidRef(ref)) return false;
  const ls = safeStorage();
  if (!ls) return false;
  const record: InviteRefRecord = {
    ref,
    recordedAt: now,
    expiresAt: now + TTL_MS,
  };
  try {
    ls.setItem(STORAGE_KEY, JSON.stringify(record));
    return true;
  } catch {
    return false;
  }
}

/** 读取当前有效的邀请 ref；过期或无效返回 null。 */
export function readInvite(now: number = Date.now()): InviteRefRecord | null {
  const ls = safeStorage();
  if (!ls) return null;
  try {
    const raw = ls.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const o = parsed as Record<string, unknown>;
    if (
      typeof o.ref !== "string" ||
      typeof o.expiresAt !== "number" ||
      typeof o.recordedAt !== "number" ||
      !isValidRef(o.ref) ||
      o.expiresAt <= now
    ) {
      // 失效记录顺手清掉
      try { ls.removeItem(STORAGE_KEY); } catch { /* noop */ }
      return null;
    }
    return o as unknown as InviteRefRecord;
  } catch {
    return null;
  }
}

/** 清掉邀请记录（用于测试 / 用户主动退出）。 */
export function clearInvite(): void {
  const ls = safeStorage();
  if (!ls) return;
  try { ls.removeItem(STORAGE_KEY); } catch { /* noop */ }
}

/**
 * URL 上的 ref 参数（query string）。
 * R8.5 仅在 hydration 后调用一次（不能 SSR 写 localStorage）。
 */
export function getRefFromUrl(search: string | URLSearchParams): string | null {
  const params =
    typeof search === "string"
      ? new URLSearchParams(search.startsWith("?") ? search : `?${search}`)
      : search;
  const ref = params.get("ref");
  return ref && isValidRef(ref) ? ref : null;
}

/** 暴露 storage key 供测试 / 同 tab 调试使用。 */
export const INVITE_STORAGE_KEY = STORAGE_KEY;
export const INVITE_TTL_MS = TTL_MS;
