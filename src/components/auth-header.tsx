"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { getSupabaseBrowser } from "@/lib/supabase/client";

export function AuthHeader({ locale, dict }: {
  locale: string;
  dict: { login: string; logout: string };
}) {
  const user = useAuth();

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

  return (
    <button
      onClick={() => {
        if (!window.confirm(`${email}\n\n${dict.logout}?`)) return;
        getSupabaseBrowser().auth.signOut();
      }}
      title={`${email} · ${dict.logout}`}
      aria-label={`${dict.logout} (${email})`}
      className="px-2 sm:px-3 py-2 rounded-lg text-muted hover:text-foreground hover:bg-white/5 transition whitespace-nowrap text-sm flex items-center gap-1.5"
    >
      <span
        className="flex items-center justify-center h-6 w-6 rounded-full bg-accent/20 text-accent text-xs font-bold"
      >
        {initial}
      </span>
      <span className="hidden min-[480px]:inline">{dict.logout}</span>
    </button>
  );
}
