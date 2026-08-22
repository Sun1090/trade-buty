import type { MetadataRoute } from "next";
import { getChapterNums, getDocMetas } from "@/lib/content";

const BASE = "https://trade-buty.vercel.app";
const LOCALES = ["zh", "en"];

export default function sitemap(): MetadataRoute.Sitemap {
  const paths: { path: string; priority: number; freq: "daily" | "weekly" | "monthly" }[] = [
    { path: "", priority: 1, freq: "weekly" },
    { path: "/path", priority: 0.9, freq: "monthly" },
    { path: "/chart", priority: 0.6, freq: "daily" },
    { path: "/search", priority: 0.4, freq: "monthly" },
    { path: "/knowledge/01", priority: 0.7, freq: "monthly" },
  ];
  for (const num of getChapterNums()) {
    paths.push({ path: `/knowledge/${num}`, priority: 0.7, freq: "monthly" });
    for (const doc of getDocMetas(num)) {
      paths.push({
        path: `/knowledge/${num}/${doc.slug}`,
        priority: 0.8,
        freq: "monthly",
      });
    }
  }
  return LOCALES.flatMap((locale) =>
    paths.map(({ path, priority, freq }) => ({
      url: `${BASE}/${locale}${path}`,
      changeFrequency: freq,
      priority,
    }))
  );
}
