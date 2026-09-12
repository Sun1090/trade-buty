# 依赖评审（R7.9）

> Reuse First 纪律：新增运行时依赖必须在 PR 中说明理由并登记到本表。
> 判断顺序：内置能力 → 已有依赖顺带覆盖 → 再考虑新依赖。

## 运行时依赖

| 包 | 为什么需要 | 不用它的替代方案为何不成立 |
|---|---|---|
| next / react / react-dom | 框架本体（App Router、SSG/ISR） | 非可选 |
| @supabase/supabase-js + @supabase/ssr | 数据库/鉴权官方客户端（RLS + 浏览器/服务端双端） | 手写 REST 无法覆盖 auth 会话管理与 RLS 语义 |
| postgres + drizzle-orm | 服务端直连 Postgres（RAG 向量检索 rpc、管理端读） | supabase-js 匿名 key 受 RLS 限制，管理操作需直连 |
| react-markdown + remark-gfm | 知识库 Markdown 渲染（GFM 表格/任务列表是课程刚需） | 自己写解析器无法覆盖 GFM 边界，安全（无 dangerouslySetInnerHTML） |
| rehype-raw | 知识库含内联 HTML（`<mark>` 等 VitePress 迁移产物） | 需渲染原文内联标签 |
| rehype-slug | 标题锚点（目录跳转契约） | 无替代 |
| github-slugger | 与 rehype-slug 一致的锚点算法（TOC 生成） | 自写 slug 算法会和锚点不一致 |
| gray-matter | frontmatter 解析（知识库契约字段） | 自写解析有边界风险 |
| lightweight-charts | 行情图/回放（TradingView 出品，~45KB gzip，Canvas 性能） | 自绘 K 线工作量与风险不成比例 |

## 明确不引入的

- lodash / date-fns / dayjs：日期用 `src/lib/date-utils.ts`（R4.8），无复杂时区运算需求
- axios：原生 fetch + `src/lib/ai/http.ts`（R7.5）已覆盖超时/重试
- 动画库：庆祝动效等用 Tailwind CSS 内置动画（R4.4）
- 图表库（recharts 等）：周报柱状用纯 CSS/SVG（R4.6）
- dotenv：脚本手动解析 .env.local（沿用 generate-embeddings.mjs 惯例）

## 月度审计日志（Q5.3）

> 每月至少跑一次 `npm run audit:prod` + `npm run audit:all` 与 `npm outdated`，把结果与「暂缓升级」的理由登记在此，避免审计只停留在口头。

### 2026-09-13

- `npm run audit:prod` → `found 0 vulnerabilities`（exit 0）
- `npm run audit:all` → `found 0 vulnerabilities`（exit 0）
- `npm outdated`：落后项全部是 major，无 minor/patch 待跟：

| 包 | 当前 | 最新 | 处理 |
|---|---|---|---|
| `@types/node` | 20.19.43 | 22.20.2 | 已升级到 `22.20.2`；全量测试、lint、typecheck 实测见「工具链 major 升级」 |
| `eslint` | 9.39.5 | 10.10.0 | 延期：`eslint-plugin-react` 尚未支持 ESLint 10，实跑 `npm run lint` 崩溃；证据见「工具链 major 升级」 |
| `js-yaml` | 4.3.2 | 5.4.1 | 已升级直接依赖到 `5.4.1` 并改用具名导出；`gray-matter` 与 ESLint 配置链继续由 `overrides` 固定到各自兼容版本 |
| `typescript` | 5.9.3 | 7.0.2 | 延期：`typescript-eslint` peer 尚未支持 TS 7，实跑 `npm run lint` 失败；证据见「工具链 major 升级」 |
| `vitest` | 4.1.11 | 5.0.0 | 已升级到 `5.0.0`；全量测试、lint、typecheck 实测见「工具链 major 升级」 |

> 判断依据：`npm outdated` 只把「latest 领先 wanted」的包列出来；本仓库锁文件已把想要的版本都拉到锁内，因此本表只讨论 major 迁移。

## 审查流程

1. PR 中说明：解决什么问题、为什么内置/已有依赖不行、体积影响（`npm run check:bundle`）
2. 登记到本表（包名、理由、否决的替代方案）
3. CI 的 bundle 预算与 E2E 作为回归防线

## 安全基线

