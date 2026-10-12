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

**净结果**：内容页 +12KB gzip。当时把这笔成本判成「删不掉」，理由是它由 Next/React + Supabase 客户端 + `sync-layer` 共同构成——**这半句后来被推翻了**：R16.235 在构建产物里量到 `@supabase/supabase-js` 那一颗 chunk 单独就 **59.3KB gzip**，且 454 条 locale 路由的 HTML 全都引用它（入口是 `auth-provider.tsx:4`、`auth-header.tsx:7`、`sync-layer.ts:3` 三处静态 import，全都只在挂载后或点击时才用）。所以「删不掉」不成立，成立的是「消除它需要能端到端验证登录态，而 E2E 跑在没有 Supabase env 的环境（R7.7 降级路径）」——这个验证条件本身也在 2026-09-29 被 R16.235 的落地推翻了：本地 `supabase start` 栈 + `e2e/auth-flow.spec.ts` 把 OTP 登录 → 会话恢复 → 退出登录整条链路真跑通了，三处静态 import 已全部改为动态引入（读数见下方 2026-09-29 的复测表）。

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

### 复测（2026-09-29，R16.235 落地：无 env 干净构建 `npm run build` 后跑 `npm run check:bundle`）

R16.235 那笔债在这一轮还掉：`auth-provider.tsx` 与 `auth-header.tsx` 改为挂载后 / 点击时动态 `import("@/lib/supabase/client")`，`sync-layer.ts` 的 15 处调用点改走惰性 `resolveSupabaseBrowser()`（解析失败仍走原来的入队/降级分支）；env 判断拆进不依赖 supabase-js 的 `src/lib/supabase/env.ts`。落地前用本地 `supabase start` 栈 + 新增的 `e2e/auth-flow.spec.ts`（OTP 登录 → 会话恢复 → 退出登录）把登录链路端到端跑通——上面那段「没有办法端到端验证」的前提不再成立。`check:bundle` 按 AI chunk 同一形状加了 supabase chunk 隔离判据（`GoTrueClient` 指纹，非 auth 预算的全部路由（门禁现读）均不得引用），`knowledge-lesson.total` 从 404 收回 **348**。

| 分组 | 今天最大 total | 预算 | 最大路由 |
|---|---:|---:|---|
| home | 283.3 KB | 360 KB | `zh` |
| path | 284.1 KB | 365 KB | `zh/path` |
| knowledge-chapter | 268.3 KB | 370 KB | `zh/knowledge/markets-instruments` |
| knowledge-lesson | 338.8 KB | 348 KB | `zh/knowledge/technical-analysis/drawing-tools` |
| search | 251.3 KB | 335 KB | `zh/search` |
| review | 272.2 KB | 350 KB | `zh/review` |
| bookmarks | 246.4 KB | 335 KB | `zh/bookmarks` |
| stats | 305.7 KB | 370 KB | `zh/stats` |
| ai | 253.9 KB | 350 KB | `zh/ai` |
| chart | 303.9 KB | 390 KB | `zh/chart` |
| replay | 320.6 KB | 400 KB | `zh/replay` |
| privacy | 256.0 KB | 340 KB | `zh/privacy` |
| glossary | 252.6 KB | 340 KB | `zh/glossary` |
| static-info | 265.8 KB | 340 KB | `zh/changelog` |
| auth | 312.9 KB | 340 KB | `zh/auth` |

与 9-25 相比，非 auth 各组整体掉了约 46–66KB——那正是原来压在每条路由首屏的 supabase-js（59.3KB gzip 的 chunk，扣掉 auth 组仍需加载它的差异）；auth 组反而略涨（312.5 → 312.9），因为登录 SDK 现在只属于这四条路由。

**2026-10-02 再定价（348 → 357）**：R16.283/R16.284 两批 a11y 修复（R16.284 = 滚动代码块/趋势图键盘可达 + 任务清单复选框命名，见 roadmap）给全部课文页共享的 Markdown 组件新增了 `table`/`pre`/`li` 覆盖与任务清单 label 逻辑，本组最大从 339.0 涨到 CI 352.1（本地 349.9；同码两机差仍约 2.2KB，成因沿 R16.234 未查明）。357 = CI 当前最大 + 约两倍该差异，与 R16.234 同一公式；这是把真实的可及性成本计入预算，不是把尺子挪掉。

### 复测（2026-10-10，本地干净构建 `npm run build` 后由 `scripts/perf-notes-claims.test.mjs` 现读产物重算）

上面那张（2026-09-29）保留原样当历史。今天的读数（最大 total / 预算 / 最大路由）：

