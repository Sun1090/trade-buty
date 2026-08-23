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
 */
export async function retrieve(
  query: string,
  locale: string = "zh",
  topK: number = 4,
): Promise<RagResult[]> {
  const queryEmbedding = await embed(query);
  if (queryEmbedding.length === 0) return [];

  const admin = createSupabaseAdminClient();

  // pgvector 余弦距离：< 0.3 的过滤掉（不够相关）
  // match_count 限制返回条数
  const { data, error } = await admin.rpc("match_kb_embeddings", {
    query_embedding: queryEmbedding,
    match_locale: locale,
    match_count: topK,
    threshold: 0.3,
  });

  if (error) {
    console.error("[rag] 检索失败:", error.message);
    return [];
  }

  return (data ?? []).map((row: { chapter: string; doc: string; chunk: string; similarity: number }) => ({
    chapter: row.chapter,
    doc: row.doc,
    chunk: row.chunk,
    similarity: row.similarity,
  }));
}
