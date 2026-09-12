-- 回滚 0008：移除目标档位约束。不会恢复被归一化的历史值。
alter table user_settings
  drop constraint if exists user_settings_daily_goal_min_check,
  drop constraint if exists user_settings_weekly_goal_min_check;
