# 变更日志（CHANGELOG）

<!-- 由 `npm run changelog:generate` 从 src/data/release-notes.json 生成，请勿手工编辑。 -->

> 站点内的「更新日志」页面（`/[locale]/changelog`）与本文件共用同一份数据（`src/data/release-notes.json`）。
> v0.3 及更早的里程碑记录在 [docs/roadmap.md](docs/roadmap.md)。

## [未发布] - 2026-09-13

### 中文

- 亮色主题对比度修复：课程正文、callout 与序号不再沿用暗色硬编码颜色，CI 新增 axe 亮色对比度回归
- 本地进度/错题/回放/测验快照在登录合并前统一做结构校验，损坏快照回退为空而不写回异常值
- CI 门禁稳定性：移动端溢出回归改为确定性执行，Playwright 浏览器安装前置到浏览器门禁之前

### English

- Fixed light-theme contrast: lesson body, callouts, and index numerals no longer reuse dark-theme hard-coded colors; a new axe light-theme contrast regression runs in CI
- Local progress, wrongbook, replay, and quiz snapshots are structurally validated before cloud merge, so corrupted snapshots fall back to empty instead of writing back invalid values
- Stabilized CI gates: the mobile overflow regression is now deterministic and Playwright browser installation precedes browser gates

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
