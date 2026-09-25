# 性能评审笔记（R7.3 / R7.4）

## R7.3 回放页低端机降级（已实现）

- 挂载后用 `requestAnimationFrame` 采样 1.5s 平均帧率（`src/lib/perf.ts`）
- < 24fps 判定低端机：回放图只保留最近 **150 根** K 线（`REPLAY_REDUCED_CANDLES`），Canvas 负载可控
- 帧率检测只在挂载时执行一次，不常驻，避免检测本身耗电

## R7.4 长列表虚拟化评审（结论：暂不需要，设监控防线）

**评审结论：不引入虚拟化。** 依据：

1. **数据规模天然有上界**：
   - 复习页（错题本）条目 = 题库题数（27 章 × 3 题 ≈ **81 条**），AI 变体题映射回同一条目，不会新增行
   - 统计页全部是聚合数字 + 7 天周报（7 根柱），无长列表
   - 回放历史虽可累积，但复习页/统计页并不渲染该明细
2. **上限防线**：R2 题库扩展纪律——固定题库每章 ≥3 题；若未来题库扩到每章 >20 题（总量 >500），届时复习页引入 `@tanstack/virtual` 级别的虚拟化（届时需新增依赖，走 docs/deps.md 评审）
3. **当前缓解**：复习页按篇章分组渲染，单组条目少；SRS 排序把到期项置顶，超长时用户实际浏览的条目更少

**触发重评条件**：任一列表页面渲染 >200 条 DOM 节点、或在移动端实测掉帧。

## R9.6 登录/同步代码进入 layout 的体积权衡

**事实**：R9.5（离线写队列）+ R9.6（合并摘要）让 `auth-provider` 增加了 `sync-layer` + `sync-queue-store` + `buildQueueExecutor` 的引用。这些代码仅在登录后才需要，但 `AuthProvider` 是 layout 级 Provider，会被打进每个内容页的共享 chunk。

**优化尝试**：
- `hydrateFromCloud` 改 `import("@/lib/sync-layer").then(...)` 动态引入 → Next/React 框架 chunk 仍被静态引用
- `flushPersistedQueue` 改 useEffect 内 dynamic import → 减少约 12KB gzip
- `SyncSummaryToast` 用 `next/dynamic({ ssr: false })`（封装到 `sync-summary-toast-lazy.tsx`，因为 Next 16 要求 `ssr:false` 必须在 client 组件里）→ toast 实现从首屏 chunk 剥离
- `enqueueWrite` 抽到 `sync-layer-queue-fallback.ts`，内部 dynamic import `sync-queue-store` → 阻断 layout 直接静态引用
- `buildQueueExecutor` 抽到独立模块 `sync-queue-executor.ts`，便于 lazy import 单独成 chunk

**拆分自身的代价**：动态 import 会失败（该 chunk 首载就没下成功、或发布后旧 hash 404），而调用点是 fire-and-forget。所以 `sync-layer-queue-fallback.ts` 把这类写入缓冲在模块内存里，等 chunk 可用时按同一去重/截断口径补落盘，并就地吞掉失败（`service worker` 只预缓存 `offline.html`，JS chunk 一律走网络）。

**净结果**：内容页 +12KB gzip。当时把这笔成本判成「删不掉」，理由是它由 Next/React + Supabase 客户端 + `sync-layer` 共同构成——**这半句后来被推翻了**：R16.235 在构建产物里量到 `@supabase/supabase-js` 那一颗 chunk 单独就 **59.3KB gzip**，且 454 条 locale 路由的 HTML 全都引用它（入口是 `auth-provider.tsx:4`、`auth-header.tsx:7`、`sync-layer.ts:3` 三处静态 import，全都只在挂载后或点击时才用）。所以「删不掉」不成立，成立的是「消除它需要能端到端验证登录态，而 E2E 跑在没有 Supabase env 的环境（R7.7 降级路径）」。

