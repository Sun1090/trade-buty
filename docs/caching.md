# 缓存策略（R7.11）

> 三层缓存：SSG（构建期预渲染的边缘 HTML；本仓库没有任何 `revalidate` 选项，也没有 ISR）→ 客户端 localStorage（学习数据）→ 内存缓存（AI 应答）。

## 1. 页面层（SSG / ISR / 动态）

| 路由 | 策略 | 说明 |
|---|---|---|
| `/[locale]/knowledge/**` | SSG（generateStaticParams） | 知识库内容随构建固化；kb 内容变更 → 重新部署即刷新 |
| `/[locale]`、`/path`、`/stats` 等内容页 | SSG | 学习数据全部客户端渲染（localStorage），HTML 里没有用户数据；这份 HTML **不被长期缓存**——现网返回的是 `public, max-age=0, must-revalidate`（Vercel 对预渲染路由的默认，本仓库没有为页面声明策略） |
| `/[locale]/ai` | SSG + robots noindex | 纯客户端交互页 |
| `/api/ai/chat` | Node.js runtime（Next.js 默认），响应带 `Cache-Control: no-cache` | 只有这一条路由显式设了这个头（流式 + 个性化限流）；其余 `/api/ai/**` 路由（quiz / summary / plan / feedback / feedback/export / citation-click / conversations）不声明 `Cache-Control` |
| sitemap.xml / robots.txt | 构建时生成 | sitemap 的 `lastmod` 用知识库提交时间（`src/lib/kb-freshness.ts` 的 `kbLastModified()`），拿不到才退回构建时间（R13.17） |

## 2. 客户端 localStorage（学习数据，单一事实源）

「单一事实源」说的是**这份存储是学习数据的真相**（云端只是双写与换机恢复），不是说下面这张表写全了：
`src/` 的非测试代码里真被当作持久化名字使用的 `tb-*` 键有 45 个（这个数由 `scripts/caching-claims.test.mjs`
现读，改一处漏记不会让它变少），下表只列用户能感知到保留差异的那几条。

| key | 内容 | TTL |
|---|---|---|
| `tb-progress` | 已读课程 map | 永久（云端双写合并） |
| `tb-wrong` | 错题本 + SRS 字段（R5） | 永久（云端双写） |
| `tb-study-time` | 每日学习时长台账（R4.2，`src/lib/study-time.ts`） | 保留 90 天，终点是**台账里最新有记录的那一天**（不是今天往前 90 天） |
| `tb-daily-goal-min` | 目标档位（R4.1） | 永久（登录后云端同步 R4.7） |
| `tb-replay-history` / `tb-replay-best` | 回放记录 / 最佳分（`src/lib/replay-store.ts`） | 历史只留最近 `REPLAY_HISTORY_KEEP = 100` 轮（`src/lib/replay-history-limit.ts`），最佳分是单调计数器；两者都在账号镜像里 |
| `tb-quiz-<章节 slug>` | 分章测验成绩 | 永久（云端双写） |
| `tb-quiz-difficulty:<locale>` / `tb-quiz-attempts` | 难度偏好（分语言）/ 答题账本 | **只在本机**——同前缀但被账号镜像显式排除（`src/lib/account-mirror.ts` 的 `PER_CHAPTER_QUIZ_EXCLUSIONS`，它同时认完整键名与 `前缀:` 两种形状），云端没有对应表 |
| `tb-summary-v2-*` | 章节 AI 导读（R3.5） | **7 天 TTL** |
| `tb-daily-goal-date` | 目标当日已设置标记 | 跨天自动失效 |

事件总线：写端在数据变化时往 `window` 派发一个 `tb-*` 名字，共 13 个——`tb-bookmarks`、`tb-cloud-sync`、
`tb-goal`、`tb-merge-summary`、`tb-progress`、`tb-reminder`、`tb-return-nudge`、`tb-stats-range`、
`tb-streak`、`tb-study-time`、`tb-sync-conflict`、`tb-theme`、`tb-weekly-goal`；两侧名字集合相同
（每个都被 `dispatchEvent` 一次、被 `addEventListener` 读到）。监听侧有两种写法，都是现行写法：
`useSyncExternalStore`（10 个组件文件用它）与 effect 里直接 `window.addEventListener`。
**这些名字与上面表里的存储键是两套**：只有 5 个（`tb-bookmarks`、`tb-progress`、`tb-streak`、
`tb-study-time`、`tb-theme`）恰好同名，其余各管各的——例如事件 `tb-goal` 对应的键是 `tb-daily-goal-min`，
而键 `tb-sync-conflicts` 对应的事件是 `tb-sync-conflict`（单数）。

## 3. 服务端内存缓存（Node.js 实例级）

| 缓存 | 内容 | TTL | 已知边界 |
|---|---|---|---|
| `answerCache`（chat 路由） | 相同问题的 AI 回答 | 10 分钟 | 每个 Node.js 实例独立 |
| `quizCache`（quiz 路由） | 同章+语言+难度的 AI 出题（R2.10） | 24 小时 | 每个 Node.js 实例独立；跨实例靠 R2.3 去重兜底 |
| `chatLimiter`（chat 路由，`createRateLimiter`） | 提问配额计数：游客每窗口 10 次、登录账号 50 次，键是 `user?.id ?? ip` | 窗口 1 小时，**锚在这个键的第一次请求**上，不是整点 | 每个 Node.js 实例独立，总量≈实例数×上限；它不是「游客专用」，登录用户同样在这里计数 |

