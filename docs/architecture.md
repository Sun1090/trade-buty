# 系统架构

> 当前基线：2026-09-13。本文描述代码中已经存在并可验证的架构，不替代
> [`docs/plan.md`](plan.md) 的产品决策或各专项文档中的操作细节。

## 1. 架构目标

Trade Buty 是一个 Next.js App Router 双语学习站点，核心约束是：

- 静态内容优先：课程、搜索索引和 SEO 表面可在没有运行时数据库的情况下构建和浏览。
- 本地优先学习：未登录用户的所有进度、错题、测验和回放数据在浏览器内即时可用。
- 中立与可降级：知识库、Supabase、AI 或行情服务不可用时，站点应降级而不是整体崩溃。
- 内容源唯一：课程 Markdown 只存在于只读 submodule `content/kline-buty`。
- 门禁可复现：类型、测试、内容契约、数据库 RLS、E2E 和性能预算都由可执行命令验证。

## 2. 运行拓扑

```text
Browser
  ├─ /[locale]/...          Next.js App Router 页面（内容页以 SSG 为主）
  ├─ /share/[kind]/[path]   无语言前缀的分享落地页
  ├─ /api/...               认证、AI、错误上报 Route Handlers
  ├─ localStorage           学习数据即时真相 + 离线写队列
  └─ Service Worker         应用壳离线兜底

Vercel
  ├─ Next.js 16 构建产物
  ├─ public/search-index.json
  ├─ public/knowledge-assets/{locale}/...
  └─ 安全头、缓存头和平台日志

Supabase
  ├─ Auth（邮箱 OTP）
  ├─ PostgreSQL + RLS 用户数据
  └─ pgvector 知识库 embedding

External services
  ├─ Binance REST / WebSocket 行情
  └─ 任意 OpenAI Chat Completions / Embeddings 格式端点
```

## 3. 路由与请求边界

### 3.1 语言代理

根级语言代理位于 [`src/proxy.ts`](../src/proxy.ts)。Next.js 16 不再使用旧式
`middleware.ts` 文件作为本项目的当前入口；代理负责：

- 为缺少 locale 前缀的页面补 `/zh` 或 `/en`。
- 默认 locale 为 `en`，用户选择由 `tb-lang` cookie 记忆。
- 放行 `/_next/`、`/api/`、`/share/` 和真实存在的根级 file-route / public 文件。
- 不再按文件扩展名通配放行，避免不存在的类文件路径落进 `/[locale]` 并形成软 404。

`src/proxy.test.ts` 锁定 locale、cookie、matcher、public 文件和分享链接边界。新增根级静态
表面时必须同步 matcher，否则测试会阻断。

### 3.2 App Router

- `src/app/[locale]/` 承载双语页面，主要路由在构建时生成静态 HTML。
- `src/app/[locale]/knowledge/[chapter]/[doc]/page.tsx` 渲染课程页。
- `src/app/api/` 承载认证、AI 和服务端数据操作，运行在 Node.js runtime。
- `src/app/share/[kind]/[path]/` 是故意不放在 locale 段下的分享页；locale 编码在分享载荷中，
  这样同一分享 URL 不会被语言代理重写为 404。
- 根级 `robots.ts`、`sitemap.ts`、`manifest.ts` 和图标路由提供静态 SEO/PWA 表面。

根 layout 只放全局样式、字体和主题壳；账号相关代码通过动态加载隔离，避免游客首屏下载登录模块。

## 4. 知识库内容管线

### 4.1 输入

知识库来自 `content/kline-buty` submodule，结构为：

```text
docs/knowledge/
├── zh/{chapter-slug}/README.md
├── zh/{chapter-slug}/{lesson-slug}.md
├── zh/{chapter-slug}/_assets/...
├── en/{chapter-slug}/README.md
└── en/{chapter-slug}/{lesson-slug}.md
```

课程 frontmatter 至少使用 `title` 和 `description`；标题前导序号决定课内顺序。知识库仓库
负责源内容，本站只读消费，任何直接修改都违反 [`AGENTS.md`](../AGENTS.md) 的契约。

### 4.2 prebuild

`npm run build` 触发 `prebuild`，顺序执行：

