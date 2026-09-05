-- ============================================================
-- R4.7：用户设置（每日目标分钟档）云端同步
-- 执行位置：Supabase 控制台 SQL Editor
-- ============================================================

create table if not exists user_settings (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  daily_goal_min int not null default 15,
  updated_at     timestamptz not null default now()
);

-- 仅本人可读写
alter table user_settings enable row level security;
create policy "users_own_settings" on user_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
