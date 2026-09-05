"use client";

import { useEffect, useState } from "react";
import { getRefFromUrl, recordInvite, readInvite, clearInvite } from "@/lib/invite-ref";

interface Labels {
  titleTpl: string;
  bodyTpl: string;
  dismiss: string;
}

/**
 * R8.5 邀请 banner：URL 上有 ?ref=xxx 时显示一次，写入 localStorage。
 * - 仅 client 渲染（避免 SSR 触碰 localStorage）
 * - 用户手动关闭后不再展示（localStorage dismissed=true 标记）
 * - 多 tab 通过 storage 事件同步（如果其他标签页清掉邀请，banner 也消失）
 */
export function InviteBanner({ labels, locale }: { labels: Labels; locale: "zh" | "en" }) {
  const [visible, setVisible] = useState(false);
  const [ref, setRef] = useState<string | null>(null);
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const urlRef = getRefFromUrl(window.location.search);
    let active = readInvite();
    if (urlRef) {
      recordInvite(urlRef);
      active = readInvite();
    }
    if (!active) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(false);
      return;
    }
    const key = `tb-invite-dismissed-${active.ref}`;
    if (typeof localStorage !== "undefined" && localStorage.getItem(key) === "1") {
      setVisible(false);
      setDismissedKey(key);
      return;
    }
    setRef(active.ref);
    setDismissedKey(key);
    setVisible(true);

    // 监听 storage 让多 tab 同步——另一个 tab 清掉邀请时这里也消失
    const onStorage = (e: StorageEvent) => {
      if (e.key === "tb-invite-ref") {
        const next = readInvite();
        if (!next) {
          setVisible(false);
          setRef(null);
        } else {
          setRef(next.ref);
        }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  function handleDismiss() {
    if (typeof localStorage === "undefined") return;
    if (dismissedKey) localStorage.setItem(dismissedKey, "1");
    setVisible(false);
  }

  function handleClear() {
    clearInvite();
    setVisible(false);
    setRef(null);
  }

  if (!visible || !ref) return null;

  const title = labels.titleTpl.replace("{ref}", ref);
  const body = labels.bodyTpl.replace("{ref}", ref);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="invite-banner"
      data-locale={locale}
      className="mx-auto max-w-3xl mt-2 mb-2 flex items-start gap-3 rounded-xl border border-[var(--accent)]/30 bg-[var(--accent-dim)] px-4 py-3 text-sm"
    >
      <span aria-hidden className="text-lg leading-none mt-0.5">🎉</span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold">{title}</p>
        <p className="text-muted mt-0.5 text-xs leading-relaxed">{body}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={handleClear}
          data-testid="invite-banner-clear"
          className="text-xs text-faint hover:text-muted underline-offset-2 hover:underline"
        >
          {locale === "en" ? "Clear" : "清除"}
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          data-testid="invite-banner-dismiss"
          aria-label={labels.dismiss}
          className="rounded-full border border-[var(--accent)]/40 bg-[var(--surface)] hover:border-accent/60 text-accent px-3 py-1 text-xs transition"
        >
          {labels.dismiss}
        </button>
      </div>
    </div>
  );
}
