-- Atomic embedding generation activation and cleanup contract.
begin;
select plan(8);

delete from kb_embedding_generations where locale in ('zh', 'en');
delete from kb_embeddings where locale in ('zh', 'en');

insert into kb_embeddings (chunk, chapter, doc, locale, generation, embedding) values
  ('old zh', 'spot', 'old', 'zh', '11111111-1111-4111-8111-111111111111', ('[' || repeat('0.1,', 1023) || '0.1]')::vector),
  ('new zh a', 'spot', 'new-a', 'zh', '22222222-2222-4222-8222-222222222222', ('[' || repeat('0.2,', 1023) || '0.2]')::vector),
  ('new zh b', 'spot', 'new-b', 'zh', '22222222-2222-4222-8222-222222222222', ('[' || repeat('0.3,', 1023) || '0.3]')::vector),
  ('old en', 'spot', 'old-en', 'en', '33333333-3333-4333-8333-333333333333', ('[' || repeat('0.1,', 1023) || '0.1]')::vector);

insert into kb_embedding_generations (locale, active_generation) values
  ('zh', '11111111-1111-4111-8111-111111111111'),
  ('en', '33333333-3333-4333-8333-333333333333');

select is(
  (select active_generation from kb_embedding_generations where locale = 'zh'),
  '11111111-1111-4111-8111-111111111111'::uuid,
  '旧 generation 在激活前保持有效');

select is(
  activate_kb_embedding_generation('zh', '22222222-2222-4222-8222-222222222222'),
  2,
  '激活函数返回新 generation 行数');
select is(
  (select active_generation from kb_embedding_generations where locale = 'zh'),
  '22222222-2222-4222-8222-222222222222'::uuid,
  '激活指针原子切换到新 generation');
select is(
  (select count(*) from kb_embeddings where locale = 'zh' and generation = '11111111-1111-4111-8111-111111111111'),
  0::bigint,
  '激活后清理同 locale 的旧 generation');
select is(
  (select count(*) from kb_embeddings where locale = 'zh' and generation = '22222222-2222-4222-8222-222222222222'),
  2::bigint,
  '新 generation 全量保留');
select is(
  (select count(*) from kb_embeddings where locale = 'en'),
  1::bigint,
  '激活 zh 不影响其他 locale');

select throws_ok(
  $$ select activate_kb_embedding_generation('zh', '44444444-4444-4444-8444-444444444444') $$,
  'P0001', NULL,
  '空 generation 不能激活');
select ok(
  not has_function_privilege('authenticated', 'activate_kb_embedding_generation(text, uuid)', 'execute'),
  'authenticated 角色不能激活 generation');

select * from finish();
rollback;
