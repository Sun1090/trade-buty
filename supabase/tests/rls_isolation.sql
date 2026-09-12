-- ============================================================
-- RLS 跨用户隔离与越权写入拒绝（pgTAP）
-- 覆盖 Q2.8：用户数据隔离 / 越权写入 / 匿名越权 / 公开只读表
-- 运行方式：npm run db:test（详见 docs/database-testing.md）
-- 前置条件：supabase/migrations/0001~0008 已按顺序应用
-- 说明：全程在单个事务内执行，结束时 rollback，不写入真实数据；
--       测试用 auth.users 行同样随事务回滚。
-- ============================================================

begin;

select plan(38);

-- 固定测试用户（事务回滚，不污染真实 auth.users）
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, confirmed_at, created_at, updated_at)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-a@example.test', 'x', now(), now(), now()),
  ('bbbbbbbb-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-b@example.test', 'x', now(), now(), now());

-- authenticated 对 kb_embeddings 只读：预置一行（由 postgres 角色写入）验证可读
insert into kb_embeddings (chunk, chapter, doc, locale, embedding)
values ('rls fixture', 'rls-fixture', 'doc', 'zh', ('[' || repeat('0.1,', 1023) || '0.1]')::vector);

-- ------------------------------------------------------------
-- 用户 A：以自己的身份写入各表自有行
-- ------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

