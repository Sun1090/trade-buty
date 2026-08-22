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
    <div className="flex items-center gap-2">
      <span
        className="hidden sm:flex items-center justify-center h-7 w-7 rounded-full bg-accent/20 text-accent text-xs font-bold"
        title={email}
      >
        {initial}
      </span>
      <button
        onClick={() => getSupabaseBrowser().auth.signOut()}
        className="px-2 sm:px-3 py-2 rounded-lg text-muted hover:text-foreground hover:bg-white/5 transition whitespace-nowrap text-sm"
      >
        <span aria-hidden>↩</span>{" "}
        <span className="hidden min-[480px]:inline">{dict.logout}</span>
      </button>
    </div>
  );
}
