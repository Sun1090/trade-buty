-- ============================================================
-- 数据完整性：用户目标档位与客户端常量保持一致
-- 每日允许 5/15/30，每周允许 45/90/150（R4.1 / R12.19）
-- 执行位置：Supabase 控制台 SQL Editor 或 supabase db push
-- ============================================================

-- 先归一化历史非法值，避免新增约束时因存量脏数据失败。
update user_settings
set daily_goal_min = 15
where daily_goal_min not in (5, 15, 30);

update user_settings
set weekly_goal_min = 90
where weekly_goal_min not in (45, 90, 150);

alter table user_settings
  drop constraint if exists user_settings_daily_goal_min_check,
  add constraint user_settings_daily_goal_min_check
    check (daily_goal_min in (5, 15, 30));

alter table user_settings
  drop constraint if exists user_settings_weekly_goal_min_check,
  add constraint user_settings_weekly_goal_min_check
    check (weekly_goal_min in (45, 90, 150));
