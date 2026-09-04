import titlesData from "../kb-titles.json";
import type { RagResult } from "./rag";

type TitlesMap = Record<string, Record<string, { title?: string; docs?: Record<string, string> }>>;
const titles = titlesData as TitlesMap;

export interface SourceLink {
  chapter: string;
  doc: string;
  title: string;
}

/** RAG 检索结果富化为可展示的引用链接（标题优先，缺失回退 slug） */
export function enrichSourcesWithTitles(
  results: RagResult[],
  locale: string
): SourceLink[] {
  return results.map((r) => {
    // 静态标题映射（edge 安全）；缺失回退 slug，保证引用不断链
    const title =
      titles[locale]?.[r.chapter]?.docs?.[r.doc] ?? `${r.chapter}/${r.doc}`;
    return { chapter: r.chapter, doc: r.doc, title };
  });
}

export interface ChapterSuggestion {
  chapter: string;
  title: string;
}

/** 放宽检索结果按章节去重，取前 3 个作推荐（兜底场景用） */
export function suggestChaptersFromResults(
  results: RagResult[],
  locale: string,
  maxChapters = 3
): ChapterSuggestion[] {
  const seen = new Set<string>();
  const out: ChapterSuggestion[] = [];
  for (const r of results) {
    if (seen.has(r.chapter)) continue;
    seen.add(r.chapter);
    const title = titles[locale]?.[r.chapter]?.title ?? r.chapter;
    out.push({ chapter: r.chapter, title });
    if (out.length >= maxChapters) break;
  }
  return out;
}
