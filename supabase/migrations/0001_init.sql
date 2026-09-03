-- ============================================================
-- Trade Buty P2 数据层 · 建表 + RLS
-- 执行位置：Supabase 控制台 SQL Editor，或 supabase db push
-- 所有表 FK 到 auth.users(id) 并级联删除
-- ============================================================

-- ============================================================
-- progress: 学习进度，一行 = {user, chapter, doc} 已读
-- 对应 localStorage tb-progress (ProgressMap = Record<chapter, doc[]>)
-- ============================================================
create table if not exists progress (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  chapter_num   text not null,
  doc_slug      text not null,
  completed_at  timestamptz not null default now(),
  constraint uq_user_chapter_doc unique (user_id, chapter_num, doc_slug)
);
create index if not exists idx_progress_user on progress (user_id);

-- ============================================================
-- wrongbook: 错题本，一行 = {user, chapter, questionIdx, picked}
-- 对应 localStorage tb-wrong (Record<`${ch}:${idx}`, WrongEntry>)
-- ============================================================
create table if not exists wrongbook (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  chapter_num   text not null,
  question_idx  integer not null,
  picked        integer not null,
  answered_at   timestamptz not null default now(),
  constraint uq_user_wrong unique (user_id, chapter_num, question_idx)
);
create index if not exists idx_wrongbook_user on wrongbook (user_id);
create index if not exists idx_wrongbook_chapter on wrongbook (user_id, chapter_num);

-- ============================================================
-- quiz_scores: 测验成绩，一行 = {user, chapter, best, total, done}
-- 对应 localStorage tb-quiz-${ch} ({ best: number; done: boolean })
-- ============================================================
create table if not exists quiz_scores (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  chapter_num   text not null,
  best          integer not null,
  total         integer not null,
  done          boolean not null default true,
  updated_at    timestamptz not null default now(),
  constraint uq_user_quiz unique (user_id, chapter_num)
);
create index if not exists idx_quiz_scores_user on quiz_scores (user_id);

-- ============================================================
-- replay_history: 回放训练记录，每轮一行，客户端裁剪最近 100 条
-- 对应 localStorage tb-replay-history (ReplayRecord[], capped 100)
-- ============================================================
create table if not exists replay_history (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  symbol        text not null,
  interval      text not null,
  total         integer not null,
  correct       integer not null,
  best_streak   integer not null,
  recorded_at   timestamptz not null default now()
);
create index if not exists idx_replay_user_time on replay_history (user_id, recorded_at desc);

-- ============================================================
-- replay_best: 回放最佳连击，每用户一行
-- 对应 localStorage tb-replay-best (string integer)
-- ============================================================
create table if not exists replay_best (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  best_streak   integer not null default 0,
  updated_at    timestamptz not null default now()
);

-- ============================================================
-- RLS：用户只能读写自己的行
-- ============================================================
alter table progress        enable row level security;
alter table wrongbook      enable row level security;
alter table quiz_scores    enable row level security;
alter table replay_history enable row level security;
alter table replay_best    enable row level security;

create policy "users_own_progress" on progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users_own_wrongbook" on wrongbook
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users_own_quiz_scores" on quiz_scores
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users_own_replay_history" on replay_history
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users_own_replay_best" on replay_best
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- updated_at 自动刷新触发器（quiz_scores / replay_best）
create or replace function touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_quiz_scores_touch on quiz_scores;
create trigger trg_quiz_scores_touch before update on quiz_scores
  for each row execute function touch_updated_at();

drop trigger if exists trg_replay_best_touch on replay_best;
create trigger trg_replay_best_touch before update on replay_best
  for each row execute function touch_updated_at();
