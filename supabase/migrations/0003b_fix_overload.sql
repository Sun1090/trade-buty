-- 删掉所有 match_kb_embeddings 重载（不管什么签名）
-- 在 Supabase SQL Editor 执行
drop function if exists match_kb_embeddings(vector(1024), text, integer, real);
drop function if exists match_kb_embeddings(vector(1536), text, integer, real);
drop function if exists match_kb_embeddings(vector(1024));
drop function if exists match_kb_embeddings(vector(1536));
drop function if exists match_kb_embeddings;

-- 重建（唯一签名：1024 维）
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

-- 验证：只应有一个 match_kb_embeddings
select proname, pg_get_function_arguments(oid) as args
from pg_proc
where proname = 'match_kb_embeddings';
