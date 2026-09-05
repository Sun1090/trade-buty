/**
 * R8.8 邮件订阅占位（纯前端，无后端）。
 *
 * 设计：
 * - localStorage key tb-newsletter-email 保存用户填写的邮箱（仅本机）
 * - 导出：返回 JSON 字符串，供用户下载/复制带走
 * - 不抛错：无 localStorage 时静默
 * - 邮箱校验：仅做最浅的格式校验，不替后端做风控
 */

const STORAGE_KEY = "tb-newsletter-email";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface NewsletterRecord {
  email: string;
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

export function isValidEmail(email: string): boolean {
  if (!email || email.length > 254) return false;
  return EMAIL_RE.test(email);
}

/** 写入订阅邮箱（仅本地）。无效邮箱静默忽略。 */
export function saveNewsletter(email: string, now: number = Date.now()): boolean {
  if (!isValidEmail(email)) return false;
  const ls = safeStorage();
  if (!ls) return false;
  try {
    ls.setItem(STORAGE_KEY, JSON.stringify({ email, recordedAt: now } satisfies NewsletterRecord));
    return true;
  } catch {
    return false;
  }
}

/** 读取当前订阅邮箱；无记录返回 null。 */
export function readNewsletter(): NewsletterRecord | null {
  const ls = safeStorage();
  if (!ls) return null;
  try {
    const raw = ls.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const o = parsed as Record<string, unknown>;
    if (typeof o.email !== "string" || typeof o.recordedAt !== "number" || !isValidEmail(o.email)) {
      try { ls.removeItem(STORAGE_KEY); } catch { /* noop */ }
      return null;
    }
    return o as unknown as NewsletterRecord;
  } catch {
    return null;
  }
}

/** 清掉订阅记录。 */
export function clearNewsletter(): void {
  const ls = safeStorage();
  if (!ls) return;
  try { ls.removeItem(STORAGE_KEY); } catch { /* noop */ }
}

/** 导出订阅记录的 JSON（供用户复制/下载）。无记录返回 null。 */
export function exportNewsletter(): string | null {
  const r = readNewsletter();
  if (!r) return null;
  return JSON.stringify(r, null, 2);
}

export const NEWSLETTER_STORAGE_KEY = STORAGE_KEY;
