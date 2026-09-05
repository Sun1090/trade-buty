"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getDict, isLocale, DEFAULT_LOCALE } from "@/lib/i18n";
import { daysSinceLastVisit } from "@/lib/last-visit";

/**
 * R9.8：7 天未访温和提示 toast。
 *
 * 设计：
 * - 监听 `tb-return-nudge` CustomEvent（由 auth-provider 在 mount 时检测 + 派发）
 * - sessionStorage 去重（同会话只弹一次；切 tab 重进会再弹——属于温和提示，可接受）
 * - 8 秒自动消失 / 点 "继续学习" 跳转 /replay / "稍后再说" 关闭
 * - 文案中性、不诱导（不卖焦虑、不强推 push 通知、不发邮件）
 */
export function ReturnNudgeToast() {
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState<number | null>(null);

  useEffect(() => {
    function onNudge() {
      // sessionStorage 去重
      try {
        if (sessionStorage.getItem("tb-return-nudge-shown") === "1") return;
        sessionStorage.setItem("tb-return-nudge-shown", "1");
      } catch {
        // ignore
      }
      const d = daysSinceLastVisit(Date.now());
      setDays(d != null && d > 0 ? d : 7);
      setOpen(true);
      window.setTimeout(() => setOpen(false), 12000);
    }
    window.addEventListener("tb-return-nudge", onNudge);
    return () => window.removeEventListener("tb-return-nudge", onNudge);
  }, []);

  if (!open) return null;

  // 客户端从路径里读 locale（与 sync-summary-toast 一致）
  const path = typeof window !== "undefined" ? window.location.pathname : "/";
  const seg = path.split("/").filter(Boolean)[0];
  const locale = isLocale(seg) ? seg : DEFAULT_LOCALE;
  const t = getDict(locale).auth;
  const safeDays = days != null && days > 0 ? days : 7;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="return-nudge-toast"
      className="fixed bottom-6 right-6 z-[80] max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--background)]/95 p-4 shadow-xl backdrop-blur-md"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-[var(--foreground)]">
          {t.returnNudgeTitleTpl.replace("{days}", String(safeDays))}
        </p>
        <button
          type="button"
          aria-label="dismiss"
          onClick={() => setOpen(false)}
          className="text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          ×
        </button>
      </div>
      <p className="mb-3 text-xs leading-relaxed text-[var(--muted)]">
        {t.returnNudgeBodyTpl}
      </p>
      <div className="flex gap-2">
        <Link
          href="/replay"
          onClick={() => setOpen(false)}
          className="flex-1 rounded-lg bg-[var(--accent-dim)] px-3 py-1.5 text-center text-xs font-medium text-[var(--accent)] hover:bg-[var(--accent-dim)]/70"
        >
          {t.returnNudgeDismiss}
        </Link>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex-1 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--muted)] hover:bg-[var(--surface)]"
        >
          {t.returnNudgeLater}
        </button>
      </div>
    </div>
  );
}
