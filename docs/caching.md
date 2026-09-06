# 缓存策略（R7.11）

> 三层缓存：SSG/ISR（边缘 HTML）→ 客户端 localStorage（学习数据）→ 内存缓存（AI 应答）。

## 1. 页面层（SSG / ISR / 动态）

| 路由 | 策略 | 说明 |
|---|---|---|
| `/[locale]/knowledge/**` | SSG（generateStaticParams） | 知识库内容随构建固化；kb 内容变更 → 重新部署即刷新 |
| `/[locale]`、`/path`、`/stats` 等内容页 | SSG | 学习数据全部客户端渲染（localStorage），HTML 可长期缓存 |
| `/[locale]/ai` | SSG + robots noindex | 纯客户端交互页 |
| `/api/ai/**` | edge runtime，`Cache-Control: no-cache` | AI 回答不可 CDN 缓存（流式 + 个性化限流） |
| sitemap.xml / robots.txt | 构建时生成 | lastModified = 构建时间 |

## 2. 客户端 localStorage（学习数据，单一事实源）

| key | 内容 | TTL |
|---|---|---|
| `tb-progress` | 已读课程 map | 永久（云端双写合并） |
| `tb-wrong` | 错题本 + SRS 字段（R5） | 永久（云端双写） |
| `tb-study-time` | 每日学习时长台账（R4.2） | 滚动保留 90 天 |
| `tb-daily-goal-min` | 目标档位（R4.1） | 永久（登录后云端同步 R4.7） |
| `tb-quiz-*` / `tb-replay-*` | 测验成绩 / 回放记录 | 永久（云端双写） |
| `tb-summary-v2-*` | 章节 AI 导读（R3.5） | **7 天 TTL** |
| `tb-daily-goal-date` | 目标当日已设置标记 | 跨天自动失效 |

事件总线：`tb-progress` / `tb-streak` / `tb-study-time` / `tb-goal`——写端派发，消费组件经 `useSyncExternalStore` 订阅。

## 3. 服务端内存缓存（edge 实例级）

| 缓存 | 内容 | TTL | 已知边界 |
|---|---|---|---|
| `answerCache`（chat 路由） | 相同问题的 AI 回答 | 10 分钟 | edge 每实例独立 |
| `quizCache`（quiz 路由） | 同章+语言+难度的 AI 出题（R2.10） | 24 小时 | edge 每实例独立；跨实例靠 R2.3 去重兜底 |
| `ipHits`（chat 路由） | 游客限流计数 | 1 小时滚动 | edge 每实例独立，总量≈实例数×上限 |

## 云端合并规则（sync-layer）

登录后 `hydrateFromCloud` 拉云端与本地合并：进度/错题/成绩取**并集或较新时间戳**；
SRS 字段云端空值不覆盖本地计划（R5.7）；目标档位**本地意图优先**（R4.7）。

## 4. 内容更新后的缓存失效（R10.24）

**触发模型**：知识库内容更新经 `npm run kb:update`（同步 + 契约校验 + 资产/搜索索引刷新）；发布只由 git push 触发（Vercel 全量重建，无定时内容刷新任务）。推送时 submodule 指针与 `scripts/kb-manifest.json` 等同步产物同一 commit（R10.18 门禁拦截不一致）。

**产物分类与失效方式**：

| 产物 | URL 稳定性 | 失效方式 |
|---|---|---|
| `_next/static/*.js/css`（路由 chunk、RSC payload） | 内容 hash 文件名 | 内容变 → hash 变 → 新 URL；可 immutable 长缓存（Vercel 默认） |
| SSG HTML（`/[locale]/knowledge/**` 等） | 每次部署新产物 | 重新部署即换新 HTML；revalidate 回源 |
| `public/search-index.json` | name-stable（内容派生） | `Cache-Control: public, max-age=0, must-revalidate`——每次请求回源验证，内容更新后新索引立即可见 |
| `public/knowledge-assets/**` | name-stable（知识库 md 按固定名引用） | 同上 revalidate；图片替换后无需手动清缓存 |

缓存策略在 `next.config.ts` 的 `CONTENT_CACHE_POLICIES` 显式声明（单测锁定，R10.24）。**实测基线**（2026-09-06，生产 `trade-buty.vercel.app`）：`/search-index.json`、`/knowledge-assets/**`、知识页 HTML 均返回 `public, max-age=0, must-revalidate`——内容更新经重新部署即时生效，无陈旧窗口。

**决策记录：暂不做图片内容 hash**。知识库 md 按固定相对路径引用 `_assets` 内文件；文件名加内容 hash 需在改写层维护原→hash 映射（manifest），复杂度高而收益有限（当前图片更新频率低，revalidate 足够）。若未来图片替换频繁或体积成瓶颈，再评估 hash 方案（需同步改 `sync-knowledge-assets.mjs` 与 `src/lib/content.ts` 改写层）。

**内容更新发布清单（缓存维度）**：

1. `npm run kb:update` 同步并刷新 `public/search-index.json` 与 `public/knowledge-assets/`；
2. 提交 submodule 指针 + `scripts/kb-manifest.json` + 同步产物（CI 门禁：`check:kb-pointer` / `check:translation-history` / `check:kb-parity-budget`）；
3. push → CI build → Vercel 部署完成即新内容生效。
