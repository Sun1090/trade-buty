"use client";

import { useEffect, useState } from "react";
import { getTheme, setTheme, type ThemeMode } from "@/lib/theme";

const MODES: { key: ThemeMode; label: string; icon: string }[] = [
  { key: "dark", label: "Dark", icon: "🌙" },
  { key: "light", label: "Light", icon: "☀️" },
  { key: "sepia", label: "Sepia", icon: "📜" },
];

/** 三模式主题选择器 */
export function ThemeSelector({ labels }: { labels: { dark: string; light: string; sepia: string } }) {
  const [mode, setMode] = useState<ThemeMode>("dark");

  useEffect(() => {
    setMode(getTheme());
    const onChange = () => setMode(getTheme());
    window.addEventListener("tb-theme", onChange);
    return () => window.removeEventListener("tb-theme", onChange);
  }, []);

  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-[var(--border)] p-0.5">
      {MODES.map((m) => (
        <button
          key={m.key}
          onClick={() => setTheme(m.key)}
          className={`px-2 py-1 rounded text-[11px] font-medium transition ${
            mode === m.key
              ? "bg-[var(--accent-dim)] text-accent"
              : "text-faint hover:text-foreground"
          }`}
          aria-label={m.key === "dark" ? labels.dark : m.key === "light" ? labels.light : labels.sepia}
        >
          <span aria-hidden>{m.icon}</span>{" "}
          <span className="hidden sm:inline">{m.key === "dark" ? labels.dark : m.key === "light" ? labels.light : labels.sepia}</span>
        </button>
      ))}
    </div>
  );
}