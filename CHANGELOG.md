# 变更日志（CHANGELOG）

<!-- 由 `npm run changelog:generate` 从 src/data/release-notes.json 生成，请勿手工编辑。 -->

> 站点内的「更新日志」页面（`/[locale]/changelog`）与本文件共用同一份数据（`src/data/release-notes.json`）。
> v0.3 及更早的里程碑记录在 [docs/roadmap.md](docs/roadmap.md)。

## [0.7.2] - 2026-09-22

**账号隔离修复与内容红线覆盖收口 / Account isolation fix and content red-line coverage**

### 中文

- 修复账号切换后的数据隔离：登出或换号时，上一个账号迟到的云端进度响应仍会写进当前账号的本地存储，造成串档；现在每一轮写入前都校验会话是否仍是发起请求的那个账号，过期响应直接丢弃
- 补齐两处内容红线缺口：上游课文缺少合规风险提示块时，课文页自动展示本地化兜底提示；根级 `/share/*` 分享落地页（测验成绩、回放战绩、连续打卡三类）此前完全没有风险提示且没有任何测试看守，现在与全站页脚使用同一句文案，并由 E2E 逐路由钉住（中英共 16 条断言）
- 发布完整性：新增 `check:release-tag` 门禁，除最新发布版本外每条发布记录都必须存在同名 `vX.Y.Z` tag（`0.4.0`–`0.7.0` 属门禁上线前的遗留，显式豁免而非回填，避免把过期提交推成生产部署）；`v0.7.1` 是本仓库第一个 tag
- 工作保全审计进 CI：提交既没进入 `main` 也不在任何远端分支、或 PR 被关闭而工作去向从未确认时，流水线直接失败；CI 模式下读不到 GitHub 同样判失败，不允许门禁静默变绿
- 测试确定性：新增时钟卫生门禁，`expect(...)` 里直接读墙钟（结果取决于机器此刻是几点、跑多快）即判失败，真实定时器未受控的清单落为报告；存量 5 处命中已清零
- 质量基线：265 个测试文件 / 2483 个用例，语句覆盖率 95.47% → 96.24%、分支 90.35% → 91.10%（阈值 84/77 未下调）；14 个内容报告在内容未变时不再产生纯日期 diff，发布流程固化为受 `check:docs` 断言的 `docs/release-checklist.md`

### English

- Fixed account isolation after switching users: a late cloud progress response from the previous account could still be written into the current account's local storage after signing out or switching, mixing two accounts' data. Every write now verifies the session is still the one that started the request, and stale responses are discarded
- Closed two content-constitution gaps: lesson pages now render a localized fallback risk notice when an upstream lesson lacks a compliant block, and the root-level `/share/*` landing pages (quiz score, replay result, study streak) — which previously carried no risk notice at all and no test guarding it — now use the same sentence as the site footer, pinned route by route in E2E (16 assertions across both languages)
- Release integrity: a new `check:release-tag` gate requires every published release to carry its `vX.Y.Z` tag, except the newest one (0.4.0–0.7.0 predate the gate and are explicitly exempted rather than back-tagged, which could promote stale commits to a production deploy); `v0.7.1` is this repository's first tag
- The work-preservation audit now runs in CI: the pipeline fails when a commit exists in neither `main` nor any remote branch, or when a pull request was closed with the fate of its work unconfirmed. In CI mode an unreachable GitHub API also fails the gate, so it can never go quietly green
- Test determinism: a new clock-hygiene gate fails any assertion that reads the wall clock inside `expect(...)` — results that depend on what time it is or how fast the machine ran — while uncontrolled real timers are listed as a report. All five existing hits are gone
- Quality baseline: 265 test files / 2483 tests, statement coverage 95.47% → 96.24% and branch 90.35% → 91.10% with no thresholds lowered; 14 generated reports no longer produce a date-only diff when their content is unchanged, and the release procedure is now a checklist that `check:docs` asserts step by step

参考：[docs/v0.7.2-release-review.md](docs/v0.7.2-release-review.md) · [docs/release-checklist.md](docs/release-checklist.md) · [docs/test-clock-hygiene.md](docs/test-clock-hygiene.md)

## [0.7.1] - 2026-09-22

**游客登录态修复与发布完整性 / Guest session fix and release integrity**

### 中文

- 修复游客无法使用 AI 问答的回归：没有 Supabase 会话 cookie 时身份读取被误判为「未知身份」并抛错，登录态与历史接口返回 500、AI 问答返回 502；现在无会话按游客处理，其余认证失败仍然 fail-closed，不进入模型与数据库读写
- 修复 AI 对话在损坏的引用响应头下把 JSON 解析异常原文当作错误文案展示；URL 自动提问补齐章节上下文，检索阈值上限收敛
- 修复同步与本地数据边界：忽略非法的云端合并时间戳、Supabase 客户端初始化失败时写入入队、容忍被污染的最近搜索记录、非法分享元数据的语言回退与回放战绩精度上限
- 修复知识库正文中裸 `.` 相对链接被改写成坏路由；测验学习时长不再依赖真实墙钟，消除 CI 随机红灯
- 发布完整性：package.json 版本号绑定最新发布版本（此前长期停在 0.1.0）并新增 check:docs 漂移门禁；依赖与 lockfile 工具链钉定 npm 10.9.4
- 质量基线：258 个测试文件 / 2383 个用例，语句覆盖率 95.47%、分支 90.35%，474 个静态页面、93 项 E2E 与数据库 RLS/回滚门禁全部通过

### English

- Fixed a regression that broke AI Q&A for signed-out visitors: a request without a Supabase session cookie was read as an unknown identity and threw, so the session and history endpoints returned 500 and AI chat returned 502. A missing session is now treated as a guest, while every other auth failure still fails closed and never reaches the model or the database
- Fixed AI chat surfacing a raw JSON parser message as the user-facing error when citation headers were malformed; auto-ask from the URL now carries its chapter context, and retrieval thresholds are bounded
- Fixed sync and local-data edges: invalid cloud merge timestamps are ignored, writes queue when the Supabase client fails to initialise, corrupt recent searches are tolerated, and invalid share metadata and replay accuracy totals fall back correctly
- Fixed a bare `.` relative link in knowledge-base markdown resolving to a broken route; quiz study-time recording no longer depends on the real wall clock, removing a random CI failure
- Release integrity: package.json version is now bound to the latest published release (it had been stuck at 0.1.0) with a new check:docs drift gate, and the dependency and lockfile toolchain is pinned to npm 10.9.4
- Quality baseline: 258 test files / 2383 tests, statements 95.47% and branches 90.35% coverage, with 474 static pages, 93 E2E checks and the database RLS/rollback gates all green

参考：[docs/v0.7.1-release-review.md](docs/v0.7.1-release-review.md)

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
