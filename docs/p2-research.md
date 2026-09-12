# P2 预研：账号系统与云端学习进度

> P2 目标：注册登录、云端进度存档、错题本。本文保留动工前预研，并补充最终实施状态。
> 前置原则：**P1 的 localStorage 体验必须无损保留**——未登录用户一切照旧。
>
> **实施更新（2026-09-12）**：最终采用 Supabase Auth（邮箱 OTP / 魔法链接），未安装或接入 Clerk。
> 数据表以 `supabase/migrations/` 的按序 SQL 为准，RLS 以 `auth.uid()` 为用户边界。

## 1. 技术选型

### 认证：初稿曾评估 Clerk（已作废）

| 维度 | 评估 |
|---|---|
| 免费额度 | 10,000 MAU（月活），P2 阶段绰绰有余 |
| 接入成本 | `<ClerkProvider>` + 中间件，半天级 |
| 登录方式 | 邮箱 / Google / GitHub 开箱即用 |
| 中文支持 | 组件文案可本地化（配合已有 zh/en 路由） |
| 备选 | Supabase Auth——若最终只用 Supabase 一家可减少一个供应商；但 Clerk 的 UI 与会话管理更省事 |

**最终决策**：使用 Supabase Auth，收敛认证、数据库与 pgvector 供应商；Clerk 方案未实施。

### 数据：Supabase PostgreSQL + Drizzle ORM

- pgvector 已内置 → P3 RAG 无需另立服务
- Drizzle schema 即 TypeScript 类型，与现有代码风格一致
- 免费档：500MB 数据库 + 50MB 存储 + 5GB 带宽

## 2. 数据模型草案

```sql
-- 用户进度（替代 localStorage 的 tb-progress）
create table progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  chapter_num text not null,
  doc_slug text not null,
  completed_at timestamptz default now(),
  primary key (user_id, chapter_num, doc_slug)
);

-- 测验成绩（替代 tb-quiz-*）
create table quiz_results (
  user_id text not null,
  chapter_num text not null,
  score int not null,
  total int not null,
  taken_at timestamptz default now()
);

-- 错题本（P2 新能力）
create table wrong_answers (
  user_id text not null,
  chapter_num text not null,
  question_idx int not null,
  picked int not null,
  answered_at timestamptz default now(),
  resolved boolean default false,
  primary key (user_id, chapter_num, question_idx)
);
```

回放最佳纪录（tb-replay-best）暂留本地，云端化优先级低。

## 3. 同步策略（关键设计）

```
未登录：一切写 localStorage（现状不变）
已登录：双写过渡 —— 先写本地再异步上云；登录时执行一次合并
合并规则：进度取并集（完成状态幂等）；测验成绩取每章最高分
冲突概率低（单用户单设备为主），不做实时 CRDT，够用
```

实现落点：
- `src/lib/progress.ts` 增加 `syncToCloud()` 钩子，事件 `tb-progress` 触发时顺带推送
- 登录回调页执行 `mergeLocalToCloud()`
- 客户端组件用 `useUser()` 判断是否登录态，UI 显示「同步中/已同步」

## 4. 迁移步骤（建议 4 个 PR）

| PR | 内容 | 可独立上线 |
|---|---|---|
| 1 | Supabase Auth 登录页 + callback + 会话恢复 | ✅ 不影响任何现有页面 |
| 2 | Supabase 建表 + Drizzle + 云端读写 API routes | ✅ 纯增量 |
| 3 | 双写 + 登录合并逻辑 | ✅ 失败静默降级到本地 |
| 4 | 错题本 UI（测验答错自动入本 + 复习页） | ✅ |

## 5. 成本与风险

- **费用**：Supabase 免费档 $0，触发付费的量级（万级 MAU）远在变现之后
- **风险 1**：Supabase 客户端体积受 bundle 预算约束 → 登录态布局按路由隔离并持续检查预算
- **风险 2**：大陆访问 Supabase 不稳 → 本站定位全球中文用户，与现状一致，不新增劣化
- **风险 3**：隐私合规 → 只存进度数据不存敏感信息，隐私政策页 P2 一并补上

## 6. 明确不做（P2 范围外）

- 用户生成内容（笔记/评论）→ 社区形态放 P4 评估
- 付费订阅字段预留 → 等有变现设计再动表结构
- 第三方身份（微信等）→ 当前 Supabase Auth 仅提供邮箱入口，不额外接入社交登录
