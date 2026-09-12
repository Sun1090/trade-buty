import type { MetadataRoute } from "next";
import { getChapterSlugs, getDocMetas } from "@/lib/content";
import { kbLastModified } from "@/lib/kb-freshness";
import { INDEXABLE_STATIC_SURFACES } from "@/lib/seo-surface";
import { SITE_URL } from "@/lib/site";

const BASE = SITE_URL.replace(/\/$/, "");
const LOCALES = ["zh", "en"] as const;

/**
 * R13.17：sitemap 只收录「允许被索引」的页面。
 *
 * - 静态入口来自 `src/lib/seo-surface.json`（与 robots.txt、页面 robots meta 同一份声明）
 * - 课程页由知识库驱动，逐章逐篇展开
 * - `lastmod` 用知识库提交时间（内容没动就不动），拿不到才退回构建时间
 * - `noindex` 页面（FAQ、术语表、隐私、统计等）一律不进 sitemap
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const kbUpdatedAt = kbLastModified() ?? new Date();

  const entries: MetadataRoute.Sitemap = [];

  for (const locale of LOCALES) {
    for (const surface of INDEXABLE_STATIC_SURFACES) {
      entries.push({
        url: `${BASE}/${locale}${surface.path}`,
        changeFrequency: surface.changeFrequency,
        priority: surface.priority,
      });
    }
  }

  for (const locale of LOCALES) {
    for (const chapter of getChapterSlugs(locale)) {
      entries.push({
        url: `${BASE}/${locale}/knowledge/${chapter}`,
        lastModified: kbUpdatedAt,
        changeFrequency: "weekly",
        priority: 0.7,
      });
      for (const doc of getDocMetas(locale, chapter)) {
        entries.push({
          url: `${BASE}/${locale}/knowledge/${chapter}/${doc.slug}`,
          lastModified: kbUpdatedAt,
          changeFrequency: "monthly",
          priority: 0.8,
        });
      }
    }
  }

  return entries;
}
