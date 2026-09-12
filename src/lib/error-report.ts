/**
 * R7.6：前端错误上报分级 + 统一隐私安全上报端点。
 * - fatal：阻断用户流程的崩溃（路由级 ErrorBoundary、根布局崩溃）→ console.error + 远端日志
 * - recoverable：单次操作失败、有 UI 反馈（如 AI 请求失败）→ console.warn + 远端日志
 * - silent：可完全忽略的后台失败（埋点上报失败等）→ console.info（仅本机，不发送）
 *
 * 远端上报刻意不发送错误正文，只发送封闭的 level/scope/kind 与 Next.js digest。
 * 错误 message、stack、页面 URL、账号身份和调用方 meta 的其他字段都不会离开浏览器，
 * 从源头杜绝用户输入、课程内容或账号信息进入服务端日志。
 */
import type { AiEntry } from "./analytics";

export type ErrorLevel = "fatal" | "recoverable" | "silent";

/** 同源上报端点（CSP `connect-src 'self'` 已放行，无需新增白名单）。 */
export const ERROR_REPORT_ENDPOINT = "/api/error-reports";

/** 请求体上限：载荷本身只有四个短字段，超过即视为滥用。 */
export const MAX_ERROR_REPORT_BYTES = 2_048;
export const MAX_SCOPE_LENGTH = 40;
export const MAX_KIND_LENGTH = 40;
export const MAX_DIGEST_LENGTH = 64;

/** 允许出现在服务端载荷里的字段；其余一律拒绝，防止夹带 PII。 */
export const ERROR_REPORT_ALLOWED_KEYS = ["level", "scope", "kind", "digest"] as const;

const SAFE_TOKEN = /^[a-z0-9][a-z0-9._:-]*$/i;

/**
 * 校验上报字段是否为安全 token：非空、限长、且只含 `[a-z0-9._:-]`。
 * 这排除了空白与任意自由文本，因此 scope/kind/digest 无法承载用户内容。
 */
export function isSafeReportToken(value: unknown, maxLength: number): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maxLength &&
    SAFE_TOKEN.test(value)
  );
}

export interface ErrorReportPayload {
  level: Exclude<ErrorLevel, "silent">;
  scope: string;
  kind: string;
  digest?: string;
}

/**
 * 构造可由服务端白名单复核的隐私安全载荷。
 * 错误 message、stack、页面 URL、用户身份和调用方 meta 的其他字段一概不进入载荷。
 */
export function buildErrorReportPayload(
  level: ErrorLevel,
  scope: AiEntry | string,
  err: unknown,
  meta?: Record<string, string | number>,
): ErrorReportPayload | null {
  if (level === "silent") return null;

  const safeScope = typeof scope === "string" ? scope.trim() : scope;
  if (!isSafeReportToken(safeScope, MAX_SCOPE_LENGTH)) return null;

  const rawKind = err instanceof Error ? err.name.trim() : typeof err;
  const kind = isSafeReportToken(rawKind, MAX_KIND_LENGTH) ? rawKind : "Error";

  const rawDigest = typeof meta?.digest === "string" ? meta.digest.trim() : "";
  const digest = isSafeReportToken(rawDigest, MAX_DIGEST_LENGTH) ? rawDigest : undefined;

  return {
    level,
    scope: safeScope,
    kind,
    ...(digest ? { digest } : {}),
  };
}

/** 最佳努力发送；使用 sendBeacon 优先，失败回退 keepalive fetch，绝不重试或抛错。 */
export function sendErrorReport(payload: ErrorReportPayload): void {
  if (typeof window === "undefined") return;
  const body = JSON.stringify(payload);

  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const queued = navigator.sendBeacon(
        ERROR_REPORT_ENDPOINT,
        new Blob([body], { type: "application/json" }),
      );
      if (queued) return;
    }
  } catch {
    // 继续尝试 fetch；两种传输都失败时静默放弃。
  }

  try {
    void fetch(ERROR_REPORT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // 上报本身永不抛错，也不重试以避免故障风暴。
  }
}

export function reportError(
  level: ErrorLevel,
  scope: AiEntry | string,
  err: unknown,
  meta?: Record<string, string | number>,
): void {
  const msg = err instanceof Error ? err.message : String(err);
  const line = `[err:${level}] ${scope}: ${msg}`;
  try {
    if (level === "fatal") {
      console.error(line, meta ?? {});
    } else if (level === "recoverable") {
      console.warn(line, meta ?? {});
    } else {
      console.info(line, meta ?? {});
    }
  } catch {
    // 本机日志通道失败不影响远端上报。
  }

  const payload = buildErrorReportPayload(level, scope, err, meta);
  if (payload) sendErrorReport(payload);
}

/**
 * 路由级 ErrorBoundary 的统一上报入口（R7.6 的 `fatal` 场景）。
 *
 * Next.js 会把服务端异常的摘要哈希放进 `error.digest`，用于和服务端日志对账；
 * 有就带上，没有就不塞空 meta，保证控制台输出稳定可断言。
 */
export function reportRouteError(
  error: Error & { digest?: string },
  scope = "route-error",
): void {
  reportError("fatal", scope, error, error.digest ? { digest: error.digest } : undefined);
}
