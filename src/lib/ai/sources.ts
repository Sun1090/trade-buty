import { getDocMetas } from "@/lib/content";
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
