-- v0.2 初始表结构：profiles / progress / quiz_results / wrong_answers / replay_history
-- 在 Supabase Dashboard → SQL Editor 粘贴执行，或 supabase db push

-- ============ profiles ============
create table if not exists profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

-- ============ progress（学习进度，复合主键天然幂等） ============
create table if not exists progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  chapter_slug text not null,
  doc_slug text not null,
  completed_at timestamptz not null default now(),
  primary key (user_id, chapter_slug, doc_slug)
);
create index if not exists progress_user_idx on progress (user_id);

-- ============ quiz_results（测验成绩，追加写） ============
create table if not exists quiz_results (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  chapter_slug text not null,
  score int not null check (score >= 0),
  total int not null check (total > 0),
  duration_sec int check (duration_sec is null or duration_sec >= 0),
  taken_at timestamptz not null default now()
);
create index if not exists quiz_results_user_idx on quiz_results (user_id, chapter_slug, taken_at desc);

-- ============ wrong_answers（错题本） ============
create table if not exists wrong_answers (
  user_id uuid not null references auth.users (id) on delete cascade,
  chapter_slug text not null,
  question_idx int not null check (question_idx >= 0),
  picked int not null check (picked >= 0),
  answered_at timestamptz not null default now(),
  resolved boolean not null default false,
  primary key (user_id, chapter_slug, question_idx)
);
create index if not exists wrong_answers_user_idx on wrong_answers (user_id, resolved);

-- ============ replay_history（回放成绩） ============
create table if not exists replay_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  params jsonb not null default '{}'::jsonb,
  score int not null check (score >= 0),
  total int not null check (total > 0),
  best_streak int not null default 0 check (best_streak >= 0),
  created_at timestamptz not null default now()
);
create index if not exists replay_history_user_idx on replay_history (user_id, created_at desc);

-- ============ RLS：全部表仅 owner 可读写 ============
alter table profiles enable row level security;
alter table progress enable row level security;
alter table quiz_results enable row level security;
alter table wrong_answers enable row level security;
alter table replay_history enable row level security;

drop policy if exists "owner all" on profiles;
create policy "owner all" on profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "owner all" on progress;
create policy "owner all" on progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "owner all" on quiz_results;
create policy "owner all" on quiz_results
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "owner all" on wrong_answers;
create policy "owner all" on wrong_answers
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "owner all" on replay_history;
create policy "owner all" on replay_history
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
