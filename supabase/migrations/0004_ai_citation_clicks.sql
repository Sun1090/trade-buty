-- ============================================================
-- R1.13 引用点击统计：回答内的来源/章节链接点击
-- 为 R8 增长（内容推荐、热门路径）提供素材
-- 执行位置：Supabase 控制台 SQL Editor
-- ============================================================

create table if not exists ai_citation_clicks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  kind        text not null check (kind in ('source', 'suggested')),
  chapter     text not null,
  doc         text,
  question    text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_ai_citation_clicks_chapter
  on ai_citation_clicks (chapter, created_at desc);
create index if not exists idx_ai_citation_clicks_kind
  on ai_citation_clicks (kind);

-- 允许匿名点击上报（user_id 为空），登录用户记录本人
alter table ai_citation_clicks enable row level security;
create policy "anon_or_self_insert_citation_clicks" on ai_citation_clicks
  for insert with check (user_id is null or auth.uid() = user_id);
-- 无 select/update policy → 只有 service_role 能读（运营导出用）
