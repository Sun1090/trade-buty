"use client";

import { useEffect, useState } from "react";

const KEY = "tb-font-scale";
const LH_KEY = "tb-line-height";
const MIN = 0.9;
const MAX = 1.2;
const STEP = 0.05;

/** 正文字号 + 行距调节，记忆到 localStorage */
export function FontSizeControl({ labels }: { labels: { smaller: string; larger: string } }) {
  const [scale, setScale] = useState(1);
  const [lh, setLh] = useState(1.85);

  useEffect(() => {
    try {
      const v = parseFloat(localStorage.getItem(KEY) ?? "1");
      if (!isNaN(v) && v >= MIN && v <= MAX) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setScale(v);
        applyScale(v);
      }
      const lhv = parseFloat(localStorage.getItem(LH_KEY) ?? "1.85");
      if (!isNaN(lhv)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLh(lhv);
        applyLh(lhv);
      }
    } catch {
      // ignore
    }
  }, []);

  function applyScale(v: number) {
    document.documentElement.style.setProperty("--kb-scale", String(v));
  }
  function applyLh(v: number) {
    document.documentElement.style.setProperty("--kb-line-height", String(v));
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

  function changeLh(delta: number) {
    setLh((prev) => {
      const next = Math.min(2.2, Math.max(1.5, +(prev + delta).toFixed(2)));
      try {
        localStorage.setItem(LH_KEY, String(next));
      } catch {
        // ignore
      }
      applyLh(next);
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
      <button
        onClick={() => changeLh(0.1)}
        disabled={lh >= 2.2}
        aria-label="Line height +"
        className="h-7 px-2 rounded-lg border border-[var(--border)] text-faint hover:text-accent hover:border-accent/40 transition disabled:opacity-30 font-mono"
        title="行距+"
      >
        ☰+
      </button>
      <button
        onClick={() => changeLh(-0.1)}
        disabled={lh <= 1.5}
        aria-label="Line height -"
        className="h-7 px-2 rounded-lg border border-[var(--border)] text-faint hover:text-accent hover:border-accent/40 transition disabled:opacity-30 font-mono"
        title="行距-"
      >
        ☰-
      </button>
    </div>
  );
}
