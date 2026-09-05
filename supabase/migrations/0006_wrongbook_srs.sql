-- ============================================================
-- R5.7：错题本 SRS 字段（间隔重复复习）
-- 执行位置：Supabase 控制台 SQL Editor
-- ============================================================

alter table wrongbook add column if not exists srs_stage int;
alter table wrongbook add column if not exists srs_due date;
create index if not exists idx_wrongbook_srs_due on wrongbook (user_id, srs_due);