| 分组 | 今天最大 total | 预算 | 最大路由 |
|---|---:|---:|---|
| home | 281.5 KB | 360 KB | `zh` |
| path | 282.3 KB | 365 KB | `zh/path` |
| knowledge-chapter | 267.1 KB | 370 KB | `zh/knowledge/markets-instruments` |
| knowledge-lesson | 351.3 KB | 357 KB | `zh/knowledge/technical-analysis/drawing-tools` |
| search | 249.3 KB | 335 KB | `zh/search` |
| review | 284.2 KB | 350 KB | `zh/review` |
| bookmarks | 244.4 KB | 335 KB | `zh/bookmarks` |
| stats | 303.9 KB | 370 KB | `zh/stats` |
| ai | 251.9 KB | 350 KB | `zh/ai` |
| chart | 302.1 KB | 390 KB | `zh/chart` |
| replay | 318.6 KB | 400 KB | `zh/replay` |
| privacy | 254.0 KB | 340 KB | `zh/privacy` |
| glossary | 250.6 KB | 340 KB | `zh/glossary` |
| static-info | 247.1 KB | 340 KB | `zh/about` |
| auth | 311.0 KB | 340 KB | `zh/auth` |

与 9-29 相比：`knowledge-lesson` **+12.5KB**（338.8 → 351.3）、`review` **+12.1KB**（272.2 → 284.3），
`static-info` **−18.7KB**（265.8 → 247.1，见下面那条口径说明），其余各组 −1~2KB。三组变动都还没顶到预算
（lesson 351.3 / 357、review 284.3 / 350、static-info 247.1 / 340），所以 `check:bundle` 是绿的——
**预算没红不等于读数没烂**：这 15 个数字此前全靠手抄，抄进去之后没有任何一道门再看过它们。
本轮起由 `scripts/perf-notes-claims.test.mjs` 现读构建产物重算并与最新这张表逐行比对
（历史那两张不判：它们是当时的读数，拿今天的产物去要求它们等于要求历史撒谎）。
注意本地单测跑在 `ci.yml` 第 62 行、`build` 在第 64 行，所以 CI 那一趟**没有产物、这道判据会明说跳过**；
预算那一半由排在第 131 行的 `check:bundle` 在 build 之后管——两道工序不重叠。

**读数口径（R16.314）：量尺寸之前先剔除构建号**。Next 每次 `npm run build` 都重新生成一个
随机构建号（`.next/BUILD_ID`），并把它内联进每一条页面 HTML（RSC payload 里的 `"b":"…"`，
本轮实测产物里每一条 zh/en 页面 HTML 都含它）。同一份源码连构三次的实测：三个 BUILD_ID 互不相同，
15 个分组的 gzip **原始字节每次都变 ±1~4 字节**——预算门禁不在意（余量是 KB 量级），
但「读数逐字登记进文档、再用同一份产物重算比对」的判据会被它**随机打红**。
2026-10-11 就是这么红过一次（`knowledge-chapter` 表 267.2 / 实测 267.1），
而那种红不指向任何回归，与 R16.308 那条 `/changelog`（每提交必变）同形，只是这次的变量是**每构建**变的。
所以 `scripts/bundle-budget.mjs` 提供 `readBuildId()` / `neutralizeBuildId()`：把构建号换成**定长**占位符
（长度不变，不掺进「字符串变短」这种假收益），`check:bundle` 与上面这张表**同口径**量。
已实测：脱敏后同一份源码在任意两次构建里逐字节相同（三次构建的两两 diff 为空）。
代价是本表这 15 个读数比「真实产物」低 15~20 字节（0.0~0.1KB；2026-10-11 逐组实测），换来的是判据不再掷硬币；
`check:bundle` 的预算比对同样按脱敏后判定，两组数字互相可比。

**`static-info` 那一行的口径是「剔除 `/changelog`」**：那一页在构建期跑 `git log -15`
（`src/app/[locale]/changelog/page.tsx:45`），把最近 15 条提交的 hash / 日期 / subject
直接打进 HTML——`zh/changelog` 的 HTML 有 158KB，绝大部分是这份 raw commit log。
所以这一组的「最大值」每提交一笔就变：2026-10-10 今天两笔提交把它从 255.8KB 推到
255.9KB，而这道判据要求逐字相同，于是**每提交一笔必红一次**。那种红不指向任何回归，
只是 git 历史的字节数。表与判据因此同口径：都排除 `changelog`，`static-info` 的最大路由
取 `zh/about`（含 `changelog` 的全组读数是 255.9KB / `zh/changelog`，仍远在 340KB 之下，
`check:bundle` 的预算比对遍历全部路由，不受这一行口径影响）。

### 复测（2026-10-12，`next` 16.3.8 → 16.4.0 后本地干净构建，同样由 `scripts/perf-notes-claims.test.mjs` 现读产物重算）

