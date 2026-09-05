/**
 * R9.1：登录后跳回原页（returnTo）——纯函数工具。
 *
 * 设计要点：
 * - 纯函数：不读 window/document；调用方传 window.location.pathname 等外部状态
 * - 白名单：只接受 /${locale} 开头的站内相对路径；其他全部 return null，
 *   防止 open redirect（外部 URL、协议相对 URL //evil.com、javascript: 等）
 * - 去除控制字符：原始值先 trim，禁止 \r \n \t，避免 header 注入
 * - 跨 locale：仅当前 locale 接受；不接受 /${otherLocale}/...（保持语言一致）
 * - 保留 search/hash：原 returnTo 自带的 query/锚点透传，便于 deep link
 */

/** 允许的站内路径前缀（locale 段必须严格匹配） */
function isLocalePrefixed(path: string, locale: string): boolean {
  const prefix = `/${locale}`;
  if (path === prefix) return true;
  // 后续必须是 /、? 或 #，避免 /${locale}xxx 误命中
  return (
    path.startsWith(`${prefix}/`) ||
    path.startsWith(`${prefix}?`) ||
    path.startsWith(`${prefix}#`)
  );
}

/**
 * 收窄任意原始 returnTo 输入到合法站内相对路径，否则 null。
 *
 * @param raw 用户提供的字符串（URL 参数、表单 hidden、按钮 data-* 等）
 * @param locale 当前 locale（仅允许该 locale 前缀）
 * @param opts.allowedPrefixes 额外允许的前缀集合（如 /zh/auth 用于引导到登录页自身）；
 *   默认包含首页本身（/${locale}）
 * @returns 规范化后的路径（含 query/hash），或 null 表示拒绝
 */
export function normalizeReturnTo(
  raw: string | null | undefined,
  locale: string,
  opts: { allowedPrefixes?: string[] } = {},
): string | null {
  if (typeof raw !== "string") return null;
  // 去除首尾空白 + 控制字符（防 header 注入 / CRLF）
  const trimmed = raw.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  if (!trimmed) return null;

  // 必须以单个 / 开头，禁止协议相对（//evil.com）或 scheme（javascript:、http://、https:// 等）
  if (!trimmed.startsWith("/")) return null;
  if (trimmed.startsWith("//")) return null;
  if (trimmed.startsWith("/\\")) return null;

  // 解析 query/hash 边界
  const hashIdx = trimmed.indexOf("#");
  const queryIdx = trimmed.indexOf("?");
  // 取最早的边界
  const boundaryIdx = [
    hashIdx >= 0 ? hashIdx : Infinity,
    queryIdx >= 0 ? queryIdx : Infinity,
  ].reduce((min, v) => (v < min ? v : min), Infinity);
  const pathOnly =
    boundaryIdx === Infinity ? trimmed : trimmed.slice(0, boundaryIdx);

  // 排除纯根（避免与"无 returnTo"等价；调用方用 null 判断更清晰）
  if (pathOnly === "/") return null;

  const allowed = new Set<string>([
    `/${locale}`,
    ...(opts.allowedPrefixes ?? []),
  ]);

  if (allowed.has(pathOnly)) return trimmed;
  if (isLocalePrefixed(pathOnly, locale)) return trimmed;
  return null;
}

/**
 * 把页面当前路径转成可放进 ?returnTo= 的形式：
 * 已经是站内相对路径 → 原样返回；空/外部 → 返回 null。
 */
export function buildReturnTo(
  pathname: string | null | undefined,
  locale: string,
): string | null {
  return normalizeReturnTo(pathname, locale);
}

/**
 * 拼接 ?returnTo= 段（已规范化后）。传入 null 直接返回 path。
 */
export function withReturnTo(
  basePath: string,
  returnTo: string | null,
): string {
  if (!returnTo) return basePath;
  const enc = encodeURIComponent(returnTo);
  return `${basePath}?returnTo=${enc}`;
}
