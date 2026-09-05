/**
 * P3 AI 陪学：RAG 检索
 *
 * 用户问题 → embed → pgvector 余弦近似搜索 → 返回 top-k 知识库 chunk。
 */
import { embed } from "./client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export interface RagResult {
  chapter: string;
  doc: string;
  chunk: string;
  similarity: number;
}

/**
 * 检索与查询最相关的知识库 chunk。
 * @param query 用户问题
 * @param locale zh/en
 * @param topK 返回条数（默认 4，控制 context 窗口）
 * @param chapterFilter 可选章节 slug 过滤（R2.1 章节出题用）：超采 4 倍后按章过滤，避免改 DB 函数
 */
export async function retrieve(
  query: string,
  locale: string = "zh",
  topK: number = 4,
  threshold: number = 0.3,
  chapterFilter?: string,
): Promise<RagResult[]> {
  const queryEmbedding = await embed(query);
  if (queryEmbedding.length === 0) return [];

  const admin = createSupabaseAdminClient();

  // pgvector 余弦距离：< 0.3 的过滤掉（不够相关）
  // match_count 限制返回条数（有章节过滤时超采，过滤后可能不足 topK）
  const { data, error } = await admin.rpc("match_kb_embeddings", {
    query_embedding: queryEmbedding,
    match_locale: locale,
    match_count: chapterFilter ? topK * 4 : topK,
    threshold,
  });

  if (error) {
    console.error("[rag] 检索失败:", error.message);
    return [];
  }

  const mapped = (data ?? []).map(
    (row: { chapter: string; doc: string; chunk: string; similarity: number }): RagResult => ({
      chapter: row.chapter,
      doc: row.doc,
      chunk: row.chunk,
      similarity: row.similarity,
    }),
  );
  return chapterFilter
    ? mapped.filter((r: RagResult) => r.chapter === chapterFilter).slice(0, topK)
    : mapped;
}