上面那张（2026-10-10）保留原样当历史。今天的读数（最大 total / 预算 / 最大路由）：

| 分组 | 今天最大 total | 预算 | 最大路由 |
|---|---:|---:|---|
| home | 281.2 KB | 360 KB | `zh` |
| path | 282.0 KB | 365 KB | `zh/path` |
| knowledge-chapter | 267.2 KB | 370 KB | `zh/knowledge/markets-instruments` |
| knowledge-lesson | 350.1 KB | 357 KB | `zh/knowledge/technical-analysis/drawing-tools` |
| search | 249.6 KB | 335 KB | `zh/search` |
| review | 284.2 KB | 350 KB | `zh/review` |
| bookmarks | 244.8 KB | 335 KB | `zh/bookmarks` |
| stats | 303.3 KB | 370 KB | `zh/stats` |
| ai | 252.2 KB | 350 KB | `zh/ai` |
| chart | 302.3 KB | 390 KB | `zh/chart` |
| replay | 318.4 KB | 400 KB | `zh/replay` |
| privacy | 254.2 KB | 340 KB | `zh/privacy` |
| glossary | 250.9 KB | 340 KB | `zh/glossary` |
| static-info | 247.4 KB | 340 KB | `zh/about` |
| auth | 311.3 KB | 340 KB | `zh/auth` |

**这张表是依赖升级逼出来的，不是例行复测**：升 `next` 到 16.4.0 之后，`perf-notes-claims.test.mjs`
那条「实测列与当场重算一致」当场红了 14 组。为确认红的是产物而不是判据，先把 `next` 退回 16.3.8
重新干净构建——那一趟与上一张表**逐字相同**，说明上一张表当时没抄错；换回 16.4.0 后 15 组里 14 组各变
0.1~1.2KB（只有一组没动）。也就是：**框架内联进每条页面 HTML 的那一截随 minor 版本变了**，
而课文内容与路由实现一处未改。最大的一组仍是 `knowledge-lesson`，它离自己的预算余量最小，
所以这组数字变动最值得盯；本组预算未改，`check:bundle` 全绿。

### 复测（2026-10-13，R16.318 把秒→分钟的两份私有副本合成一份之后，本地干净构建现读重算）

上面那张（2026-10-12）保留原样当历史。今天的读数（最大 total / 预算 / 最大路由）：

| 分组 | 今天最大 total | 预算 | 最大路由 |
|---|---:|---:|---|
| home | 281.2 KB | 360 KB | `zh` |
| path | 282.0 KB | 365 KB | `zh/path` |
| knowledge-chapter | 267.2 KB | 370 KB | `zh/knowledge/markets-instruments` |
| knowledge-lesson | 350.1 KB | 357 KB | `zh/knowledge/technical-analysis/drawing-tools` |
| search | 249.6 KB | 335 KB | `zh/search` |
| review | 284.2 KB | 350 KB | `zh/review` |
| bookmarks | 244.8 KB | 335 KB | `zh/bookmarks` |
| stats | 303.3 KB | 370 KB | `zh/stats` |
| ai | 252.2 KB | 350 KB | `zh/ai` |
| chart | 302.3 KB | 390 KB | `zh/chart` |
| replay | 318.5 KB | 400 KB | `zh/replay` |
| privacy | 254.2 KB | 340 KB | `zh/privacy` |
| glossary | 250.9 KB | 340 KB | `zh/glossary` |
| static-info | 247.4 KB | 340 KB | `zh/about` |
| auth | 311.3 KB | 340 KB | `zh/auth` |

**15 组里只有 `replay` 动了（318.4 → 318.5），而且归因到本轮那一笔代码改动**：R16.318 删掉
`daily-goal.ts` 的私有副本、并让 `weekly-summary.ts` 静态依赖 `study-time.ts` 的 `studyMinutes`，
共享 chunk 的 gzip 净增十几个字节。归因不是推断：把那四个文件退回改动前重新干净构建，同一趟读回
318.4；换回改动后的树读回 318.5（`.gate-logs/replay-bytes-r72.mjs` 量到 `zh/replay` 的 total 是
326107 字节 = 318.4639KB）。

**这一行真正值得记下来的不是那 15 字节，而是它离舍入边界有多近**：318.4639KB 距 318.45 的进位边界只有
**14.2 字节**。也就是 `replay` 这一组的读数今天由十几个字节决定，任何一处无关的字节增减都可能把它推回
318.4。这是 R16.306（不给容差）与 R16.314（先剔掉随机构建号）之后**仍然存在的第三种脆弱**：判据要的
「同一份产物重算逐字相同」是可信的（两次干净构建的读数实测 diff 为空），但「表里的数与上一张表差 0.1」
并不自动意味着回归——得看字节。本轮按规矩重录整张表而不是给判据加容差；`check:bundle` 的预算比对
（这一组上限 400KB）与本轮改动都无争议地通过。

