-- ============================================================
-- 向量维度 1536 → 1024（改用 BAAI/bge-m3，1024 维）
-- 在 Supabase SQL Editor 执行
-- ============================================================

-- 先删索引和匹配函数（依赖向量维度）
drop index if exists idx_kb_embeddings_vector;
drop function if exists match_kb_embeddings(vector(1024), text, integer, real);

-- 改列维度
alter table kb_embeddings
  alter column embedding type vector(1024) using embedding::vector(1024);

-- 重建索引
create index if not exists idx_kb_embeddings_vector
  on kb_embeddings using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- 重建匹配函数（pgvector 余弦距离）
create or replace function match_kb_embeddings(
  query_embedding vector(1024),
  match_locale text default 'zh',
  match_count int default 4,
  threshold real default 0.3
)
returns table (
  id uuid,
  chapter text,
  doc text,
  chunk text,
  locale text,
  similarity real
)
language sql stable as $$
  select
    e.id,
    e.chapter,
    e.doc,
    e.chunk,
    e.locale,
    1 - (e.embedding <=> query_embedding) as similarity
  from kb_embeddings e
  where e.locale = match_locale
    and 1 - (e.embedding <=> query_embedding) > threshold
  order by e.embedding <=> query_embedding
  limit match_count;
$$;

-- 验证
select 'kb_embeddings 列维度' as check,
       atttypmod as vector_dim
from pg_attribute
where attrelid = 'kb_embeddings'::regclass
  and attname = 'embedding';
