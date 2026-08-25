"use client";

import { useState } from "react";
import { getDailyTip } from "@/lib/tips";

/** 每日交易提示卡片 */
export function DailyTip({ locale }: { locale: string }) {
  const [tip, setTip] = useState(() => getDailyTip(locale));

  function refresh() {
    setTip(getDailyTip(locale));
  }

  return (
    <div className="rounded-2xl border border-[var(--accent)]/30 bg-gradient-to-br from-[var(--accent-dim)] to-transparent p-5 flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <span className="text-xl shrink-0 mt-0.5" aria-hidden>💡</span>
        <p className="text-sm text-muted leading-relaxed">{tip}</p>
      </div>
      <button
        onClick={refresh}
        className="text-xs text-faint hover:text-accent transition shrink-0 whitespace-nowrap"
        aria-label="Next tip"
      >
        ↻
      </button>
    </div>
  );
}