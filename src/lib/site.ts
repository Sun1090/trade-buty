/** 站点根 URL——用于 sitemap、robots、metadataBase、OG 等。
 * 从环境变量读取（Vercel 自动注入 NEXT_PUBLIC_SITE_URL），fallback 到生产域名。 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://trade-buty.vercel.app";
