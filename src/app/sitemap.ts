import type { MetadataRoute } from "next";
import { getChapterNums, getDocMetas } from "@/lib/content";

const BASE = "https://trade-buty.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/path`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE}/search`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/chart`, changeFrequency: "daily", priority: 0.6 },
  ];
  const docs: MetadataRoute.Sitemap = [];
  for (const num of getChapterNums()) {
    docs.push({
      url: `${BASE}/knowledge/${num}`,
      changeFrequency: "monthly",
      priority: 0.7,
    });
    for (const doc of getDocMetas(num)) {
      docs.push({
        url: `${BASE}/knowledge/${num}/${doc.slug}`,
        changeFrequency: "monthly",
        priority: 0.8,
      });
    }
  }
  return [...staticPages, ...docs];
}