### 复测（2026-10-13，R16.320 把时长上限收进 `study-caps` 之后，本地干净构建现读重算）

上面那张（同日 R16.318）保留原样当历史。今天的读数（最大 total / 预算 / 最大路由）：

| 分组 | 今天最大 total | 预算 | 最大路由 |
|---|---:|---:|---|
| home | 281.3 KB | 360 KB | `zh` |
| path | 282.1 KB | 365 KB | `zh/path` |
| knowledge-chapter | 267.2 KB | 370 KB | `zh/knowledge/markets-instruments` |
| knowledge-lesson | 350.2 KB | 357 KB | `zh/knowledge/technical-analysis/drawing-tools` |
| search | 249.6 KB | 335 KB | `zh/search` |
| review | 284.2 KB | 350 KB | `zh/review` |
| bookmarks | 244.8 KB | 335 KB | `zh/bookmarks` |
| stats | 303.4 KB | 370 KB | `zh/stats` |
| ai | 252.2 KB | 350 KB | `zh/ai` |
| chart | 302.3 KB | 390 KB | `zh/chart` |
| replay | 318.5 KB | 400 KB | `zh/replay` |
| privacy | 254.2 KB | 340 KB | `zh/privacy` |
| glossary | 250.9 KB | 340 KB | `zh/glossary` |
| static-info | 247.4 KB | 340 KB | `zh/about` |
| auth | 311.3 KB | 340 KB | `zh/auth` |

**15 组里 6 组的字节数变了，其中 4 组跨过 0.1KB 舍入边界**。归因是干净的同环境 A/B（`git worktree`
各建一次，`.env.local` 补齐到同一份——见文末那条排查事实）：

| 分组 | 旧字节 → 新字节 | Δ | 显示值 | 离最近档界的余量 |
|---|---|---:|---|---|
| home | 287993 → 288015 | +22 | 281.2 → 281.3 | 15.0 B（下界：再小就少 0.1） |
| path | 288801 → 288823 | +22 | 282.0 → 282.1 | 3.8 B（下界：再小就少 0.1） |
| knowledge-lesson | 358534 → 358557 | +23 | 350.1 → 350.2 | 3.4 B（下界：再小就少 0.1） |
| stats | 310599 → 310648 | +49 | 303.3 → 303.4 | 17.6 B（下界：再小就少 0.1） |
| review | 291041 → 291066 | +25 | 284.2（未跨界） | 6.0 B（上界：再大就多 0.1） |
| replay | 326107 → 326139 | +32 | 318.5（未跨界） | 46.2 B（下界：再小就少 0.1） |

改动只有一笔：新增 `src/lib/study-caps.ts` 并把四处夹点改成 import 它，多出来的就是那个新模块进
共享 chunk 的字节。

**这一张表最值得记的不是那 22~49 字节，而是跨界之后离档界有多近**：刚跨过界的四组里，`path` 距
下界只剩 **3.8 字节**、`knowledge-lesson` **3.4 字节**；没跨界的 `review` 距上界只剩 **6.0 字节**。
上一轮说「`replay` 距进位边界 14.2 字节，任何一处无关的字节增减都可能把它推回去」——本轮实测：
那件事发生在别的组身上，而且方向相反（是**被推过界**，不是被推回去）。后果是这条逐字判据现在只要
有任何一处改动让产物小 4 个字节就会红，而**红出来的那个读数与上一张表逐字相同**——看起来像「表被
改回去了」，实际是产物在档界上抖。也就是说这张表越贴近档界，「重录整张表」这个动作越可能在同一天
里来回翻转。本轮不改判据（R16.306 已定「不给容差」），只如实登记这个不收敛：**档界余量小于一次
无关改动的典型字节抖动**时，重录只是把红推迟到下一笔提交。真正能收敛的方向是让判据比字节而不是比
舍入后的显示值（表里那列可以照旧显示 0.1KB 精度，判据读字节），那属于下一轮的决定，已登记 R16.321。

**排查用的事实（本轮踩到）**：跨 worktree 比读数必须把 `.env.local` 一起带过去。本仓库 `.env.local`
里的 `NEXT_PUBLIC_*`（Supabase URL / anon key、`NEXT_PUBLIC_AI_ENABLED`）会被内联进产物，缺了它
`ai` 组从 252.2 掉到 250.5（差约 1.7KB）——第一次 A/B 就是这么被污染的，看起来像代码差异，其实是
环境差异。补齐后两次干净构建的 15 组读数逐字相同（diff 为空），所以这不是构建不可复现。
