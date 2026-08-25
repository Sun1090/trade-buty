/**
 * 主题模式：暗色/亮色/护眼
 * 建立在现有 dark/light 切换上，增加 sepia 模式
 * localStorage 存储，与 ThemeToggle 共享 tb-theme key
 */
const KEY = "tb-theme";

export type ThemeMode = "dark" | "light" | "sepia";

export function getTheme(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "sepia") return v;
  } catch {}
  return "dark";
}

export function setTheme(mode: ThemeMode) {
  try {
    localStorage.setItem(KEY, mode);
    document.documentElement.dataset.theme = mode;
    window.dispatchEvent(new Event("tb-theme"));
  } catch {}
}