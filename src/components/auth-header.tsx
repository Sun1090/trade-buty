"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { getSupabaseBrowser } from "@/lib/supabase/client";

export function AuthHeader({ locale, dict }: {
  locale: string;
  dict: { login: string; logout: string };
}) {
  const user = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
    return (
      <Link
        href={`/${locale}/auth`}
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
          <button
            role="menuitem"
            onClick={() => {
              setOpen(false);
              void getSupabaseBrowser().auth.signOut();
            }}
            className="mt-1 flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm text-down hover:bg-down/10 transition"
          >
            <span aria-hidden className="mr-2">↪</span>
            {logoutLabel}
          </button>
        </div>
      )}
    </div>
  );
}