select is(auth.uid(), 'aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'A：auth.uid() 由 request.jwt.claim.sub 解析');

insert into progress (user_id, chapter_num, doc_slug) values (auth.uid(), 'ch', 'doc');
insert into wrongbook (user_id, chapter_num, question_idx, picked, srs_stage, srs_due) values (auth.uid(), 'ch', 1, 0, 1, current_date);
insert into quiz_scores (user_id, chapter_num, best, total) values (auth.uid(), 'ch', 3, 5);
insert into replay_history (user_id, symbol, interval, total, correct, best_streak) values (auth.uid(), 'BTCUSDT', '1h', 10, 7, 4);
insert into replay_best (user_id, best_streak) values (auth.uid(), 4);
insert into ai_conversations (user_id, role, content) values (auth.uid(), 'user', 'hi');
insert into ai_feedback (user_id, rating) values (auth.uid(), 'helpful');
insert into user_settings (user_id, daily_goal_min, weekly_goal_min) values (auth.uid(), 15, 90);
insert into ai_citation_clicks (user_id, kind, chapter) values (auth.uid(), 'source', 'ch');

select is((select count(*) from progress), 1::bigint, 'A 能读到自己的 progress');
select is((select count(*) from wrongbook), 1::bigint, 'A 能读到自己的 wrongbook');
select is((select count(*) from quiz_scores), 1::bigint, 'A 能读到自己的 quiz_scores');
select is((select count(*) from replay_best), 1::bigint, 'A 能读到自己的 replay_best');
select is((select count(*) from user_settings), 1::bigint, 'A 能读到自己的 user_settings');
select is((select count(*) from kb_embeddings where chapter = 'rls-fixture'), 1::bigint, 'A 能读到公开的 kb_embeddings fixture');

reset role;

-- ------------------------------------------------------------
-- 用户 B：看不到 A 的行（跨用户读隔离）
-- ------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000002';

select is((select count(*) from progress), 0::bigint, 'B 看不到 A 的 progress');
select is((select count(*) from wrongbook), 0::bigint, 'B 看不到 A 的 wrongbook');
select is((select count(*) from quiz_scores), 0::bigint, 'B 看不到 A 的 quiz_scores');
select is((select count(*) from replay_history), 0::bigint, 'B 看不到 A 的 replay_history');
select is((select count(*) from replay_best), 0::bigint, 'B 看不到 A 的 replay_best');
select is((select count(*) from ai_conversations), 0::bigint, 'B 看不到 A 的 ai_conversations');
select is((select count(*) from ai_feedback), 0::bigint, 'B 看不到 A 的 ai_feedback');
select is((select count(*) from user_settings), 0::bigint, 'B 看不到 A 的 user_settings');

-- 跨用户写入：冒用 A 的 user_id 一律被 WITH CHECK 拒绝
select throws_ok(
  $$ insert into progress (user_id, chapter_num, doc_slug) values ('aaaaaaaa-0000-0000-0000-000000000001','ch','spoof') $$,
  42501, NULL, 'B 不能冒充 A 写 progress');
select throws_ok(
  $$ insert into wrongbook (user_id, chapter_num, question_idx, picked) values ('aaaaaaaa-0000-0000-0000-000000000001','ch',2,0) $$,
  42501, NULL, 'B 不能冒充 A 写 wrongbook');
select throws_ok(
  $$ insert into quiz_scores (user_id, chapter_num, best, total) values ('aaaaaaaa-0000-0000-0000-000000000001','ch',5,5) $$,
  42501, NULL, 'B 不能冒充 A 写 quiz_scores');
select throws_ok(
  $$ insert into replay_history (user_id, symbol, interval, total, correct, best_streak) values ('aaaaaaaa-0000-0000-0000-000000000001','ETHUSDT','1h',1,1,1) $$,
  42501, NULL, 'B 不能冒充 A 写 replay_history');
select throws_ok(
  $$ insert into replay_best (user_id, best_streak) values ('aaaaaaaa-0000-0000-0000-000000000001',99) $$,
  42501, NULL, 'B 不能冒充 A 写 replay_best');
select throws_ok(
  $$ insert into ai_conversations (user_id, role, content) values ('aaaaaaaa-0000-0000-0000-000000000001','user','spoof') $$,
  42501, NULL, 'B 不能冒充 A 写 ai_conversations');
select throws_ok(
  $$ insert into ai_feedback (user_id, rating) values ('aaaaaaaa-0000-0000-0000-000000000001','unhelpful') $$,
  42501, NULL, 'B 不能冒充 A 写 ai_feedback');
select throws_ok(
  $$ insert into user_settings (user_id, daily_goal_min, weekly_goal_min) values ('aaaaaaaa-0000-0000-0000-000000000001',5,45) $$,
  42501, NULL, 'B 不能冒充 A 写 user_settings');
select throws_ok(
  $$ insert into ai_citation_clicks (user_id, kind, chapter) values ('aaaaaaaa-0000-0000-0000-000000000001','source','ch') $$,
  42501, NULL, 'B 不能冒充 A 写 ai_citation_clicks');

-- 跨用户修改/删除：RLS 直接过滤掉不可见行，影响行数为 0
select is_empty(
  $$ update progress set doc_slug = 'hacked' where user_id = 'aaaaaaaa-0000-0000-0000-000000000001' returning 1 $$,
  'B 不能更新 A 的 progress');
select is_empty(
  $$ delete from wrongbook where user_id = 'aaaaaaaa-0000-0000-0000-000000000001' returning 1 $$,
  'B 不能删除 A 的 wrongbook');
select is_empty(
  $$ update user_settings set daily_goal_min = 5 where user_id = 'aaaaaaaa-0000-0000-0000-000000000001' returning 1 $$,
  'B 不能更新 A 的 user_settings');

reset role;
reset request.jwt.claim.sub;

-- ------------------------------------------------------------
-- 匿名：无 JWT claim，读不到任何用户数据，也不能冒充写入
-- ------------------------------------------------------------
set local role anon;

select is((select count(*) from progress), 0::bigint, 'anon 看不到用户 progress');
select is((select count(*) from user_settings), 0::bigint, 'anon 看不到用户 user_settings');
select is((select count(*) from wrongbook), 0::bigint, 'anon 看不到用户 wrongbook');

select throws_ok(
  $$ insert into progress (user_id, chapter_num, doc_slug) values ('aaaaaaaa-0000-0000-0000-000000000001','ch','anon') $$,
  42501, NULL, 'anon 不能写入用户 progress');
select throws_ok(
  $$ insert into user_settings (user_id, daily_goal_min, weekly_goal_min) values ('aaaaaaaa-0000-0000-0000-000000000001',15,90) $$,
  42501, NULL, 'anon 不能写入用户 user_settings');

-- 匿名可上报引用点击（user_id 为空），但没有读取权限
select lives_ok(
  $$ insert into ai_citation_clicks (user_id, kind, chapter) values (null, 'suggested', 'ch') $$,
  'anon 可以上报匿名引用点击');
select is((select count(*) from ai_citation_clicks), 0::bigint, 'anon 无 select 权限，读不到引用点击');

reset role;

-- ------------------------------------------------------------
-- 公开只读表：kb_embeddings 可读不可写
-- ------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000002';

select is((select count(*) from kb_embeddings where chapter = 'rls-fixture'), 1::bigint, 'authenticated 可读 kb_embeddings fixture');
select throws_ok(
  $$ insert into kb_embeddings (chunk, chapter, doc, locale, embedding) values ('x','ch','doc','zh', ('[' || repeat('0.1,', 1023) || '0.1]')::vector) $$,
  42501, NULL, 'authenticated 不能写 kb_embeddings（仅 service_role）');

reset role;

-- B 自己的行可写（证明策略不是“一律拒绝”）
set local role authenticated;
set local request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000002';
select lives_ok(
  $$ insert into progress (user_id, chapter_num, doc_slug) values ('bbbbbbbb-0000-0000-0000-000000000002','ch','b-doc') $$,
  'B 可以写自己的 progress');
select is((select count(*) from progress), 1::bigint, 'B 只看到自己的 1 行 progress');
reset role;

select * from finish();
rollback;
