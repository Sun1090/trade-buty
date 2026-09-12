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

## 审查流程

1. PR 中说明：解决什么问题、为什么内置/已有依赖不行、体积影响（`npm run check:bundle`）
2. 登记到本表（包名、理由、否决的替代方案）
3. CI 的 bundle 预算与 E2E 作为回归防线

## 安全基线

`npm run audit:prod` 只审计实际部署的依赖，并在 high / critical 漏洞时阻断 CI。2026-09-12 的审计发现 `next@16.3.1` 命中 critical Image Optimization RCE 公告，已升级到 `16.3.5`；`sharp` 同时更新到 `0.35.4`。`gray-matter` 的 `js-yaml@3.15.2` 与 ESLint 配置链的 `js-yaml@4.3.2` 通过 npm `overrides` 固定到修复版本。生产依赖审计结果必须保持 0。

完整依赖审计现已保持 0 漏洞。`@lhci/cli@0.15.1` 仍固定依赖 Lighthouse 12，但 Lighthouse 13.4.1 已修复其 Puppeteer/archive 链告警；本项目通过 npm `overrides` 固定 `lighthouse@13.4.1`、`tmp@0.2.7`、`uuid@11.1.1` 与 `qs@6.16.0`，并已用完整 `lhci autorun`、构建和测试回归验证兼容性。CI 同时运行 `audit:prod` 与 `audit:all`，任一 high/critical 漏洞都会阻断。
