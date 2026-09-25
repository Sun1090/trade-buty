"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getDict, isLocale, DEFAULT_LOCALE } from "@/lib/i18n";
import { markNudgeShown } from "@/lib/last-visit";
import {
  RETURN_NUDGE_DAYS_KEY,
  RETURN_NUDGE_PENDING_KEY,
  RETURN_NUDGE_SHOWN_KEY,
} from "@/lib/return-nudge-keys";

/**
 * R9.8：7 天未访温和提示 toast。
 *
 * 设计：
 * - 监听 `tb-return-nudge` CustomEvent（由 auth-provider 在 mount 时检测 + 派发）
 * - sessionStorage 去重（同会话只弹一次；切 tab 重进会再弹——属于温和提示，可接受）
 * - 停留 {@link RETURN_NUDGE_TOAST_MS}（12 秒）后自动消失 / 点 "继续学习" 跳转
 *   `/${locale}/replay`（R16.188：这一站全部住在 `/{locale}` 下，不带前缀的地址会落进
 *   `[locale]="replay"` 直接 404）/ "稍后再说" 关闭
 * - 文案中性、不诱导（不卖焦虑、不强推 push 通知、不发邮件）
 */
export const RETURN_NUDGE_TOAST_MS = 12_000;

export function ReturnNudgeToast() {
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState<number | null>(null);

  useEffect(() => {
    function openNudge(measuredDays: number | null) {
      // sessionStorage 去重；pending 让 lazy 组件挂载晚于事件时仍能消费提示.
      try {
        if (sessionStorage.getItem(RETURN_NUDGE_SHOWN_KEY) === "1") return;
        sessionStorage.setItem(RETURN_NUDGE_SHOWN_KEY, "1");
        sessionStorage.removeItem(RETURN_NUDGE_PENDING_KEY);
        sessionStorage.removeItem(RETURN_NUDGE_DAYS_KEY);
      } catch {
        // ignore
      }
      // R16.189：没有测量值就不弹。这里以前退回常量 7，屏幕上「已 7 天没来」说的是一个
      // 从没量过的间隔——派发方已经先一步把本次访问时间写进台账，事后任何「重新量一遍」
      // 都只会量出 0，所以那个 7 既不是下限也不是估计，只是一个恰好等于门槛的数。
      if (measuredDays == null || !(measuredDays > 0)) return;
      markNudgeShown(Date.now());
      setDays(measuredDays);
      setOpen(true);
      window.setTimeout(() => setOpen(false), RETURN_NUDGE_TOAST_MS);
    }
    function onNudge(event?: Event) {
      const detail = (event as CustomEvent<{ days?: number }> | undefined)?.detail;
      openNudge(typeof detail?.days === "number" ? detail.days : null);
    }
    window.addEventListener("tb-return-nudge", onNudge);
    // Dynamic import may resolve after auth-provider dispatched the event.
    try {
      if (sessionStorage.getItem(RETURN_NUDGE_PENDING_KEY) === "1") {
        const stored = Number(sessionStorage.getItem(RETURN_NUDGE_DAYS_KEY));
        openNudge(Number.isFinite(stored) && stored > 0 ? stored : null);
      }
    } catch {
      // ignore
    }
    return () => window.removeEventListener("tb-return-nudge", onNudge);
  }, []);

  if (!open || days == null) return null;

  // 客户端从路径里读 locale（与 sync-summary-toast 一致）
  const path = typeof window !== "undefined" ? window.location.pathname : "/";
  const seg = path.split("/").filter(Boolean)[0];
  const locale = isLocale(seg) ? seg : DEFAULT_LOCALE;
  const t = getDict(locale).auth;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="return-nudge-toast"
      className="fixed bottom-6 right-6 z-[80] max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--background)]/95 p-4 shadow-xl backdrop-blur-md"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-[var(--foreground)]">
          {t.returnNudgeTitleTpl.replace("{days}", String(days))}
        </p>
        <button
          type="button"
          aria-label={t.closeLabel}
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
          href={`/${locale}/replay`}
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
