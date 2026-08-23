"use client";

import { useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";

type AuthDict = {
  emailPlaceholder: string;
  sendLink: string;
  sending: string;
  sent: string;
  sentHint: string;
  error: string;
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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || status === "sending") return;
    // 基础邮箱格式校验
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    setStatus("sending");
    const { error } = await getSupabaseBrowser().auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/${locale}/auth/callback`,
      },
    });
    setStatus(error ? "error" : "sent");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={dict.emailPlaceholder}
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
  );
}
