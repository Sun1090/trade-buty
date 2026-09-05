"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { normalizeReturnTo } from "@/lib/auth-return";

type AuthDict = {
  emailPlaceholder: string;
  sendLink: string;
  sending: string;
  sent: string;
  sentHint: string;
  error: string;
  returnToNoticeTpl: string; // 占位符 "{path}"
  returnToBannerTitle: string;
};

export function LoginClient({
  dict,
  locale,
}: {
  dict: AuthDict;
  locale: string;
}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const searchParams = useSearchParams();
  // 服务端已在 searchParams 校验过；这里再走一次 normalizeReturnTo 防客户端直链
  const rawReturn = searchParams?.get("returnTo");
  const returnTo = normalizeReturnTo(rawReturn, locale);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || status === "sending") return;
    // 基础邮箱格式校验
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    setStatus("sending");
    // callback 路径：${origin}/${locale}/auth/callback；returnTo 通过 query 透传，
    // callback 完成后再跳回（AuthCallbackClient 处理）。
    const callbackUrl = new URL(
      `/${locale}/auth/callback`,
      window.location.origin,
    );
    if (returnTo) callbackUrl.searchParams.set("returnTo", returnTo);
    const { error } = await getSupabaseBrowser().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callbackUrl.toString() },
    });
    setStatus(error ? "error" : "sent");
  }

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
          disabled={status === "sending"}
          className="w-full rounded-full bg-accent-strong hover:bg-accent text-white dark:text-[#06281c] font-semibold px-6 py-3 transition disabled:opacity-50"
        >
          {status === "sending" ? dict.sending : dict.sendLink}
        </button>
        {status === "sent" && (
          <div className="rounded-xl bg-accent-dim border border-accent/30 px-4 py-3 text-sm text-accent space-y-1">
            <p className="font-medium">{dict.sent}</p>
            <p className="text-muted">{dict.sentHint}</p>
          </div>
        )}
        {status === "error" && (
          <p className="rounded-xl bg-down/10 border border-down/30 px-4 py-3 text-sm text-down">
            {dict.error}
          </p>
        )}
      </form>
    </div>
  );
}
