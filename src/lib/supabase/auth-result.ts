import { isAuthSessionMissingError } from "@supabase/supabase-js";

type AuthUser = { id: string; email?: string | null } | null;

/**
 * 把 `supabase.auth.getUser()` 的结果解释成「可信用户 / 游客 / 身份不可信」。
 *
 * 「没有会话 cookie」是游客的正常状态；其余错误（网络、上游 Auth API 异常等）
 * 一律抛出，调用方不能把 `user:null` 误当成游客，也不能据此做限流/授权决策。
 */
export function resolveAuthUser(result: {
  data: { user: AuthUser };
  error: unknown;
}): AuthUser {
  const { data, error } = result;
  if (error && !isAuthSessionMissingError(error)) throw error;
  return data.user;
}
