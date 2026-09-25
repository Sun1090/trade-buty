# Database testing (RLS · sync · rollback)

数据层不是靠“读一遍 SQL”来确认的。`npm run db:test` 会在一个**全新的 Supabase
Postgres 容器**里真实应用迁移并跑测试，任何一条断言失败都会让门禁变红。

## 为什么必须用 Supabase 镜像

RLS 依赖 Supabase 自己提供的东西：`auth.uid()`、`anon` / `authenticated` /
`service_role` 角色、以及 `public` schema 的默认授权。用普通 `postgres` 容器跑会得到
**假阳性**——例如角色不存在时 `auth.uid()` 恒为 `NULL`，越权测试会“通过”得毫无意义。

因此 `scripts/db-test.mjs` 固定使用 `supabase/postgres:<tag>`，并在启动后先校验 4 个
Supabase 角色存在（`anon` / `authenticated` / `service_role` / `authenticator`）、
`authenticated` 对 `public.progress` 有权限，否则直接判失败。

## 运行

```bash
npm run db:test                  # 全流程，结束销毁容器
npm run db:test -- --keep        # 保留容器（trade-buty-db-test）供人工排查
DB_TEST_IMAGE=supabase/postgres:17.6.1.155 npm run db:test   # 覆盖镜像
DB_TEST_CONTAINER=my-db npm run db:test                      # 覆盖容器名

npm run backup:drill             # 备份 → 销毁源库 → 全新实例恢复 → 指纹/RLS 复验
npm run backup:drill -- --keep   # 保留恢复容器供人工排查
BACKUP_DRILL_IMAGE=supabase/postgres:17.6.1.155 npm run backup:drill
```

需要本机有可用的 Docker daemon。CI 中作为独立作业 `db-tests` 与主 `ci` 作业并行执行。

## 覆盖范围

每次运行都在干净的容器里重新应用 `supabase/migrations/*.sql`（按字典序），然后执行：

### 1. `supabase/tests/rls_isolation.sql`（pgTAP，44 条断言）

跨用户隔离与越权写入：

- `auth.uid()` 由 `request.jwt.claim.sub` 解析；
- 用户 A 以自己的身份向 **9** 张用户表各写一行，其中 **8** 张当场读回 1 行；第 **9** 张
  `ai_citation_clicks` 读回 **0** 行——它只有 `for insert` 策略，这条钉的就是「能写 ≠ 能读」；
- 用户 B 看不到 A 的 `progress` / `wrongbook` / `quiz_scores` / `replay_history` /
  `replay_best` / `ai_conversations` / `ai_feedback` / `user_settings`；
- B 冒用 A 的 `user_id` 写入一律以 SQLSTATE `42501` 被拒（9 张表逐个试）；
- B 改/删 A 的行影响行数为 0（RLS `USING` 过滤，而不是报错）——这一半实测过 3 处：
  `update progress` / `delete wrongbook` / `update user_settings`；
- 匿名请求读不到任何用户数据，也不能写入；其中 `ai_feedback` 读不到这条是
  `/api/ai/feedback/export` 必须走 service_role 的直接依据（那条路线上只带 `ADMIN_TOKEN`、
  没有 Supabase 会话，`auth.uid()` 恒为 `NULL`，用匿名客户端查是「成功但零行」）；
  同一节还用超级用户视角先确认 fixture 行确实落库，避免把空表当成 RLS 生效；
- `kb_embeddings` 对 `authenticated` 可读不可写（只读公开表）；
- `ai_citation_clicks` 允许匿名上报（`user_id is null`），但没有 `select` 权限。

### 2. `supabase/tests/sync_and_constraints.sql`（pgTAP，34 条断言）

双设备同步所依赖的数据库契约：

- `progress` 重复 upsert 幂等（`on conflict do nothing` 不产生重复行）；
- 唯一键是 **per-user**：两个用户可以拥有相同的 `(chapter, doc)`；
- `wrongbook` / `quiz_scores` / `replay_best` 的冲突键存在（客户端 `onConflict` 依赖它们）；
- 后写入的设备覆盖 `picked` / `srs_stage` / `srs_due`，且不产生重复行；
- 显式传入 `answered_at` 时会被刷新（客户端「取较新」合并依赖它）；
- `touch_updated_at` 触发器在 `quiz_scores` 更新后刷新 `updated_at`；
- `user_settings` 目标档位约束（0008）：合法集合 `5/15/30`（每日）与 `45/90/150`（每周）**逐个**由
  `lives_ok` 走一遍 CHECK，非法值 `daily=7` 与 `weekly=100` 以 `23514` 被拒，且被拒之后原值不变；
