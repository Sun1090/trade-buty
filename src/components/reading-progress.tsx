"use client";

import { useEffect, useState } from "react";

/** 顶部阅读进度条 + 回到顶部按钮 */
export function ReadingProgress({ label }: { label: string }) {
  const [pct, setPct] = useState(0);
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    function onScroll() {
      const total = document.documentElement.scrollHeight - window.innerHeight;
      setPct(total > 0 ? Math.min((window.scrollY / total) * 100, 100) : 0);
      setShowTop(window.scrollY > 800);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <div
        aria-hidden
        className="fixed top-0 left-0 h-0.5 z-[60] bg-accent transition-[width] duration-150"
        style={{ width: `${pct}%` }}
      />
      {showTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label={label}
          title={label}
          className="fixed bottom-6 right-6 z-50 h-10 w-10 rounded-full border border-border-strong bg-surface text-muted hover:text-accent hover:border-accent/60 shadow-lg transition"
        >
          ↑
        </button>
      )}
    </>
  );
}
