-- ============================================================
-- 双设备同步语义 + 数据完整性约束（pgTAP）
-- 覆盖 Q2.8：多设备写入幂等 / 冲突合并依赖的唯一键 / 触发器与档位约束
-- 运行方式：npm run db:test（详见 docs/database-testing.md）
-- 前置条件：supabase/migrations/0001~0008 已按顺序应用
-- 说明：客户端 sync-layer 依赖这些唯一约束做 upsert onConflict，
--       约束一旦被改坏，双设备同步会静默产生重复行。此文件把它们钉死。
-- ============================================================

begin;

select plan(26);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, confirmed_at, created_at, updated_at)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sync-a@example.test', 'x', now(), now(), now()),
  ('bbbbbbbb-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sync-b@example.test', 'x', now(), now(), now());

-- ------------------------------------------------------------
-- 1. progress：设备 A / 设备 B 先后写入同一 (chapter, doc)
--    客户端用 upsert(onConflict = user_id,chapter_num,doc_slug, ignoreDuplicates)
--    语义 = on conflict do nothing → 不重复、不报错
-- ------------------------------------------------------------
select lives_ok(
  $$ insert into progress (user_id, chapter_num, doc_slug)
     values ('aaaaaaaa-0000-0000-0000-000000000001','ch','doc')
     on conflict (user_id, chapter_num, doc_slug) do nothing $$,
  '设备 A 写入 progress 成功');
select lives_ok(
  $$ insert into progress (user_id, chapter_num, doc_slug)
     values ('aaaaaaaa-0000-0000-0000-000000000001','ch','doc')
     on conflict (user_id, chapter_num, doc_slug) do nothing $$,
  '设备 B 重复写入同一 progress 不报错');
