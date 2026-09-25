/**
 * R9.2：OTP 发送错误分类与本地限流。
 *
 * 背景：supabase.auth.signInWithOtp 可能因四种原因失败：
 *  - over_email_send_rate_limit / 429：邮箱触发了服务端冷却
 *  - 网络/超时：fetch 抛错
 *  - 邮箱无效：客户端校验已拦，但服务端可能补一刀
 *  - 其它（Supabase 5xx、内部错误）
 *
 * 前端要：
 *  1. 识别这些原因，给出针对性文案（避免用户以为"链接没发"反复点）
 *  2. 在服务端冷却之外加一道客户端节流（防误操作）
 *  3. 纯函数可测
 */

/** 客户端 OTP 错误分类 */
export type OtpErrorKind =
  | "rate_limited"
  | "invalid_email"
  | "network"
  | "unknown";

/** Supabase AuthError 形状子集（仅用到的字段） */
export interface OtpLikeError {
  status?: number;
  code?: string;
  message?: string;
}

/** 把任意 thrown value 归类成 OtpErrorKind */
export function classifyOtpError(err: unknown): OtpErrorKind {
  // null / undefined / 非对象
  if (!err || typeof err !== "object") return "unknown";
  const e = err as OtpLikeError;
  // 1) 限流：429 或 over_email_send_rate_limit
  if (
    e.status === 429 ||
    e.code === "over_email_send_rate_limit" ||
    /rate.?limit/i.test(e.message ?? "")
  ) {
    return "rate_limited";
  }
  // 2) 邮箱无效：400 + invalid email / email_address_invalid
  if (
    e.status === 400 &&
    (/invalid.?email/i.test(e.message ?? "") ||
      e.code === "email_address_invalid" ||
      e.code === "validation_failed")
  ) {
    return "invalid_email";
  }
  // 3) 网络只认两种证据：
  //    - 浏览器自己拒绝 fetch（TypeError / AbortError / NetworkError）
  //    - supabase auth-js 包出来的 AuthRetryableFetchError 且 status 为 0——离线时它给 0；
  //      上游 5xx 时同一个类带的是那个状态码，那不是用户的连接，不能让他去检查网络。
  const name = (err as { name?: unknown }).name;
  if (
    typeof name === "string" &&
    (name === "TypeError" ||
      name === "AbortError" ||
      name === "NetworkError")
  ) {
    return "network";
  }
  if (name === "AuthRetryableFetchError" && e.status === 0) return "network";
  // 剩下的都没有网络证据（AuthUnknownError、库里裸 throw、`getSupabaseBrowser()`
  // 的 env 缺失守卫……）。旧写法在这里补了一句 `!status && !code → network`，
  // 等于替一件没测量的事宣布成因；现在交给不宣布成因的 unknown。
  return "unknown";
}

/**
 * 客户端节流：两次 OTP 发送的最小间隔（ms）。
 * 60s——足够覆盖误连点 + Supabase 默认冷却，避免因前端狂点触发服务端 429。
 */
export const OTP_COOLDOWN_MS = 60_000;

/**
 * 给定上一次 send 时刻与现在时刻，是否仍在冷却中。
 * 纯函数：调用方读持久化 lastSentAt 后传入。
 */
export function isOtpCoolingDown(
  lastSentAt: number | null | undefined,
  now: number = Date.now(),
  cooldownMs: number = OTP_COOLDOWN_MS,
): boolean {
  if (!lastSentAt || lastSentAt <= 0) return false;
  return now - lastSentAt < cooldownMs;
}

/** 剩余冷却秒数（向上取整，最小 1）。不在冷却时返回 0。 */
export function otpCooldownRemaining(
  lastSentAt: number | null | undefined,
  now: number = Date.now(),
  cooldownMs: number = OTP_COOLDOWN_MS,
): number {
  if (!isOtpCoolingDown(lastSentAt, now, cooldownMs)) return 0;
  return Math.max(1, Math.ceil((cooldownMs - (now - (lastSentAt ?? 0))) / 1000));
}
