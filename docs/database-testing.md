# Database testing (RLS · sync · rollback)

数据层不是靠“读一遍 SQL”来确认的。`npm run db:test` 会在一个**全新的 Supabase
Postgres 容器**里真实应用迁移并跑测试，任何一条断言失败都会让门禁变红。

## 为什么必须用 Supabase 镜像

RLS 依赖 Supabase 自己提供的东西：`auth.uid()`、`anon` / `authenticated` /
`service_role` 角色、以及 `public` schema 的默认授权。用普通 `postgres` 容器跑会得到
**假阳性**——例如角色不存在时 `auth.uid()` 恒为 `NULL`，越权测试会“通过”得毫无意义。

因此 `scripts/db-test.mjs` 固定使用 `supabase/postgres:<tag>`，并在启动后先校验四个
Supabase 角色存在、`authenticated` 对 `public.progress` 有权限，否则直接判失败。

## 运行

```bash
npm run db:test                  # 全流程，结束销毁容器
npm run db:test -- --keep        # 保留容器（trade-buty-db-test）供人工排查
DB_TEST_IMAGE=supabase/postgres:17.6.1.155 npm run db:test   # 覆盖镜像
DB_TEST_CONTAINER=my-db npm run db:test                      # 覆盖容器名
```

需要本机有可用的 Docker daemon。CI 中作为独立作业 `db-tests` 与主 `ci` 作业并行执行。

## 覆盖范围

每次运行都在干净的容器里重新应用 `supabase/migrations/*.sql`（按字典序），然后执行：

### 1. `supabase/tests/rls_isolation.sql`（pgTAP，38 条断言）

跨用户隔离与越权写入：

- `auth.uid()` 由 `request.jwt.claim.sub` 解析；
- 用户 A 能读写自己的行（9 张用户表）；
- 用户 B 看不到 A 的 `progress` / `wrongbook` / `quiz_scores` / `replay_history` /
  `replay_best` / `ai_conversations` / `ai_feedback` / `user_settings`；
- B 冒用 A 的 `user_id` 写入一律以 SQLSTATE `42501` 被拒；
- B 更新/删除 A 的行影响行数为 0（RLS `USING` 过滤，而不是报错）；
- 匿名请求读不到任何用户数据，也不能写入；
- `kb_embeddings` 对 `authenticated` 可读不可写（只读公开表）；
- `ai_citation_clicks` 允许匿名上报（`user_id is null`），但没有 `select` 权限。

### 2. `supabase/tests/sync_and_constraints.sql`（pgTAP，26 条断言）

双设备同步所依赖的数据库契约：

- `progress` 重复 upsert 幂等（`on conflict do nothing` 不产生重复行）；
- 唯一键是 **per-user**：两个用户可以拥有相同的 `(chapter, doc)`；
- `wrongbook` / `quiz_scores` / `replay_best` 的冲突键存在（客户端 `onConflict` 依赖它们）；
- 后写入的设备覆盖 `picked` / `srs_stage` / `srs_due`，且不产生重复行；
- 显式传入 `answered_at` 时会被刷新（客户端「取较新」合并依赖它）；
- `touch_updated_at` 触发器在 `quiz_scores` 更新后刷新 `updated_at`；
- `user_settings` 目标档位约束（0008）：`5/15/30` 与 `45/90/150` 合法，其他值以 `23514` 被拒；
- 删除 `auth.users` 行会级联清掉其业务数据（账号注销路径）。

### 3. 回滚演练（使用真实 rollback 脚本）

`scripts/db-test.mjs` 直接执行 `supabase/rollback/0008_goal_tier_constraints.sql`，
而不是复制一份 SQL：

1. 确认两项约束存在；
2. 执行 rollback 脚本 → 确认约束消失；
3. 写入历史非法值（`daily=7, weekly=100`）；
4. 重新应用 `0008_goal_tier_constraints.sql` → 确认约束恢复；
5. 确认历史脏值被归一化为 `15/90`，且再次写入非法值会被拒绝。

这一步同时验证了**回滚脚本本身可用**和**正向迁移对脏数据的归一化路径可用**。

## 新增测试

测试文件放在 `supabase/tests/`，命名为英文、不含数字前缀，扩展名 `.sql`，
`npm run db:test` 会按文件名升序全部执行。pgTAP 断言用显式的 4 参数形式：

```sql
select throws_ok($$ insert ... $$, 42501, NULL, '描述');
```

`throws_ok(sql, errcode, errmsg, description)` 中把 `errmsg` 传 `NULL`，
只校验 SQLSTATE，避免因错误文案变化产生假失败。

## 尚未覆盖（需要外部资源）

- 线上 Supabase 项目的真实联调（需项目 URL 与 anon/service key）；
- 云端定时备份与导出策略（本地可复现部分见 Q5.4 备份演练脚本）；
- 真实第三方 OAuth/邮件链路。
