"use client";

import Link from "next/link";
import { trackAiClick } from "@/lib/analytics";

/**
 * R3.1：课末「问 AI」按钮——带课程上下文预填问题跳 /ai。
 * R3.11：点击埋点。
 */
export function LessonAskAi({
  href,
  label,
  chapter,
  enabled = true,
}: {
  href: string;
  label: string;
  chapter: string;
  /** R3.9：无 key 环境由服务端页传入 false */
  enabled?: boolean;
}) {
  if (!enabled) return null;
  return (
    <Link
      href={href}
      onClick={() => trackAiClick("lesson-ask-ai", { chapter })}
      className="mt-4 flex items-center justify-between gap-4 rounded-2xl border border-[var(--accent)]/30 border-l-4 border-l-[var(--accent)] bg-gradient-to-br from-[var(--accent-dim)] to-transparent p-6 hover:border-accent/60 transition group"
    >
      <span className="flex items-center gap-3 min-w-0">
        <span className="text-xl shrink-0" aria-hidden>🤖</span>
        <span className="text-sm font-medium text-accent truncate">{label}</span>
      </span>
      <span className="text-accent group-hover:translate-x-1 transition-transform shrink-0" aria-hidden>
        →
      </span>
    </Link>
  );
}