`npm run audit:prod` 只审计实际部署的依赖，并在 high / critical 漏洞时阻断 CI。2026-09-12 的审计发现 `next@16.3.1` 命中 critical Image Optimization RCE 公告，已升级到 `16.3.5`；`sharp` 同时更新到 `0.35.4`。`gray-matter` 的 `js-yaml@3.15.2` 与 ESLint 配置链的 `js-yaml@4.3.2` 通过 npm `overrides` 固定到修复版本。生产依赖审计结果必须保持 0。

完整依赖审计现已保持 0 漏洞。`@lhci/cli@0.15.1` 仍固定依赖 Lighthouse 12，但 Lighthouse 13.4.1 已修复其 Puppeteer/archive 链告警；本项目通过 npm `overrides` 固定 `lighthouse@13.4.1`、`tmp@0.2.7`、`uuid@11.1.1` 与 `qs@6.16.0`，并已用完整 `lhci autorun`、构建和测试回归验证兼容性。CI 同时运行 `audit:prod` 与 `audit:all`，任一 high/critical 漏洞都会阻断。

## 工具链 major 升级（2026-09-13 实测）

`npm outdated` 当时列出五个 major（见「月度审计日志」）：本轮逐个实际安装并跑门禁，**落地三个、延期两个**，延期项附可复现证据而不是只写理由。

### 已落地

| 包 | 变更 | 为什么升 | 验证 |
|---|---|---|---|
| `@types/node` | 20.19.43 → 22.20.2 | CI 与本地运行时都是 Node 22，类型包落后两个 major 会掩盖真实 API 差异 | `npm run typecheck` exit 0；`npm run lint` exit 0；`npm test` 247 文件 / 1795 例通过 |
| `js-yaml` | 4.3.2 → 5.4.1 | v5 改为 ESM 原生包、**只有具名导出**（无 default export），属于会直接崩测试的破坏性变更 | `scripts/ci-workflow.test.mjs` 7 例通过；`npm test` 全量通过 |
| `vitest` | 4.1.11 → 5.0.0 | 与 Vite/Node 22 对齐，避免测试运行器落后主版本 | `npm test` 247 文件 / 1795 例通过；`npm run lint`、`npm run typecheck` exit 0 |

`js-yaml` 只在 `scripts/ci-workflow.test.mjs` 里被直接使用（解析 `.github/workflows/ci.yml`），因此升级面很窄；`gray-matter` 依赖的 `js-yaml@3.15.2` 与 `@eslint/eslintrc` 依赖的 `js-yaml@4.3.2` 仍由 `overrides` 固定，未随直接依赖变化。

### 延期（上游尚未支持，附实测证据）

| 包 | 目标 | 阻塞证据（本地实跑） | 解除条件 |
|---|---|---|---|
| `eslint` | 10.10.0 | 安装后 `npm run lint` 直接崩溃（exit 2）：`TypeError: Error while loading rule 'react/display-name': contextOrFilename.getFilename is not a function`，抛自 `eslint-plugin-react/lib/util/version.js`。`eslint-config-next@16.3.5` 依赖 `eslint-plugin-react@^7.37.0`，而 7.37.5（当前 latest）的 peer 仍是 `eslint: ^3 \|\| … \|\| ^9.7`，未声明 ESLint 10 支持 | `eslint-plugin-react` 发布支持 ESLint 10 的版本，且 `eslint-config-next` 跟随升级 |
| `typescript` | 7.0.2 | `npm run lint` exit 2：`typescript-eslint does not support TS 7.0.`（`typescript-eslint@8.70.0` 的 peer 为 `typescript >=4.8.4 <6.1.0`）。`tsc --noEmit` 本身能跑 | `typescript-eslint` 放宽 peer 到 TS 7 |

两项目前都**不能**通过 `overrides` 绕过：强行替换 `eslint-plugin-react` / `typescript-eslint` 会让 ESLint 配置链与 Next 官方配置发生版本错配，风险高于收益。

### 顺带修复

TS 7 的 `tsc --noEmit` 暴露出 `src/lib/sync-queue-executor.ts` 的 `user_settings` upsert 用了 `Record<string, number | string>`，被 Supabase 的 upsert 重载拒绝（`TS2345`）。改为具名行类型 `{ user_id: string; daily_goal_min?: number; weekly_goal_min?: number }` 后，**TS 5.9.3 与 TS 7.0.2 双双通过** `tsc --noEmit`；该改动纯类型，运行时行为不变。
