/**
 * 章节元数据访问（kb-titles 静态映射，edge 构建安全）。
 * R2.1/R3.7 共用。
 */
import titlesData from "@/lib/kb-titles.json";

type TitlesMap = Record<string, Record<string, { title?: string }>>;
const TITLES = titlesData as TitlesMap;

/** 章节标题（去掉 "NN · " 前缀），未知章节返回 null */
export function getChapterTitle(locale: string, chapter: string): string | null {
  const entry = TITLES[locale]?.[chapter]?.title;
  if (!entry) return null;
  return entry.replace(/^\d+\s*·\s*/, "");
}
