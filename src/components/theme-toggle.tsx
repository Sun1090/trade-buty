"use client";

/** 主题切换按钮：可访问名称由字典传入，zh 用户不该听到英文 */
export function ThemeToggle({ label }: { label: string }) {
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
      aria-label={label}
      title={label}
      className="px-2.5 py-2 rounded-lg text-muted hover:text-foreground hover:bg-white/5 active:scale-90 transition text-sm"
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