1. `scripts/sync-knowledge-assets.mjs` 把每个章节的 `_assets/` 复制到
   `public/knowledge-assets/{locale}/{chapter}/`。
2. `scripts/generate-search-index.mjs` 扫描 zh/en Markdown，生成
   `public/search-index.json`。
3. `scripts/validate-knowledge-contract.mjs` 校验目录、文件名、frontmatter 和语言根契约；
   按宽容模式告警，只有知识库根缺失等不可恢复状态才失败。
4. `scripts/generate-kb-titles.mjs` 生成运行时需要的标题清单。

`src/lib/content.ts` 在构建/服务端读取 Markdown，使用 `gray-matter` 解析 frontmatter。
缺字段时回退到文件名或首个 H1；解析失败只告警并继续。渲染前会剥离知识库历史 VitePress
构件、重写相对链接和 `_assets/` 路径，保证站内导航和图片可用。

### 4.3 更新流程

内容更新统一使用 `npm run kb:update`。脚本会更新 submodule、核对 changelog 与内容契约、
同步资产/索引并运行生产构建。提交时记录新的 submodule 指针和 KB manifest，禁止在
`content/kline-buty` 内产生本地修改。

### 4.4 搜索

搜索没有运行时搜索服务。构建时 JSON 索引在构建阶段生成，客户端只下载索引并执行匹配、排序和
无结果诊断；同义词和诊断逻辑在 `src/lib/search-*.ts`。索引缺失时构建门禁失败，页面
不通过静默空索引降级。

## 5. 账号、数据与同步（Supabase Auth）

### 5.1 客户端数据库访问

- `src/lib/supabase/client.ts`：浏览器 anon client，懒初始化并遵守 RLS。
- `src/lib/supabase/server.ts`：Server Component / Route Handler 的 cookie client。
- `src/lib/supabase/admin.ts`：service role client，只允许被 `src/app/api/**` 导入。

### 5.2 本地优先同步

学习数据首先写入 `localStorage`，已登录时再 fire-and-forget 写入 Supabase。网络失败不会丢失
事件，而是进入持久写队列，在恢复在线或下一次 hydrate 时重放。登录时执行本地/云端合并：

- 进度、错题和回放记录取并集。
- 测验成绩取最高分。
- 冲突元数据记录在 `tb-cloud-sync-meta`，供 UI 说明同步状态。
- 云端不可用时仍保留本机行为；游客模式不加载账号 chunk。

核心实现位于 `src/lib/sync-layer.ts`、`src/lib/sync-queue-*.ts` 和
`src/lib/sync-conflicts.ts`。

### 5.3 数据库边界

Supabase migrations 位于 `supabase/migrations/`，正向变更按文件名顺序执行。用户数据表全部
启用 RLS；浏览器只能访问当前 `auth.uid()` 的行。账号删除通过服务端删除 `auth.users`，
再由外键级联清理业务数据。

数据库验证分两层：

- Vitest 单测覆盖合并、队列、冲突和 API 契约。
- `npm run db:test` 在全新 Supabase Postgres 镜像中执行 migrations、pgTAP RLS/同步断言和
  回滚重放；CI 的 `db-tests` 作业独立阻断。

备份恢复的本地可复现部分由 `npm run backup:drill` 覆盖；Supabase 云控制台、定时备份和
异地仓库镜像仍属于外部运维步骤。

## 6. AI 陪学与 RAG

AI Route Handlers 位于 `src/app/api/ai/`，客户端通过流式响应读取回答和引用。模型访问统一
封装在 `src/lib/ai/client.ts`，使用原生 `fetch` 调用任意 OpenAI Chat Completions /
Embeddings 格式端点；`AI_API_URL`、`AI_API_KEY`、`AI_MODEL` 和 embedding 配置由环境变量提供。

RAG 流程：

1. 服务端对用户问题生成 embedding。
2. 在 Supabase pgvector 的 `kb_embeddings` 表中按 locale/chapter 过滤并调用
   `match_kb_embeddings` 检索 chunks。
3. 将检索片段和课程上下文注入 prompt，回答通过 header 返回来源引用。
4. 输出护栏、限流、超时重试和模型 fallback 在服务端执行；上游错误细节不返回客户端。