**当时的预算调整**（v0.5 时期，`a8b1820`（perf(bundle): lazy-load sync queue modules + bump budgets for login-aware pages (R9.6)））：那一次把 `check-bundle.mjs` 抽查清单里的四条各抬高 15KB——`zh` 与 `en` 从 280 到 295、`zh/search` 从 280 到 295、`zh/knowledge/getting-started/market-overview` 从 290 到 305。**这些数字今天没有任何脚本持有**：R13.15 之后「按页面逐个定价」换成了「按分组定价」，唯一清单是 `scripts/bundle-budgets.json`（见下面那一节；`scripts/perf-notes-claims.test.mjs` 逐条比对文档与清单，`check-bundle.mjs` 只是读清单的巡检脚本）。这一段保留原样当历史，读的人别拿它去核对现在的预算。

**判断**：登录态是 v0.5 的核心功能（同步、合并、离线写），不引入任何重库（无新依赖），不进入非登录场景的关键路径（错误/回放/AI 走未登录模式），12KB 的边际成本可接受。当时那句「只剩一条路可走：把整个 `AuthProvider` 拆成公共 context + 登录后 sub-tree，重构成本/收益不划算」也不成立——R16.235 登记的那条更省（把三处静态 import 改成挂载后 / 点击时动态引入，并按 `check:bundle` 里 AI chunk 的同一形状加隔离判据），拆 Provider 反而是那一步做完之后才需要重新权衡的成本。

## R13.15 首屏性能预算按路由细分

**现状（2026-09-12 干净构建）**：`scripts/check-bundle.mjs` 不再只抽查 8 条路由，而是遍历 `.next/server/app` 下全部 `/zh`、`/en` HTML。每条路由必须恰好命中 `scripts/bundle-budgets.json` 中一个分组；未命中和多分组匹配都会阻断 CI。

- 指标口径：外链 JS gzip + 外链 CSS gzip + HTML gzip = `total`，单位为 KB（1024 bytes）。HTML 内联脚本计入 HTML，不重复计入 JS。
- 分组：home、path、knowledge-chapter、knowledge-lesson、search、review、bookmarks、stats、ai、chart、replay、privacy、glossary、static-info、auth（这一串 `id` 连同顺序由 `scripts/perf-notes-claims.test.mjs` 与清单逐字比对：加一个分组而不写进来、或删了分组而文档还列着，都红在这里）。
- 预算与实现规则分离：`bundle-budgets.json` 是唯一预算清单；`bundle-budget.mjs` 提供 `validateBudgetManifest`（校验）、`compileBudgetManifest` 与 `matchRouteBudget`（匹配）、`collectStaticAssetUrls` 与 `staticAssetRepoPath`（资产提取）、`measureRoute` 与 `metricFailures`（测量）四组纯函数，并纳入 Vitest（`bundle-budget.test.mjs` 逐个导入）。
- 失败输出按路由列出超限的 JS/CSS/HTML/total，再按体积倒序列出该路由前 10 个外链 chunk，便于直接定位回归。
- AI chunk 隔离扩展到全部非 AI 路由：以 `X-Quota-Limit` 为指纹找到专属 chunk，452 条非 AI 路由均不得引用。

**首次全量测量**：

| 分组 | 路由数 | 最大 total | 预算 | 最大路由 |
|---|---:|---:|---:|---|
| home | 2 | 339.2 KB | 360 KB | `zh` |
| path | 2 | 341.0 KB | 365 KB | `zh/path` |
| knowledge-chapter | 54 | 332.9 KB | 370 KB | `zh/knowledge/markets-instruments` |
| knowledge-lesson | 364 | 386.8 KB | 400 KB | `zh/knowledge/technical-analysis/drawing-tools` |
| search | 2 | 308.4 KB | 335 KB | `zh/search` |
| review | 2 | 328.9 KB | 350 KB | `zh/review` |
| bookmarks | 2 | 304.2 KB | 335 KB | `zh/bookmarks` |
| stats | 2 | 351.8 KB | 370 KB | `zh/stats` |
| ai | 2 | 309.8 KB | 350 KB | `zh/ai` |
| chart | 2 | 361.0 KB | 390 KB | `zh/chart` |
| replay | 2 | 368.4 KB | 400 KB | `zh/replay` |
| privacy | 2 | 309.2 KB | 340 KB | `zh/privacy` |
| glossary | 2 | 310.5 KB | 340 KB | `zh/glossary` |
| static-info | 10 | 306.4 KB | 340 KB | `zh/about` |
| auth | 4 | 304.5 KB | 340 KB | `zh/auth` |

