"use client";

import { useEffect, useState } from "react";

/** 焦点模式：隐藏导航栏 + 侧栏，仅留正文 */
export function FocusMode({ label, activeLabel }: { label: string; activeLabel: string }) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const header = document.querySelector("header");
    if (!header) return;
    if (active) {
      header.style.display = "none";
    } else {
      header.style.removeProperty("display");
    }
    return () => {
      header.style.removeProperty("display");
    };
  }, [active]);

  return (
    <button
      onClick={() => setActive((v) => !v)}
      className={`text-xs transition px-2 py-1 rounded-lg border ${
        active
          ? "border-accent/40 bg-[var(--accent-dim)] text-accent"
          : "border-[var(--border)] text-faint hover:text-accent hover:border-accent/40"
      }`}
      aria-pressed={active}
    >
      {active ? activeLabel : label}
    </button>
  );
}