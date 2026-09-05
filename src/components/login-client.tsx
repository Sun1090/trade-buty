"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { normalizeReturnTo } from "@/lib/auth-return";
import {
  classifyOtpError,
  isOtpCoolingDown,
  otpCooldownRemaining,
} from "@/lib/otp-error";

type AuthDict = {
  emailPlaceholder: string;
  sendLink: string;
  sending: string;
  sent: string;
  sentHint: string;
  error: string;
  errorRateLimited: string;
  errorRateLimitedHint: string;
  errorInvalidEmail: string;
  errorNetwork: string;
  errorUnknown: string;
  cooldownTpl: string; // 占位符 "{sec}"
  cooldownButton: string; // 占位符 "{sec}"
  returnToNoticeTpl: string; // 占位符 "{path}"
  returnToBannerTitle: string;
};

type Status =
  | "idle"
  | "sending"
  | "sent"
  | "error"
  | "rate_limited"
  | "invalid_email"
  | "network";

export function LoginClient({
  dict,
  locale,
}: {
  dict: AuthDict;
  locale: string;
}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [cooldownSec, setCooldownSec] = useState<number>(0);
  const lastSentRef = useRef<number | null>(null);
  const searchParams = useSearchParams();
  // 服务端已在 searchParams 校验过；这里再走一次 normalizeReturnTo 防客户端直链
  const rawReturn = searchParams?.get("returnTo");
  const returnTo = normalizeReturnTo(rawReturn, locale);

  // 冷却倒计时（每秒一次）；归零后恢复按钮可点
  useEffect(() => {
    if (cooldownSec <= 0) return;
    const id = setInterval(() => {
      const remain = otpCooldownRemaining(lastSentRef.current);
      if (remain <= 0) {
        setCooldownSec(0);
        // 过了冷却清掉 error / rate_limited，回到 idle 让按钮可点
        setStatus((s) => (s === "rate_limited" ? "idle" : s));
      } else {
        setCooldownSec(remain);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [cooldownSec]);

  async function onSubmit(e: React.FormEvent) {
    // R9.2: 这条规则误报——onSubmit 是事件处理器（非渲染期），但 react-hooks/purity
    // 把 await 后的 setState 视为 render-time impurity。临时绕开。
    /* eslint-disable react-hooks/purity */
    e.preventDefault();
    if (!email || status === "sending") return;
    // 基础邮箱格式校验
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    // 客户端冷却：避免用户误连点触发服务端 429
    if (isOtpCoolingDown(lastSentRef.current)) {
      setStatus("rate_limited");
      setCooldownSec(otpCooldownRemaining(lastSentRef.current));
      return;
    }
    setStatus("sending");
    // callback 路径：${origin}/${locale}/auth/callback；returnTo 通过 query 透传，
    // callback 完成后再跳回（AuthCallbackClient 处理）。
    const callbackUrl = new URL(
      `/${locale}/auth/callback`,
      window.location.origin,
    );
    if (returnTo) callbackUrl.searchParams.set("returnTo", returnTo);
    try {
      const { error } = await getSupabaseBrowser().auth.signInWithOtp({
        email,
        options: { emailRedirectTo: callbackUrl.toString() },
      });
      if (error) {
        const kind = classifyOtpError(error);
        // 任何错误都标记 lastSent，避免误连点
        lastSentRef.current = Date.now();
        // unknown 折叠为通用 error 状态（前端只有四个 banner）
        setStatus(kind === "unknown" ? "error" : kind);
        if (kind === "rate_limited") {
          setCooldownSec(otpCooldownRemaining(lastSentRef.current));
        }
        return;
      }
      // 成功：标记 lastSent + 启动冷却倒计时（防止用户立刻再点）
      lastSentRef.current = Date.now();
      setStatus("sent");
      setCooldownSec(otpCooldownRemaining(lastSentRef.current));
    } catch (err) {
      // fetch 抛错：TypeError / AbortError 等
      lastSentRef.current = Date.now();
      const kind = classifyOtpError(err);
      setStatus(kind === "unknown" ? "error" : kind);
    }
    /* eslint-enable react-hooks/purity */
  }

  // 冷却期内的可点击/禁用提示：按钮文案+禁用+冷却剩余
  const inCooldown = cooldownSec > 0;
  const buttonDisabled = status === "sending" || inCooldown;
  const buttonLabel = inCooldown
    ? dict.cooldownButton.replace("{sec}", String(cooldownSec))
    : status === "sending"
      ? dict.sending
      : dict.sendLink;

  const noticeText = returnTo
    ? dict.returnToNoticeTpl.replace("{path}", returnTo)
    : "";

  return (
    <div className="space-y-4">
      {returnTo && (
        <div
          className="rounded-xl border border-accent/30 bg-accent-dim px-4 py-3 text-sm text-accent"
          role="status"
          aria-live="polite"
        >
          <p className="font-medium">{dict.returnToBannerTitle}</p>
          <p className="mt-1 text-muted font-mono text-xs break-all">
            {noticeText}
          </p>
        </div>
      )}
      <form onSubmit={onSubmit} className="space-y-4">
        <input
          type="email"
          required
          maxLength={254}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={dict.emailPlaceholder}
          aria-label={dict.emailPlaceholder}
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm outline-none focus:border-accent/50 focus:shadow-[0_0_0_3px_var(--accent-dim)] transition-all"
          disabled={status === "sending"}
        />
        <button
          type="submit"
          disabled={buttonDisabled}
          aria-disabled={buttonDisabled}
          className="w-full rounded-full bg-accent-strong hover:bg-accent text-white dark:text-[#06281c] font-semibold px-6 py-3 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {buttonLabel}
        </button>
        {status === "sent" && (
          <div className="rounded-xl bg-accent-dim border border-accent/30 px-4 py-3 text-sm text-accent space-y-1">
            <p className="font-medium">{dict.sent}</p>
            <p className="text-muted">{dict.sentHint}</p>
          </div>
        )}
        {status === "rate_limited" && (
          <div className="rounded-xl bg-warn/10 border border-warn/30 px-4 py-3 text-sm text-warn space-y-1">
            <p className="font-medium">{dict.errorRateLimited}</p>
            <p className="text-muted">{dict.errorRateLimitedHint}</p>
            {inCooldown && (
              <p className="text-muted">
                {dict.cooldownTpl.replace("{sec}", String(cooldownSec))}
              </p>
            )}
          </div>
        )}
        {status === "invalid_email" && (
          <p className="rounded-xl bg-down/10 border border-down/30 px-4 py-3 text-sm text-down">
            {dict.errorInvalidEmail}
          </p>
        )}
        {status === "network" && (
          <p className="rounded-xl bg-down/10 border border-down/30 px-4 py-3 text-sm text-down">
            {dict.errorNetwork}
          </p>
        )}
        {status === "error" && (
          <p className="rounded-xl bg-down/10 border border-down/30 px-4 py-3 text-sm text-down">
            {dict.errorUnknown}
          </p>
        )}
      </form>
    </div>
  );
}
