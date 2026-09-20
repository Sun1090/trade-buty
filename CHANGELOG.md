# 变更日志（CHANGELOG）

<!-- 由 `npm run changelog:generate` 从 src/data/release-notes.json 生成，请勿手工编辑。 -->

> 站点内的「更新日志」页面（`/[locale]/changelog`）与本文件共用同一份数据（`src/data/release-notes.json`）。
> v0.3 及更早的里程碑记录在 [docs/roadmap.md](docs/roadmap.md)。

## [0.7.0] - 2026-09-20

**稳定性、覆盖率与发布可靠性 / Stability, coverage, and release reliability**

### 中文

- 修复 AI 对话复制失败/反馈静默、邮件订阅虚假复制成功、AI 变体题固定 400、本地快照损坏与回放状态异常等问题
- 新增统一剪贴板助手与匿名 AI 写入端点限流，并补齐课程、图表、分享、登录、错题与离线队列的回归覆盖
- 回放分享评级恢复正确比例、回放训练器补回首轮战绩并拒绝非法难度状态；亮色主题对比度获得 axe 回归保护
- 工具链升级至 TypeScript 6.0.3，新增 lockfile 可复现门禁；当前基线为 254 个测试文件 / 2203 个用例，474 个静态页面和 93 项 E2E 全部通过

### English

- Fixed silent AI-answer copy failures, fake newsletter copy success, the AI variant-quiz 400 regression, corrupted local snapshots, and invalid replay state
- Added a shared clipboard helper, rate limits for anonymous AI write endpoints, and regression coverage for courses, charts, sharing, login, wrongbook, and offline queue paths
- Restored correct replay-share grading, recovered the replay trainer’s first round, rejected invalid difficulty state, and added axe contrast regressions for light theme
- Upgraded to TypeScript 6.0.3 and added a reproducible-lockfile gate; the current baseline passes 254 test files / 2203 tests, 474 static pages, and 93 E2E tests

参考：[docs/v0.7-release-review.md](docs/v0.7-release-review.md)

## [0.6.0] - 2026-09-12

**内容覆盖、AI 质量与学习留存 / Content coverage, AI quality, and learning retention**

### 中文

- 知识库中英双语 27 章 / 182 篇镜像对齐，搜索索引、sitemap、术语与描述质量门禁全部进 CI
- AI 出题补齐策略与难度档、跨批去重、引用绑定、成本缓存与离线 fixture 质量集
- 课程内 AI 入口：课末提问、划词解释、追问链、导读缓存与统一开关
- 学习留存：学习总览、完成率与成绩趋势、错题复习、回放时长、连续学习温和恢复与周报
- 分享卡与 OG 降级、320px 移动端回归、PWA 离线、结构化数据与增长事件隐私审计

### English

- Aligned 27 chapters / 182 bilingual knowledge-base lessons, with search index, sitemap, terminology, and description quality gates in CI
- AI quiz generation gained strategy and difficulty tiers, cross-batch dedupe, citation binding, cost caching, and an offline fixture quality set
- In-lesson AI entry points: lesson-end ask, term explainer, follow-up chain, summary cache, and a single feature switch
- Learning retention: learning overview, completion and score trends, wrongbook review, replay duration, gentle streak recovery, and weekly reports
- Share cards with OG fallback, 320px mobile regression, PWA offline, structured data, and a growth-event privacy audit

参考：[docs/v0.6-release-review.md](docs/v0.6-release-review.md)

## [0.5.0] - 2026-09-06

**账号、隐私与留存 / Accounts, privacy, and retention**

### 中文

- 登录回跳与会话恢复，登录后本地/云端进度合并并给出合并摘要
- 离线写队列与重放、同步失败降级与可诊断状态
- 隐私数据导出与账号注销（服务端删除 + 本机数据清理）
- 登录态独立分包，游客首屏不加载账号相关代码

### English

- Sign-in redirect and session recovery, plus local/cloud progress merge with a merge summary
- Offline write queue with replay, and degraded sync states that stay diagnosable
- Privacy data export and account deletion (server-side removal plus local cleanup)
- Account code ships in its own chunk so guests never download it

参考：[docs/roadmap.md](docs/roadmap.md)

## [0.4.0] - 2026-09-05

**AI 陪学产品化 / AI study companion**

### 中文

- AI 问答：流式回答、加载与错误分级、配额提示、敏感话题护栏与引用点击统计
- 章节出题覆盖 27 章，支持难度档、变体题与错题本打通
- 间隔重复复习（SRS）、每日目标、连续学习与周报
- 分享卡、新手引导、结构化数据与 404 推荐位

### English

- AI Q&A: streaming answers, staged loading and error states, quota hints, sensitive-topic guardrails, and citation click tracking
- Chapter quiz generation across all 27 chapters, with difficulty tiers, variant questions, and wrongbook integration
- Spaced repetition review, daily goals, streaks, and weekly reports
- Share cards, onboarding, structured data, and 404 recommendations

参考：[docs/roadmap.md](docs/roadmap.md)
