"use client";

export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const next = root.dataset.theme === "light" ? "dark" : "light";
    root.dataset.theme = next;
    try {
      localStorage.setItem("tb-theme", next);
    } catch {
      // localStorage 不可用时静默降级
    }
  }

  return (
    <button
      onClick={toggle}
      aria-label="Toggle theme / 切换主题"
      title="Theme / 主题"
      className="px-2.5 py-2 rounded-lg text-muted hover:text-foreground hover:bg-white/5 transition text-sm"
    >
      <span
        className="hidden [html[data-theme=dark]_&]:inline"
        aria-hidden
      >
        🌙
      </span>
      <span
        className="hidden [html[data-theme=light]_&]:inline"
        aria-hidden
      >
        ☀️
      </span>
    </button>
  );
}
