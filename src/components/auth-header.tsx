"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { withReturnTo } from "@/lib/auth-return";
import { clearLocalAccountData, requestAccountDeletion } from "@/lib/account-delete";

export function AuthHeader({ locale, dict }: {
  locale: string;
  dict: { login: string; logout: string };
}) {
  const user = useAuth();
  const [open, setOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!user) {
    // 当前页面已经是登录/回调页 → 直链避免无限循环
    const isAuthPage =
      pathname === `/${locale}/auth` ||
      pathname === `/${locale}/auth/callback`;
    const loginHref = isAuthPage
      ? `/${locale}/auth`
      : withReturnTo(`/${locale}/auth`, pathname || `/${locale}`);
    return (
      <Link
        href={loginHref}
        aria-label={dict.login}
        className="px-2 sm:px-3 py-2 rounded-lg text-muted hover:text-foreground hover:bg-white/5 transition whitespace-nowrap text-sm"
      >
        <span aria-hidden>👤</span>{" "}
        <span className="hidden min-[420px]:inline">{dict.login}</span>
      </Link>
    );
  }

  const email = user.email ?? "";
  const initial = email.charAt(0).toUpperCase() || "U";
  const accountLabel = locale === "zh" ? "账户" : "Account";
  const logoutLabel = locale === "zh" ? "退出登录" : "Sign out";

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen((value) => !value)}
        title={email}
        aria-label={`${accountLabel}: ${email}`}
        aria-haspopup="menu"
        aria-expanded={open}
        className="px-2 sm:px-3 py-2 rounded-lg text-muted hover:text-foreground hover:bg-white/5 transition whitespace-nowrap text-sm flex items-center gap-1.5"
      >
        <span className="flex items-center justify-center h-6 w-6 rounded-full bg-accent/20 text-accent text-xs font-bold">
          {initial}
        </span>
        <span className="hidden min-[480px]:inline max-w-32 truncate">{email}</span>
        <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
          <path d="m5.5 7.5 4.5 4 4.5-4" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          aria-label={accountLabel}
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-64 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2 shadow-2xl shadow-black/20"
        >
          <div className="border-b border-[var(--border)] px-3 py-2.5">
            <p className="text-[11px] uppercase tracking-wider text-faint">{accountLabel}</p>
            <p className="mt-1 truncate text-sm font-medium" title={email}>{email}</p>
          </div>
          {deleteConfirm ? (
            <div className="mt-2 rounded-xl border border-down/30 bg-down/5 p-3" role="group" aria-label={locale === "zh" ? "确认注销" : "Confirm account deletion"}>
              <p className="text-xs leading-relaxed text-muted">
                {locale === "zh"
                  ? "这会删除云端账号并清除本机 Trade Buty 数据，且无法撤销。"
                  : "This deletes your cloud account and local Trade Buty data. This cannot be undone."}
              </p>
              {deleteError && (
                <p role="alert" className="mt-2 text-xs text-red-500">
                  {locale === "zh" ? "注销失败，请稍后重试。" : "Deletion failed. Please try again."}
                </p>
              )}
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => {
                    setDeleting(true);
                    setDeleteError(false);
                    void requestAccountDeletion()
                      .then(() => {
                        clearLocalAccountData();
                        router.push(`/${locale}/auth`);
                      })
                      .catch(() => {
                        setDeleteError(true);
                        setDeleting(false);
                      });
                  }}
                  className="flex-1 rounded-lg bg-down px-2 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                >
                  {deleting ? (locale === "zh" ? "处理中…" : "Deleting…") : (locale === "zh" ? "确认注销" : "Delete account")}
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => setDeleteConfirm(false)}
                  className="flex-1 rounded-lg border border-[var(--border)] px-2 py-1.5 text-xs text-muted disabled:opacity-50"
                >
                  {locale === "zh" ? "取消" : "Cancel"}
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                role="menuitem"
                onClick={() => {
                  setDeleteError(false);
                  setDeleteConfirm(true);
                }}
                className="mt-1 flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm text-down hover:bg-down/10 transition"
              >
                <span aria-hidden className="mr-2">⌫</span>
                {locale === "zh" ? "注销账号" : "Delete account"}
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  void getSupabaseBrowser().auth.signOut();
                }}
                className="flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm text-down hover:bg-down/10 transition"
              >
                <span aria-hidden className="mr-2">↪</span>
                {logoutLabel}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
