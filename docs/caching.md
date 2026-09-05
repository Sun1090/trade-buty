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
