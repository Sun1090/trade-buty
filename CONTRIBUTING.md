# Contributing to Trade Buty

Trade Buty 是面向全球中文用户的免费中立交易教育平台。贡献可以覆盖课程体验、练习功能、
可访问性、性能、测试、数据层、文档和运维，但不得突破[内容宪法](docs/plan.md#内容宪法不可回退红线)。

## Before You Start

开始前先阅读：

1. [`AGENTS.md`](AGENTS.md) — 开发入口、知识库契约与提交约束。
2. [`docs/plan.md`](docs/plan.md) — 产品定位、路线图和不可回退的内容红线。
3. [`docs/architecture.md`](docs/architecture.md) — 当前系统边界、数据流和门禁结构。
4. [`docs/ops.md`](docs/ops.md) — 内容运营、知识库更新和 CI 质量门禁。
5. [`docs/database-testing.md`](docs/database-testing.md) — 涉及 Supabase/RLS/迁移时的验证要求。

## Prerequisites

- Node.js 22 或更新版本；CI 固定使用 Node.js 22。
- npm（仓库以 `package-lock.json` 为准）。
- 运行数据层门禁时需要 Docker daemon。
- 运行 E2E 和 Lighthouse 时按脚本要求安装/启动 Chromium。

## Local Setup

```bash
git clone --recurse-submodules https://github.com/Sun1090/trade-buty.git
cd trade-buty
npm ci
cp .env.example .env.local   # 可选：需要 Supabase/AI/运营功能时再填写
npm run dev
```

若克隆时没有拉取 submodule，执行：

```bash
git submodule update --init --recursive
```

`.env.local`、DSN、API key、service role key 和真实用户数据都不得提交。缺少可选环境变量时，
站点应保持可构建、可浏览和可降级；不要用假密钥让 CI 或本地测试“变绿”。

## Development Commands

| Command | Purpose |
|---|---|
| `npm run dev` | 启动开发服务器 |
| `npm run lint` | ESLint 零警告门禁 |
| `npm run typecheck` | 生成 Next.js 类型并运行 `tsc --noEmit` |
| `npm test` | Vitest 单元、组件和脚本测试 |
| `npm run build` | 生产构建；prebuild 会同步知识库资产、搜索索引和标题数据 |
| `npm run e2e` | Playwright 关键路径、移动端、离线和静态表面 E2E |
| `npm run lhci` | Lighthouse CI 性能与可访问性预算 |
| `npm run db:test` | 在全新 Supabase Postgres 中验证迁移、RLS、同步与回滚 |
| `npm run backup:drill` | 本地备份、恢复、指纹和 RLS 复验 |
| `npm run check:docs` | README、贡献指南、架构文档、AGENTS 与 plan 的漂移门禁 |
| `npm run check:secrets` | 提交前 secrets 扫描 |
| `npm run audit:prod` | 生产依赖高危漏洞审计 |
| `npm run audit:all` | 全依赖高危漏洞审计 |
| `npm run kb:update` | 拉取知识库、检查契约、同步资产/索引并做构建回归 |

提交前至少运行与改动相关的定向测试，并运行：

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run check:docs
```

涉及数据库、路由、E2E 或安全头时，还必须运行对应的 `db:test`、`e2e`、`lhci` 或安全审计命令。

## Branch And Commit Convention

- 从最新 `origin/main` 创建聚焦分支，默认使用 `codex/<topic>` 前缀。
- 禁止直接向 `main` 推送；所有改动通过 PR 审查和 CI。
- 提交信息使用 Angular Convention：`feat(scope): ...`、`fix(scope): ...`、
  `docs(scope): ...`、`test(scope): ...`、`chore(scope): ...`。
- 一个提交只表达一个逻辑主题；不要把无关格式化、依赖升级和功能修复混在一起。
- 禁止添加 `Co-Authored-By`、AI sign-off 或其他生成器署名。
- PR 应说明用户可见变化、验证命令、风险和外部阻塞；合并采用 `Rebase and merge`，不制造
  merge commit，也不使用 squash。

## Knowledge-Base Rules

`content/kline-buty` 是只读 git submodule。**永远不要在这个仓库内直接编辑知识库 Markdown。**

- 内容变更在 [kline-buty](https://github.com/sun1090/kline-buty) 完成。
- 在本仓库更新内容时使用 `npm run kb:update`；它会拉取上游、检查契约、同步资产与搜索索引，
  并执行构建回归。
- 提交 submodule 指针时必须同时提交 `scripts/kb-manifest.json` 和对应的
  `docs/kb-changelog-draft.md`，提交信息要写明同步到的 kline-buty 版本。
- 缺失 frontmatter、导语或资产应采取宽容降级并告警，不能让整站构建崩溃。
- 站点路由和链接使用英文 slug：`/[locale]/knowledge/{chapter}/{doc}`。

## Content Constitution

所有内容和产品文案必须遵守以下红线：

- 不承诺收益，不暗示收益。
- 不荐股荐基，不做投顾业务。
- 不做券商开户导流，不接受广告或捐赠。
- 每篇知识库课程必须包含 `⚠️ 风险提示` 块。
- P0–P3 和基础课程永久免费；任何增长方案不能破坏中立性。

发现文案、交互或 AI 输出可能违反红线时，先补充测试或审计器，再修改实现。

## Database, Auth And Security

- 浏览器只使用 anon key 并始终依赖 RLS；`SUPABASE_SERVICE_ROLE_KEY` 只能存在于服务端。
- 新增表、列、策略、权限或约束时，必须同时添加正向迁移、必要的回滚脚本和真实
  Supabase Postgres 测试。
- 登录后同步采用“localStorage 是即时真相、云端异步双写、失败进入持久队列”的模型；
  不要改成阻塞学习交互的网络优先模型。
- 错误上报只允许发送白名单元数据，不得发送错误 message、stack、URL、用户身份或内容。
- 改动隐私、错误上报、增长事件或环境变量时，同步更新
  [`docs/error-reporting.md`](docs/error-reporting.md)、
  [`docs/growth-event-privacy-audit.md`](docs/growth-event-privacy-audit.md)、
  [`docs/env.md`](docs/env.md) 和站内隐私页。

## Documentation And Release Hygiene

- 行为、架构、命令、环境变量或运行边界变化时，同步更新 README、相关 `docs/` 文档和测试。
- `CHANGELOG.md` 由 `src/data/release-notes.json` 生成；不要手工编辑生成文件。
- 修改发布说明后运行 `npm run check:changelog`。
- 新增或删除公开路由时，检查 sitemap、robots、结构化数据、OG 和 E2E 覆盖。
- 性能或依赖变化必须提供实测结果，不能只更新预算数字。

## Pull Request Checklist

- [ ] 分支基于最新 `origin/main`，范围单一。
- [ ] 已运行相关定向测试和完整本地门禁。
- [ ] 新行为有单元、集成或 E2E 回归测试，无法自动验证的外部依赖已明确说明。
- [ ] 没有提交密钥、真实用户数据或生成器署名。
- [ ] 知识库指针、迁移、文档和隐私披露保持同步。
- [ ] PR 描述记录了命令、退出码或 CI 结果；失败项没有伪装成通过。
