"use client";

import { useEffect, useState } from "react";

const KEY = "tb-font-scale";
const MIN = 0.9;
const MAX = 1.2;
const STEP = 0.05;

/** 正文字号调节：A- / A+ 按钮，记忆到 localStorage */
export function FontSizeControl({ labels }: { labels: { smaller: string; larger: string } }) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    try {
      const v = parseFloat(localStorage.getItem(KEY) ?? "1");
      if (!isNaN(v) && v >= MIN && v <= MAX) {
        setScale(v);
        applyScale(v);
      }
    } catch {
      // ignore
    }
  }, []);

  function applyScale(v: number) {
    document.documentElement.style.setProperty("--kb-scale", String(v));
  }

  function change(delta: number) {
    setScale((prev) => {
      const next = Math.min(MAX, Math.max(MIN, +(prev + delta).toFixed(2)));
      try {
        localStorage.setItem(KEY, String(next));
      } catch {
        // ignore
      }
      applyScale(next);
      return next;
    });
  }

  return (
    <div className="flex items-center gap-1 text-xs">
      <button
        onClick={() => change(-STEP)}
        disabled={scale <= MIN}
        aria-label={labels.smaller}
        className="h-7 w-7 rounded-lg border border-[var(--border)] text-faint hover:text-accent hover:border-accent/40 transition disabled:opacity-30"
      >
        A-
      </button>
      <button
        onClick={() => change(STEP)}
        disabled={scale >= MAX}
        aria-label={labels.larger}
        className="h-7 w-7 rounded-lg border border-[var(--border)] text-faint hover:text-accent hover:border-accent/40 transition disabled:opacity-30"
      >
        A+
      </button>
    </div>
  );
}
