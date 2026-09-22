"use client";

import { useEffect, useState } from "react";
import { getRandomTip, getSeedTip } from "@/lib/tips";

/** 交易心得卡：水合首帧取确定值，挂载后再换成随机一条 */
export function DailyTip({ locale }: { locale: string }) {
  const [tip, setTip] = useState(() => getSeedTip(locale));

  useEffect(() => {
    // 首帧必须与静态页的服务端 HTML 同值，随机只能延后到这里
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTip(getRandomTip(locale));
  }, [locale]);

  function refresh() {
    setTip(getRandomTip(locale));
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
