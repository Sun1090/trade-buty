# 变更日志（CHANGELOG）

<!-- 由 `npm run changelog:generate` 从 src/data/release-notes.json 生成，请勿手工编辑。 -->

> 站点内的「更新日志」页面（`/[locale]/changelog`）与本文件共用同一份数据（`src/data/release-notes.json`）。
> v0.3 及更早的里程碑记录在 [docs/roadmap.md](docs/roadmap.md)。

## [未发布] - 2026-09-13

### 中文

- 亮色主题对比度修复：课程正文、callout 与序号不再沿用暗色硬编码颜色，CI 新增 axe 亮色对比度回归
- 本地进度/错题/回放/测验快照在登录合并前统一做结构校验，损坏快照回退为空而不写回异常值
- CI 门禁稳定性：移动端溢出回归改为确定性执行，Playwright 浏览器安装前置到浏览器门禁之前
- 工具链升级到 TypeScript 6.0.3：`typescript-eslint` peer 允许区间内，CI 用同版本 npm 重新生成 lockfile，lint / typecheck / 1862 例测试 / 构建全绿
- 新增 `check:lockfile-repro` 门禁：用 `devEngines.packageManager` 钉住的 npm（10.x，对齐 CI 的 Node 22）重新生成 `package-lock.json` 并逐条目比对；npm 10/11 形状漂移会在 CI 早期以可读原因红灯，脚本始终从备份恢复 lockfile
- AI 变体题回归修复：`/api/ai/quiz` 曾按数字校验篇章号，错题本入口对所有真实用户固定返回 400；现改为校验篇章 slug，并补上能复现该 bug 的正向用例
- 匿名写库端点补齐配额：`/api/ai/feedback` 与 `/api/ai/citation-click` 此前可被无限灌库，现与错误上报同一套按 IP 限流（分别 20 / 30 次每分钟）

### English

- Fixed light-theme contrast: lesson body, callouts, and index numerals no longer reuse dark-theme hard-coded colors; a new axe light-theme contrast regression runs in CI
- Local progress, wrongbook, replay, and quiz snapshots are structurally validated before cloud merge, so corrupted snapshots fall back to empty instead of writing back invalid values
- Stabilized CI gates: the mobile overflow regression is now deterministic and Playwright browser installation precedes browser gates
- Toolchain bumped to TypeScript 6.0.3 within the `typescript-eslint` peer range; the lockfile is regenerated with the same npm major as CI, with lint, typecheck, 1862 tests, and build all green
- Added a `check:lockfile-repro` gate: it regenerates `package-lock.json` with the npm major pinned via `devEngines.packageManager` (10.x, matching CI's Node 22) and diffs it entry-by-entry; npm 10/11 lockfile drift now fails early in CI with a readable reason, and the script always restores the lockfile from backup
- Fixed an AI variant-quiz regression: `/api/ai/quiz` validated a numeric chapter id, so the wrongbook entry point returned 400 for every real user; it now validates the chapter slug, with a positive regression test
- Added quotas to anonymous write endpoints: `/api/ai/feedback` and `/api/ai/citation-click` could previously be flooded into the database without limit; both are now IP rate limited (20 / 30 per minute), sharing the error-reporting limiter

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
