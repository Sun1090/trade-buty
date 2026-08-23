-- ============================================================
-- Trade Buty P3 AI 陪学 · pgvector + 对话历史 + 反馈
-- 执行位置：Supabase 控制台 SQL Editor
-- 需先在 Extensions 启用 vector 扩展（如未启用）
-- ============================================================

-- pgvector 扩展
create extension if not exists vector;

-- ============================================================
-- kb_embeddings: 知识库向量化存储
-- 每个 chunk = 一段 H2/内容块，含 chapter/doc 元信息
-- ============================================================
create table if not exists kb_embeddings (
  id          uuid primary key default gen_random_uuid(),
  chunk       text not null,
  chapter     text not null,
  doc         text not null,
  locale      text not null default 'zh',
  embedding   vector(1024) not null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_kb_embeddings_vector
  on kb_embeddings using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create index if not exists idx_kb_embeddings_locale_chapter
  on kb_embeddings (locale, chapter);

-- RAG 检索函数：余弦相似度 + locale 过滤 + 阈值
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

-- embedding 公开可读（检索需要），但只有 service_role 可写
alter table kb_embeddings enable row level security;
create policy "public_read_embeddings" on kb_embeddings
  for select using (true);
-- 无 write policy → 只有 service_role（绕 RLS）能写

-- ============================================================
-- ai_conversations: 登录用户的对话历史
-- ============================================================
create table if not exists ai_conversations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null check (role in ('user', 'assistant')),
  content     text not null,
  sources     jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists idx_ai_conversations_user_time
  on ai_conversations (user_id, created_at desc);

-- 对话仅本人可读写
alter table ai_conversations enable row level security;
create policy "users_own_conversations" on ai_conversations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- ai_feedback: AI 回答有用/无用反馈
-- ============================================================
create table if not exists ai_feedback (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,
  conversation_id uuid references ai_conversations(id) on delete set null,
  rating      text not null check (rating in ('helpful', 'unhelpful')),
  question    text,
  answer      text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_ai_feedback_rating
  on ai_feedback (rating);

-- 反馈仅本人可读，本人可写
alter table ai_feedback enable row level security;
create policy "users_own_feedback" on ai_feedback
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id or user_id is null);