AI 是增强层，不是站点可用性的前置条件。关闭 `NEXT_PUBLIC_AI_ENABLED` 后入口隐藏，内容页、
搜索、练习和本地进度仍正常工作。

## 7. 分享、离线、缓存与安全

### 分享

`/share/[kind]/[path]` 的载荷自包含 kind、版本、指标和 locale。服务端只接受白名单 schema，
生成 OG 图并在数据不完整时降级到通用卡片。语言代理必须放行该根级前缀。

### PWA

`public/sw.js` 在安装时预取离线壳 `public/offline.html`，只对导航请求提供离线兜底，不缓存
API、搜索索引、知识库资产或行情数据。`next.config.ts` 对 `sw.js` 使用 `no-cache`，对
`search-index.json`、`knowledge-assets/**` 和离线壳使用每次重验证策略。

### 安全与可观测性

`next.config.ts` 设置 CSP、HSTS、`nosniff`、`DENY`、Referrer-Policy 和 Permissions-Policy。
`POST /api/error-reports` 是唯一前端错误入口，只接受封闭字段和白名单 token；错误 message、
stack、URL、用户身份和自由文本不会离开浏览器，端点也不把诊断写入数据库。主动告警仍需要
外部监控账号，当前只提供可被平台日志消费的 sanitized 信号。

增长事件和隐私边界分别在 `docs/growth-events.md`、`docs/growth-event-privacy-audit.md`
和站内隐私页中维护。

## 8. 测试与 CI

本地测试分为：

- Vitest：纯函数、组件交互、Route Handler、脚本审计器。
- Playwright E2E：Smoke、移动端溢出、PWA 离线、metadata/static surface、全站链接、亮色对比度。
- Playwright visual：人工复核截图基线。
- Lighthouse CI：性能、可访问性和最佳实践预算。
- Supabase Postgres pgTAP：RLS 越权、同步约束、迁移回滚。
- 内容审计：frontmatter、风险提示、slug、链接、sitemap、搜索索引、结构化数据、术语和
  翻译 parity。

GitHub Actions 包含两个并行作业：

- `ci`：依赖/漏洞审计、secrets、lint、测试、typecheck、build、移动端、内容门禁、E2E 和
  Lighthouse。
- `db-tests`：Supabase Postgres migrations、RLS/同步 pgTAP、0008 回滚重放和备份恢复演练。

合并门禁以命令退出码为准；不要通过 `tail` 等管道隐藏失败状态。Vercel 预览是部署验证，
GitHub Actions 才是仓库合并的权威门禁。

## 9. 关键扩展点

| 需求 | 首先修改 | 必须同步 |
|---|---|---|
| 新增页面 | `src/app/[locale]/...` | sitemap、metadata、E2E、翻译字典 |
| 新增根级静态路由 | `src/proxy.ts` matcher、`src/proxy.test.ts` | 缓存头、SEO 门禁 |
| 新增用户数据字段 | `supabase/migrations/`、`src/lib/supabase/schema.ts` | RLS、同步、导出、注销、db tests |
| 新增知识库结构 | kline-buty 仓库 | `AGENTS.md`、contract 脚本、manifest、内容门禁 |
| 修改 AI provider | `src/lib/ai/client.ts` | env 文档、runtime contract、限流/安全测试 |
| 修改隐私字段 | 对应 API 和客户端白名单 | 隐私页、专项审计、`check:*privacy` |
| 发布新版本 | `src/data/release-notes.json` | 生成 `CHANGELOG.md`、release review |

## 10. 相关文档

- [`docs/plan.md`](plan.md) — 产品定位、路线图和内容宪法。
- [`CONTRIBUTING.md`](../CONTRIBUTING.md) — 开发、测试、提交和 PR 流程。
- [`docs/ops.md`](ops.md) — 内容运营与 CI 门禁。
- [`docs/database-testing.md`](database-testing.md) — RLS、同步、迁移回滚和备份演练。
- [`docs/caching.md`](caching.md) — 页面、localStorage、内存缓存、PWA 与失效策略。
- [`docs/error-reporting.md`](error-reporting.md) — 错误上报 schema、隐私和日志边界。
- [`docs/env.md`](env.md) — 环境变量与降级行为。