`npm run check:bundle` 遍历构建产物里全部 `/zh`、`/en` HTML（2026-09-25 那次读到 454 条路由）；预算按分组各设 `js` / `css` / `html` / `total` 四条上限，例如 knowledge-lesson js 310KB、ai js 315KB、chart js 350KB、replay js 355KB——这几个数是**清单里的那个值**，`scripts/perf-notes-claims.test.mjs` 逐字比对，改预算而不改这里即红。`html` 那条单独防止长正文整页膨胀。

### 复测（2026-09-25，本地干净构建 `npm run build` 后跑 `npm run check:bundle`）

上面那张表是 2026-09-12 的首次全量测量，保留原样当历史。今天的读数（最大 total / 预算）：

| 分组 | 今天最大 total | 预算 | 最大路由 |
|---|---:|---:|---|
| home | 349.2 KB | 360 KB | `zh` |
| path | 349.9 KB | 365 KB | `zh/path` |
| knowledge-chapter | 334.1 KB | 370 KB | `zh/knowledge/markets-instruments` |
| knowledge-lesson | 397.8 KB | 400 → **404** KB | `zh/knowledge/technical-analysis/drawing-tools` |
| search | 317.1 KB | 335 KB | `zh/search` |
| review | 338.0 KB | 350 KB | `zh/review` |
| bookmarks | 312.2 KB | 335 KB | `zh/bookmarks` |
| stats | 364.5 KB | 370 KB | `zh/stats` |
| ai | 319.7 KB | 350 KB | `zh/ai` |
| chart | 369.7 KB | 390 KB | `zh/chart` |
| replay | 379.0 KB | 400 KB | `zh/replay` |
| privacy | 321.8 KB | 340 KB | `zh/privacy` |
| glossary | 318.4 KB | 340 KB | `zh/glossary` |
| static-info | 331.6 KB | 340 KB | `zh/changelog` |
| auth | 312.5 KB | 340 KB | `zh/auth` |

**为什么给 lesson 组让出 4KB（以及这笔债）**：这一组从 386.8KB（9-12）涨到本地 397.8KB，而 **CI 上是 399.9KB**（`main@478effc` 那次 `ci` 的 `check:bundle` 读数），同一份代码两台机器差 **2.2KB**——这 2.2KB 出在哪一段还没查明（CI 只报了 `total` 超，没报 `js`，所以差异至少不完全在 JS 上）。预算容差比构建机之间的噪声还小，结果就是「任何往字典里加一句话的 PR 都会让 CI 红」（PR #317 加了一句邮件订阅说明，CI 读到 400.0/400 就是这个形状）。404 = CI 当前最大 + 约两倍于那个差异，仍然抓得住真正的回归（第二十三轮那次误加整本字典是 +13.7KB）。还债的一条登记在 `docs/roadmap.md` **R16.235**：课文首屏里躺着 **59.3KB gzip 的 `@supabase/supabase-js` chunk**（`2ul2-0o5b9aur.js`，指纹 `GoTrueClient`/`RealtimeClient`），454 条路由的 HTML 全都引用它——入口是 `auth-provider.tsx:4`、`auth-header.tsx:7` 与 `sync-layer.ts:3` 三处静态 import，而这三处全都在挂载后或点击时才用它。把它挪出首屏后这一组的预算要往下收到 350 以下。没在本轮动手的原因也登记在同一条：E2E 跑在没有 Supabase env 的环境（R7.7 降级路径），改完的登录态恢复我**没有办法端到端验证**，不能凭推断改登录链路。
