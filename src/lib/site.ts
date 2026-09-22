/** 站点根 URL——用于 sitemap、robots、metadataBase、OG 等。
 * 从环境变量读取（Vercel 自动注入 NEXT_PUBLIC_SITE_URL），fallback 到生产域名。 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://trade-buty.vercel.app";

/** 源码仓库地址：结构化数据、发布复盘链接、更新日志外链共用这一个字面量。 */
export const REPOSITORY_URL = "https://github.com/Sun1090/trade-buty";
