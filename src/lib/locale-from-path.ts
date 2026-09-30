import { DEFAULT_LOCALE, isLocale, type Locale } from "./i18n";

/**
 * 根级 not-found / error 边界拿不到 locale（路由层 404 落在 `[locale]` 段之外，
 * R16.41），但 URL 前缀里带着它。这个纯函数从 pathname 第一段读出语言：
 * 认得的 locale 原样返回，其余（locale-less URL、以 `/` 开头的内部路径、空值）
 * 一律回落 DEFAULT_LOCALE——与既有 e2e 钉住的「locale-less → 默认语言」同口径。
 */
export function localeFromPathname(pathname: string | null | undefined): Locale {
  if (!pathname) return DEFAULT_LOCALE;
  const segment = pathname.split("/")[1];
  return isLocale(segment) ? segment : DEFAULT_LOCALE;
}
