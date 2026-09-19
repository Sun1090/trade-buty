-- Roll back atomic embedding generations while preserving the currently active rows.

create or replace function match_kb_embeddings(
  query_embedding vector(1024),
  match_locale text default 'zh',
  match_count int default 4,
  threshold float default 0.3
)
returns table (
  id uuid,
  chapter text,
  doc text,
  chunk text,
  similarity float
)
language sql stable as $$
  select
    e.id,
    e.chapter,
    e.doc,
    e.chunk,
    1 - (e.embedding <=> query_embedding) as similarity
  from kb_embeddings e
  where e.locale = match_locale
    and 1 - (e.embedding <=> query_embedding) > threshold
  order by e.embedding <=> query_embedding
  limit match_count;
$$;

drop function if exists activate_kb_embedding_generation(text, uuid);
drop table if exists kb_embedding_generations;
drop index if exists idx_kb_embeddings_locale_generation;
alter table kb_embeddings drop column if exists generation;
