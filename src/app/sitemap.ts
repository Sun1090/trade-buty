import type { MetadataRoute } from "next";
import { getChapterSlugs, getDocMetas } from "@/lib/content";
import { SITE_URL } from "@/lib/site";

const BASE = SITE_URL;
const LOCALES = ["zh", "en"];

export default function sitemap(): MetadataRoute.Sitemap {
  // 构建时间作为 lastModified——每次部署 sitemap 会更新，
  // 搜索引擎据此判断内容新鲜度
  const lastModified = new Date();
  const staticPaths: { path: string; priority: number }[] = [
    { path: "", priority: 1 },
    { path: "/path", priority: 0.9 },
    { path: "/chart", priority: 0.6 },
    { path: "/replay", priority: 0.6 },
    { path: "/review", priority: 0.4 },
    { path: "/search", priority: 0.4 },
  ];
  const docPaths: { path: string; priority: number }[] = [];
  for (const locale of LOCALES) {
    for (const chapter of getChapterSlugs(locale)) {
      docPaths.push({ path: `/${locale}/knowledge/${chapter}`, priority: 0.7 });
      for (const doc of getDocMetas(locale, chapter)) {
        docPaths.push({
          path: `/${locale}/knowledge/${chapter}/${doc.slug}`,
          priority: 0.8,
        });
      }
    }
  }
  return [...staticPaths, ...docPaths].map(({ path, priority }) => ({
    url: `${BASE}${path}`,
    lastModified,
    changeFrequency: "weekly" as const,
    priority,
  }));
}
