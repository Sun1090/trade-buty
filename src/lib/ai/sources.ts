import { getChapters, getDocMetas } from "@/lib/content";
import type { RagResult } from "./rag";

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
    let title = `${r.chapter}/${r.doc}`;
    try {
      const found = getDocMetas(locale, r.chapter).find((d) => d.slug === r.doc);
      if (found?.title) title = found.title;
    } catch {
      // 知识库缺失时回退 slug，保证引用不断链
    }
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
    let title = r.chapter;
    try {
      const found = getChapters(locale).find((c) => c.slug === r.chapter);
      if (found?.title) title = found.title;
    } catch {
      // 知识库缺失时回退 slug
    }
    out.push({ chapter: r.chapter, title });
    if (out.length >= maxChapters) break;
  }
  return out;
}