select is(
  (select count(*) from progress where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  1::bigint, 'progress 重复写入后仍只有 1 行（幂等）');

-- 唯一约束是 per-user：两个用户可以拥有相同的 (chapter, doc)
select lives_ok(
  $$ insert into progress (user_id, chapter_num, doc_slug)
     values ('bbbbbbbb-0000-0000-0000-000000000002','ch','doc') $$,
  '另一个用户可以拥有相同的 (chapter, doc)');
select is((select count(*) from progress where user_id in ('aaaaaaaa-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000002')), 2::bigint, 'progress 唯一约束是 per-user 而非全局');

-- ------------------------------------------------------------
-- 2. wrongbook：同键重复 insert 必须冲突（客户端 upsert 依赖它）
-- ------------------------------------------------------------
insert into wrongbook (user_id, chapter_num, question_idx, picked, srs_stage, srs_due)
values ('aaaaaaaa-0000-0000-0000-000000000001','ch',1,0,0,current_date);

select throws_ok(
  $$ insert into wrongbook (user_id, chapter_num, question_idx, picked)
     values ('aaaaaaaa-0000-0000-0000-000000000001','ch',1,3) $$,
  23505, NULL, 'wrongbook (user, chapter, question) 唯一约束生效');

-- 设备 B 后答同一题：upsert onConflict 覆盖 picked 与 SRS 计划
select lives_ok(
  $$ insert into wrongbook (user_id, chapter_num, question_idx, picked, srs_stage, srs_due)
     values ('aaaaaaaa-0000-0000-0000-000000000001','ch',1,4,2,current_date + 7)
     on conflict (user_id, chapter_num, question_idx)
     do update set picked = excluded.picked,
                   srs_stage = excluded.srs_stage,
                   srs_due = excluded.srs_due,
                   answered_at = now() $$,
  '设备 B upsert 同一错题成功');
select is(
  (select picked from wrongbook where user_id = 'aaaaaaaa-0000-0000-0000-000000000001' and chapter_num = 'ch' and question_idx = 1),
  4, 'upsert 后 picked 采用设备 B 的新值');
select is(
  (select srs_stage from wrongbook where user_id = 'aaaaaaaa-0000-0000-0000-000000000001' and chapter_num = 'ch' and question_idx = 1),
  2, 'upsert 后 srs_stage 采用设备 B 的新值');
select is(
  (select srs_due from wrongbook where user_id = 'aaaaaaaa-0000-0000-0000-000000000001' and chapter_num = 'ch' and question_idx = 1),
  (current_date + 7)::date, 'upsert 后 srs_due 采用设备 B 的新值');
select is(
  (select count(*) from wrongbook where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  1::bigint, 'upsert 不产生重复错题行');

-- answered_at 客户端可显式覆盖：跨设备“取较新”合并依赖它
select lives_ok(
  $$ insert into wrongbook (user_id, chapter_num, question_idx, picked, answered_at)
     values ('aaaaaaaa-0000-0000-0000-000000000001','ch',1,1, now() - interval '1 day')
     on conflict (user_id, chapter_num, question_idx)
     do update set picked = excluded.picked, answered_at = excluded.answered_at $$,
  '显式携带 answered_at 的 upsert 可刷新时间戳');
select ok(
  (select answered_at from wrongbook where user_id = 'aaaaaaaa-0000-0000-0000-000000000001' and chapter_num = 'ch' and question_idx = 1)
    < now(),
  'answered_at 采用显式传入的历史时间');

-- ------------------------------------------------------------
-- 3. quiz_scores：per-user 唯一 + touch_updated_at 触发器
-- ------------------------------------------------------------
-- 故意插入 1 小时前的 updated_at，验证 update 后触发器把它刷到当前
insert into quiz_scores (user_id, chapter_num, best, total, updated_at)
values ('aaaaaaaa-0000-0000-0000-000000000001','ch',3,5, now() - interval '1 hour');

select throws_ok(
  $$ insert into quiz_scores (user_id, chapter_num, best, total)
     values ('aaaaaaaa-0000-0000-0000-000000000001','ch',4,5) $$,
  23505, NULL, 'quiz_scores (user, chapter) 唯一约束生效');

select lives_ok(
  $$ insert into quiz_scores (user_id, chapter_num, best, total)
     values ('aaaaaaaa-0000-0000-0000-000000000001','other',5,5) $$,
  'quiz_scores 每个章节一行，可新增别的章节');

update quiz_scores set best = 5
where user_id = 'aaaaaaaa-0000-0000-0000-000000000001' and chapter_num = 'ch';

select ok(
  (select updated_at from quiz_scores where user_id = 'aaaaaaaa-0000-0000-0000-000000000001' and chapter_num = 'ch')
    > now() - interval '1 minute',
  'touch_updated_at 触发器在 quiz_scores update 后刷新 updated_at');

-- ------------------------------------------------------------
-- 4. replay_best：per-user 唯一 + upsert 取新值
-- ------------------------------------------------------------
insert into replay_best (user_id, best_streak) values ('aaaaaaaa-0000-0000-0000-000000000001', 4);
select throws_ok(
  $$ insert into replay_best (user_id, best_streak) values ('aaaaaaaa-0000-0000-0000-000000000001', 9) $$,
  23505, NULL, 'replay_best 每用户一行');
select lives_ok(
  $$ insert into replay_best (user_id, best_streak) values ('aaaaaaaa-0000-0000-0000-000000000001', 9)
     on conflict (user_id) do update set best_streak = excluded.best_streak $$,
  'replay_best upsert onConflict 成功');
select is(
  (select best_streak from replay_best where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  9, 'replay_best upsert 后取新值');

-- ------------------------------------------------------------
-- 5. user_settings 目标档位约束（0008）
-- ------------------------------------------------------------
insert into user_settings (user_id, daily_goal_min, weekly_goal_min)
values ('aaaaaaaa-0000-0000-0000-000000000001', 15, 90);

select lives_ok(
  $$ update user_settings set daily_goal_min = 30
     where user_id = 'aaaaaaaa-0000-0000-0000-000000000001' $$,
  '每日目标合法档位 30 通过');
select lives_ok(
  $$ update user_settings set weekly_goal_min = 150
     where user_id = 'aaaaaaaa-0000-0000-0000-000000000001' $$,
  '每周目标合法档位 150 通过');
select throws_ok(
  $$ update user_settings set daily_goal_min = 7
     where user_id = 'aaaaaaaa-0000-0000-0000-000000000001' $$,
  23514, NULL, '每日目标非法档位 7 被拒绝');
select throws_ok(
  $$ update user_settings set weekly_goal_min = 100
     where user_id = 'aaaaaaaa-0000-0000-0000-000000000001' $$,
  23514, NULL, '每周目标非法档位 100 被拒绝');
select is(
  (select daily_goal_min from user_settings where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  30, '非法更新被拒绝后原值保持不变');

-- ------------------------------------------------------------
-- 6. 外键级联：删除 auth 用户会清掉其数据（账号注销依赖）
-- ------------------------------------------------------------
select is(
  (select count(*) from progress where user_id = 'bbbbbbbb-0000-0000-0000-000000000002'),
  1::bigint, '删除前 B 有 1 行 progress');
delete from auth.users where id = 'bbbbbbbb-0000-0000-0000-000000000002';
select is(
  (select count(*) from progress where user_id = 'bbbbbbbb-0000-0000-0000-000000000002'),
  0::bigint, '删除 auth 用户后其 progress 级联删除');

select * from finish();
rollback;
