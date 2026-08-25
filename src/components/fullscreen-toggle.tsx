"use client";

import { useEffect, useState } from "react";

/** 全屏切换按钮：点击将容器元素全屏 */
export function FullscreenToggle({ targetId, label }: { targetId: string; label: { enter: string; exit: string } }) {
  const [full, setFull] = useState(false);

  useEffect(() => {
    function onChange() {
      setFull(!!document.fullscreenElement);
    }
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  function toggle() {
    const el = document.getElementById(targetId);
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  return (
    <button
      onClick={toggle}
      className="text-xs text-faint hover:text-accent transition px-2 py-1 rounded-lg border border-[var(--border)] hover:border-accent/40"
      aria-label={full ? label.exit : label.enter}
    >
      {full ? "⛶ " + label.exit : "⛶ " + label.enter}
    </button>
  );
}