- 删除 `auth.users` 行会级联清掉其业务数据（账号注销路径）；
- 目录级不变量（隐私页「删除账户即清空云端数据」的长期保障，按 `pg_constraint` 扫，新表自动纳入）：
  所有指向 `auth.users` 的外键必须显式写 `ON DELETE CASCADE` 或 `SET NULL`（PG 12 起没有 `ondel` 列，
  只能读 `pg_get_constraintdef`）；`ai_citation_clicks` 是唯一被允许的 `SET NULL`（注销后点击计数脱敏留档）；
  带 `user_id` 列的表必须挂上 `auth.users` 外键，否则注销后会留下归属行；
  另有一条 `>= 9` 的外键数量下限，防止前面两条在一个都不匹配的情况下「空集通过」。

### 3. 回滚演练（使用真实 rollback 脚本，两支都做）

`supabase/rollback/` 下有 2 个回滚脚本，`scripts/db-test.mjs` 两支都跑，而且是直接执行
仓库里的文件本身、不复制一份 SQL：

**0008 目标档位约束**

1. 确认两项约束存在；
2. 执行 rollback 脚本 → 确认约束消失；
3. 写入历史非法值（`daily=7, weekly=100`）；
4. 重新应用 `0008_goal_tier_constraints.sql` → 确认约束恢复；
5. 确认历史脏值被归一化为 `15/90`，且再次写入非法值会被拒绝。

**0009 embedding generation 原子激活**

1. 造一份夹具：`locale='rollback-test'` 下两行 `kb_embeddings`（一行属于 active generation、
   一行属于 staged generation）＋ 一行 `kb_embedding_generations` 指针；
2. 执行 `rollback/0009_atomic_embedding_generations.sql` → 确认 `kb_embedding_generations` 表
   已不存在、`kb_embeddings.generation` 列已移除，且**只有 active generation 的那一行留下**
   （读数 `t|t|1|1`）；
3. 重新应用 `0009_atomic_embedding_generations.sql` → 确认 active generation 回填到唯一那行上、
   指针表恢复，并且 RPC ACL 恢复：`authenticated` 对 `activate_kb_embedding_generation(text, uuid)`
   **没有** execute 权限（读数 `1|1|t`）。

这两段一起验证了**回滚脚本本身可用**和**正向迁移对既有数据的恢复路径可用**（0008 是脏值归一化，
0009 是 active generation 回填 + ACL 收回）。

### 4. 备份/恢复演练（Q5.4 本地可复现部分）

`npm run backup:drill` 不依赖线上 Supabase 项目，实际执行的是：

1. 在干净 Supabase Postgres 上应用全部迁移（10 个），写入覆盖 11 张业务表的样例数据——
   这 11 张就是迁移建出来的全部 `public` 业务表（`DATA_TABLES` 与迁移里 `create table`
   的集合相等，两边有判据互查）；
2. 用 `pg_dump -U postgres -d postgres -Fc --schema=public --no-owner` 生成 custom-format 备份。
   **注意没有 `--no-acl`**：ACL 是要一起验的东西，恢复端还专门依赖它；
3. **销毁源容器**，模拟实例丢失；
4. 启动另一个全新 Supabase Postgres，预置恢复 public schema 外键所需的最小 `auth.users` 行；
   先用 `pg_restore --list` 读清单、**滤掉镜像级的 ` DEFAULT ACL ` 与 ` SCHEMA - public ` 两行**
   （它们属于 `supabase_admin`，`postgres` 重放不了），再用
   `pg_restore -U postgres -d postgres --no-owner --single-transaction --exit-on-error --use-list=/tmp/trade-buty.list` 恢复；恢复后另有一步重新断言应用自己的 RPC ACL；
5. 逐表对比恢复前后的数据指纹，并对比 `schemaFingerprint` 的 9 项：
   `tables` / `rls` / `policies` / `constraints` / `indexes` / `triggers` / `columns` /
   `functions` / `extensions`；
6. 确认 `authenticated` 权限仍在；在恢复库上重跑全部 3 个 pgTAP 文件
   （`rls_isolation` 44 + `sync_and_constraints` 34 + `embedding_generations` 8 条断言）。

本演练只覆盖 Supabase 托管的 `public` schema 与应用数据。托管项目的 `auth`、Storage、
项目配置、定时备份策略及仓库镜像确认仍必须在 Supabase 控制台和外部存储中完成，不能
用本脚本替代。

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
- 云端定时备份、auth/Storage/项目配置导出与仓库镜像确认（本地 public schema/data 部分见 `npm run backup:drill`）；
- 真实第三方 OAuth/邮件链路。
