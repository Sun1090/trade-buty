import type { MetadataRoute } from "next";
import { ROBOTS_DISALLOW } from "@/lib/seo-surface";
import { SITE_URL } from "@/lib/site";

/**
 * R13.17：robots.txt 只负责「不要抓取什么」，不负责「不要收录什么」。
 *
 * Disallow 里只保留两类：非页面资源（/api/、/offline.html）和带 OAuth 凭据的
 * 回调（auth 路由）。希望不收录的普通页面一律改用页面级 `noindex`——被 Disallow
 * 挡住的 URL，爬虫读不到 noindex，反而可能以「无描述」的形式出现在结果里。
 * 声明清单见 src/lib/seo-surface.json，产物由 check:seo-surface 复核。
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: [...ROBOTS_DISALLOW] },
    sitemap: `${SITE_URL.replace(/\/$/, "")}/sitemap.xml`,
  };
}
