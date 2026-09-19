-- Atomic knowledge-embedding refreshes: stage a complete generation, then switch
-- the active pointer in one transaction. Failed staging never affects retrieval.

alter table kb_embeddings
  add column if not exists generation uuid;

with locale_generations as (
  select locale, gen_random_uuid() as generation
  from kb_embeddings
  where generation is null
  group by locale
)
update kb_embeddings e
set generation = g.generation
from locale_generations g
where e.locale = g.locale
  and e.generation is null;

alter table kb_embeddings
  alter column generation set default gen_random_uuid(),
  alter column generation set not null;

create index if not exists idx_kb_embeddings_locale_generation
  on kb_embeddings (locale, generation);

create table if not exists kb_embedding_generations (
  locale text primary key,
  active_generation uuid not null,
  activated_at timestamptz not null default now()
);

insert into kb_embedding_generations (locale, active_generation)
select distinct on (locale) locale, generation
from kb_embeddings
order by locale, created_at desc
on conflict (locale) do nothing;

alter table kb_embedding_generations enable row level security;
drop policy if exists "public_read_embedding_generations" on kb_embedding_generations;
create policy "public_read_embedding_generations" on kb_embedding_generations
  for select using (true);

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
  join kb_embedding_generations g
    on g.locale = e.locale
   and g.active_generation = e.generation
  where e.locale = match_locale
    and 1 - (e.embedding <=> query_embedding) > threshold
  order by e.embedding <=> query_embedding
  limit match_count;
$$;

create or replace function activate_kb_embedding_generation(
  target_locale text,
  target_generation uuid
)
returns integer
language plpgsql
security invoker
as $$
declare
  staged_count integer;
begin
  select count(*) into staged_count
  from kb_embeddings
  where locale = target_locale and generation = target_generation;

  if staged_count = 0 then
    raise exception 'embedding generation % for locale % is empty', target_generation, target_locale;
  end if;

  insert into kb_embedding_generations (locale, active_generation, activated_at)
  values (target_locale, target_generation, now())
  on conflict (locale) do update
    set active_generation = excluded.active_generation,
        activated_at = excluded.activated_at;

  delete from kb_embeddings
  where locale = target_locale and generation <> target_generation;

  return staged_count;
end;
$$;

revoke execute on function activate_kb_embedding_generation(text, uuid) from public, anon, authenticated;
grant execute on function activate_kb_embedding_generation(text, uuid) to service_role;