## 云端合并规则（sync-layer）

登录后 `hydrateFromCloud` 拉云端与本地合并：进度/错题/成绩取**并集或较新时间戳**；
SRS 字段云端空值不覆盖本地计划（R5.7）；目标档位**本地意图优先**（R4.7）。

## 4. 内容更新后的缓存失效（R10.24）

**触发模型**：知识库内容更新经 `npm run kb:update`（同步 + 契约校验 + 资产/搜索索引刷新 + 一次生产构建）；发布只由 git push 触发（Vercel 全量重建，无定时内容刷新任务）。随 commit 进版本库的是 **submodule 指针与 `scripts/kb-manifest.json`** 两样（R10.18 门禁拦截不一致）；`public/search-index.json` 与 `public/knowledge-assets/` 被 gitignore 掉，由 `prebuild` 每次重新生成，**不提交**——所以「产物没进 commit」不是漏提，是这套管线的形状。

**产物分类与失效方式**：

| 产物 | URL 稳定性 | 失效方式 |
|---|---|---|
| `_next/static/*.js/css`（路由 chunk、RSC payload） | 内容 hash 文件名 | 内容变 → hash 变 → 新 URL；可 immutable 长缓存（Vercel 默认） |
| SSG HTML（`/[locale]/knowledge/**` 等） | 每次部署新产物 | 重新部署即换新 HTML；响应是 `max-age=0, must-revalidate`（平台默认，不是本仓库声明的 `revalidate`——那份配置不存在） |
| `public/search-index.json` | name-stable（内容派生） | `Cache-Control: public, max-age=0, must-revalidate`——每次请求回源验证，内容更新后新索引立即可见 |
| `public/knowledge-assets/**` | name-stable（知识库 md 按固定名引用） | 同上 revalidate；图片替换后无需手动清缓存 |

缓存策略在 `next.config.ts` 的 `CONTENT_CACHE_POLICIES` 显式声明（单测锁定，R10.24）——注意它**只管内容产物**。
**实测记录**：2026-09-06 首次记录、2026-09-25 复测生产 `trade-buty.vercel.app`，三类响应都是
`public, max-age=0, must-revalidate`：`/search-index.json` 与 `/knowledge-assets/**` 来自上面那份声明，
而知识页 HTML 与 `/zh` 这一类页面**本仓库没有为它们声明任何策略**，那个头是 Vercel 对预渲染路由的默认行为。
把两者记成同一件事，就会以为改 `next.config.ts` 能控住页面的缓存——它控不住。内容更新经重新部署即时生效，
无陈旧窗口。

**决策记录：暂不做图片内容 hash**。知识库 md 按固定相对路径引用 `_assets` 内文件；文件名加内容 hash 需在改写层维护原→hash 映射（manifest），复杂度高而收益有限（当前图片更新频率低，revalidate 足够）。若未来图片替换频繁或体积成瓶颈，再评估 hash 方案（需同步改 `sync-knowledge-assets.mjs` 与 `src/lib/content.ts` 改写层）。

**内容更新发布清单（缓存维度）**：

1. `npm run kb:update` 同步并刷新 `public/search-index.json` 与 `public/knowledge-assets/`；
2. 提交 submodule 指针与 `scripts/kb-manifest.json`（产物不提交，见上；CI 门禁：`check:kb-pointer` / `check:translation-history` / `check:kb-parity-budget`）；
3. push → CI build → Vercel 部署完成即新内容生效。

## 5. PWA 离线兜底（R13.13）

Service Worker 采用**最小缓存边界**：安装期只预缓存 `public/offline.html` 一个静态应用壳，不缓存页面 HTML、RSC payload、API、`search-index.json` 或 `knowledge-assets`。因此**文档级导航**（首次进入、地址栏输入、刷新、从站外链接点进来）断网时会显示明确的离线引导页，而不是可能过期的课程内容；应用内点链接走的是 RSC 请求，`sw.js` 只对 `request.mode === "navigate"` 兜底，所以那条路径由 `src/app/error.tsx` 承接，不是离线引导页。联网时所有内容请求仍直接走网络，与 §4 的即时更新契约一致。

| 资源 | 缓存策略 | 说明 |
|---|---|---|
| `/sw.js` | `Cache-Control: no-cache` | 每次检查脚本更新，避免旧 worker 拖住策略修复 |
| `/offline.html` | `public, max-age=0, must-revalidate` | 静态、双语、无外链；Service Worker 安装时以 `cache: "reload"` 预取 |
| `/` 及本地化页面 HTML | 不进入 Service Worker Cache | 仅由 `GET + mode=navigate` 请求触发；网络失败时才返回离线壳 |
| API / search-index / knowledge-assets | 不拦截、不缓存 | 保持内容、行情、AI 和数据新鲜度 |

离线页只说明本地学习数据仍保留、联网能力暂时不可用，并提供重试与自动恢复刷新。`public/offline.html` 的内容哈希固化在 `public/sw.js`；修改页面时必须同步 hash 和 `CACHE_VERSION`，单测会阻止漏改。
