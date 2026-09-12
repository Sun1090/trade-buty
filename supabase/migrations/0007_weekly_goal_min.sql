-- ============================================================
-- R12.19：用户设置新增每周学习目标分钟档（45/90/150，默认 90）
-- 执行位置：Supabase 控制台 SQL Editor
-- ============================================================

alter table user_settings
  add column if not exists weekly_goal_min int not null default 90;
