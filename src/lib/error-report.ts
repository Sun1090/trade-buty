/**
 * R7.6：前端错误上报分级。
 * - fatal：阻断用户流程的崩溃（目前路由级 ErrorBoundary 场景）→ console.error
 * - recoverable：单次操作失败、有 UI 反馈（如 AI 请求失败）→ console.warn
 * - silent：可完全忽略的后台失败（埋点上报失败等）→ console.info（debug 通道）
 *
 * 预留：接入统一上报端点时只改本文件。
 */
import type { AiEntry } from "./analytics";

export type ErrorLevel = "fatal" | "recoverable" | "silent";

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
    // 上报本身永不抛错
  }
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
