# Roadmap v0.3「运营与硬化」（36 项 · 已发布）

> 前版本状态（已核验）：P0 骨架、P1 边学边练、双语 UI、回放训练、测验/错题本地版、
> 云端同步（sync-layer + RLS + auth 全链路已在树内）、AI 功能（/api/ai）、PWA manifest、
> sitemap/robots、阅读工具链 —— 235 单测全绿。
>
> v0.3 不做大功能，只做三件事：内容运营自动化、质量门禁、增长收尾。
> 每项标注验证方式；`[手动]` 需账号或人工操作。

## Q1 内容运营自动化（Q1.1–Q1.8）

- [x] Q1.1 `kb:update` 一条龙（拉取 + 契约校验 + 索引/资产同步 + 构建回归）
- [x] Q1.2 en 中英 parity 跟踪脚本（`npm run kb:parity`，--strict 可做门禁；当前 27/27 全齐）
- [x] Q1.3 死链检查脚本（`npm run check:links` 扫全量构建产物，CI 阻断；en 锚点告警记入产物并作为上游翻译遗留跟踪）
- [x] Q1.4 搜索索引对账（`npm run check:search-index` 与知识库逐条双向对账，CI 阻断）
- [x] Q1.5 frontmatter 质量门禁：CI 阻断 `npm run check:frontmatter`（title/description 齐全且描述 ≥15 字符）；prebuild 的 `validate-knowledge-contract` 仅告警，不混淆两者
- [x] Q1.6 KB 更新演练月度化：2026-09-12 已同步 `kline-buty@a57d510`，双语各 182 篇；变更记录见 `docs/kb-changelog-draft.md` / `docs/kb-changelog-2026-09-12.md`；hash 基线由 CI `check:kb-changelog` 阻断，翻译历史由 `check:translation-history` 核对
- [x] Q1.7 新章节上线清单（dry-run 输出索引/sitemap/测验挂载点/路径分组四项核对；流程见 docs/new-chapter-release-checklist.md，单测覆盖）
- [x] Q1.8 kline-buty 侧 en 翻译收官（27 章全齐，已上线）

## Q2 质量门禁（Q2.1–Q2.8）

- [x] Q2.1 i18n 深层 parity 测试（全字典递归比对，CI 常驻）
- [x] Q2.2 Bundle 体积预算（`npm run check:bundle`，内容页 280KB/chart 360KB，CI 阻断；基线 217KB 为框架固定成本）
- [x] Q2.3 Lighthouse CI（三页门禁：accessibility=100 error，并单独阻断 `color-contrast` / `link-name` / `label-content-name-mismatch`；best-practices/SEO≥90 error，性能≥70 warn。2026-09-13 实测 6/6 断言通过）
- [x] Q2.4 a11y 抽查：键盘全程可操作（测验答题、回放控制、灯箱 Enter/Space/ESC）、全局 `:focus-visible` 焦点环、表单可访问名称；单测 + Playwright 回归见 `docs/accessibility-audit.md`
- [x] Q2.5 320px 回归（`npm run check:mobile`，14 关键页，CI 在生产构建后执行并阻断；修掉 path/knowledge-graph 两处 grid truncate 溢出）
- [x] Q2.6 错误边界覆盖率：图表/搜索/AI 三个外部依赖入口都有降级 UI（搜索索引加载失败/重试单测补齐）
- [ ] Q2.7 [手动] Sentry（或同类）错误监控接入 + 告警通道 — `BLOCKED_EXTERNAL`：需 Sentry 账号、生产 DSN 与告警通道（邮件/Slack）凭据，无凭据无法接入或验证告警送达。
- [ ] Q2.8 [手动] RLS/越权/双设备同步线上联调（需 Supabase keys）— 本地半边已完成：`npm run db:test` 在真实 `supabase/postgres:17.6.1.155` 镜像上应用 10 个迁移，跑通 RLS 越权 40 断言 + 双设备同步/约束 30 断言 + `0008_*` 回滚 → 重放演练（见 docs/database-testing.md）；`BLOCKED_EXTERNAL`：Supabase 云项目 keys、线上数据与真实两台设备联调无法在本地完成。

## Q3 增长收尾（Q3.1–Q3.6）

- [ ] Q3.1 [手动] Google Search Console 提交 sitemap + 请求编入索引 — `BLOCKED_EXTERNAL`：需站点域名已在生产解析且维护者持有 GSC 账号。
- [ ] Q3.2 [手动] Bing Webmaster（可从 GSC 导入）— `BLOCKED_EXTERNAL`：需 Bing Webmaster 账号，依赖 Q3.1 先完成。
- [ ] Q3.3 [手动] Vercel Analytics 开启（免费档）— `BLOCKED_EXTERNAL`：需 Vercel 项目写权限；接入后需重新部署才能采数。
- [ ] Q3.4 [手动] PostHog 事件埋点评审（P4 按流量决定是否接入）— `BLOCKED_EXTERNAL`：需真实流量数据与 PostHog 账号，属 P4 决策项。
- [ ] Q3.5 分享链路走查：OG 卡片在微信/X/Telegram 的实际渲染抽查 — 本地半边已覆盖：`src/app/share/[kind]/[path]/opengraph-image.test.tsx` 断言 1200×630 / `image/png` 与无效载荷降级，`e2e/smoke.spec.ts`（R13.17）覆盖 canonical/noindex；`BLOCKED_EXTERNAL`：真实客户端抓取渲染需人工在微信/X/Telegram 抽查。
- [ ] Q3.6 [手动] 冷启动内容分发（知乎/B站/雪球，见 docs/growth-checklist.md）— `BLOCKED_EXTERNAL`：需维护者账号与人工发布。

## Q4 体验 backlog（按需认领，非阻塞）

> 编号说明：`Q4.2` 在本仓库任何文档与代码中都没有引用，属历史跳号；不重排编号，
> 以免 `Q4.3`–`Q4.6` 在进度记录里的既有引用失效。

- [x] Q4.1 回放自定义窗口（盲盒/自定义切换 + 截止日期选择，币种周期复用）
- [x] Q4.3 搜索建议词（标题优先 Top 6 联想 + 方向键/回车/ESC，键盘可达）
- [x] Q4.4 课程页「预计阅读时长」多语言文案复核（正文中英混合估算；zh「约 N 分钟阅读」/ en「~N min read」）
- [x] Q4.5 三主题对比度复核（muted/faint/accent 全面 AA，全站截图回归无破损）
- [x] Q4.6 TOC 移动端抽屉（原生 details 折叠，xl 以下显示）

## Q5 工程卫生（Q5.1–Q5.4）

- [x] Q5.1 docs 与实现一致性走查（plan/research/p2-research 已区分历史选型与当前实现；新增 `check:docs` 校验课程数、当前技术栈与中立承诺）
- [x] Q5.2 AGENTS.md 契约段复核（删除旧 `NN-*`/数字文件名描述，统一为 `{zh,en}/English-slug`；`check:docs` 防回归）
- [x] Q5.3 依赖月度审计（2026-09-13：`audit:prod` / `audit:all` 均 `found 0 vulnerabilities`；`npm outdated` 只剩 `@types/node`、`eslint`、`js-yaml`、`typescript`、`vitest` 五个 major 待评估，逐条暂缓理由见 `docs/deps.md` §月度审计日志。历史：2026-09-12 曾记录 React/Supabase/Playwright/Testing Library 等补丁或 minor）
- [ ] Q5.4 [手动] 备份演练：Supabase 数据导出 + 仓库镜像确认 — 本地半边已完成：`npm run backup:drill` 全自动跑「迁移 → 全业务表（11 张）灌数据 → `pg_dump -Fc`(45,104 bytes，随语料增长) → 销毁源库 → 全新实例 `pg_restore` → 数据/schema/RLS/约束指纹比对 → 重跑 pgTAP(40+30+8 断言)」，脚本与边界见 docs/database-testing.md 第 4 节；`BLOCKED_EXTERNAL`：Supabase 云导出（auth/Storage/项目配置）、定时备份与仓库镜像确认需云控制台权限。

## 版本关账标准

1. Q1–Q2 全绿（含新增 CI 门禁三次连续通过）
2. Q3 手动项由维护者确认完成或明确延期
3. 线上抽查：首页/课程/图表/回放/搜索 5 条核心路径 200

---

# Roadmap v0.4「AI 陪学产品化」（100 项开发任务）

> 基线（已核验）：`/ai` 问答页、AiChat、AiQuiz（review 内）、RAG（pgvector + embeddings）、
> prompt/chunk 模块、DailyGoal、streak/连续、chapter-summary-ai、conversations/feedback API。
> v0.4 把 AI 从“能用”做到“可信、好用、可运营”。测试用例另行补充，不占本表名额。

## R1 AI 问答质量与可信度（R1.1–R1.15）

- [x] R1.1 prompt 版本化（PROMPT_VERSION + 注册表 + 变更日志，SYSTEM_PROMPT 保留兼容别名）
- [x] R1.2 引用展示课程标题（sources 富化 helper + 3 单测，缺失回退 slug）
- [x] R1.3 无检索兜底（放宽二次检索取章节推荐 + 坦诚话术指引 + X-Suggested pills，前端无 sources 时展示；另修 edge 构建：kb-titles 静态映射替代 fs 直读）
- [x] R1.4 检索配置中心（topK/阈值/兜底条数按场景收敛 + AI_RETRIEVAL_JSON 覆盖 + 防呆回退，4 单测）
- [x] R1.5 超长截断与继续生成（finish_reason 捕获 + TRUNCATED 标记 + 同消息续写 + 不写缓存；另修 X-Sources 中文 header 502 真 bug）
- [x] R1.6 对话历史摘要（>14 条时压缩早期轮次为摘要拼入 system，失败降级截断）
- [x] R1.7 反馈导出抽查（ADMIN_TOKEN 鉴权的导出路由 + rating/limit/since 筛选 + 5 单测；401 已验证）
- [x] R1.8 敏感话题护栏（输入侧中英关键词拦截 + 固定拒绝话术不调模型 + 输出侧疑似荐股日志观测；prompt 升 v1.2.0）
- [x] R1.9 空状态与首屏示例问题（双语各 3 条可点击示例；补示例区标题、Fisher-Yates 无偏抽样、4 条组件单测 + 5 条抽样单测）
- [x] R1.10 加载态优化（首 token 前骨架屏 + 思考文案；流式逐字填充；非流式回退一次性读全文；2 单测）
- [x] R1.11 错误态分级（429 限流 / 5xx 服务不可用 / 30s 连接超时 / 网络失败各给文案；重试按钮保留；3 单测）
- [x] R1.12 问答配额提示（服务端 X-Quota-* 头仅游客下发 + 429 补 Retry-After 头；前端展示剩余次数，用尽显示登录引导；2 单测）
- [x] R1.13 回答内课程链接点击统计（ai_citation_clicks 表 0004 迁移 + /api/ai/citation-click 匿名上报 + 来源/章节 pill 点击埋点；5 校验单测 + 1 组件单测）
- [x] R1.14 主题样式复核（引用块三主题本就走 --accent 变量；修复 sepia 缺 pre 覆写导致的突兀深色代码块、浅色/sepia 行内 code 背景不可见）
- [x] R1.15 移动端键盘遮挡（dvh 已有；补 visualViewport resize 监听 + 聚焦后 300ms 补滚动 scrollIntoView；1 单测）

## R2 AI 出题与测验生成（R2.1–R2.12）

- [x] R2.1 章节出题覆盖全部 27 章（quiz 路由新增 chapter 模式：kb-titles 章名 + RAG 章节过滤上下文出 5 题；无固定题的 25 章课末显示 AiChapterQuizCard；quiz-gen.ts 校验/去重纯函数 + prompt/组件 17 单测）
- [x] R2.2 难度档（入门/进阶）影响出题深度与选项迷惑度（`quiz-strategy` 注入 temperature/token/相关性阈值与难度规则，UI 选择按 locale 持久化并随请求发送；策略/prompt/组件 38 项定向测试通过）
- [x] R2.3 生成题去重（bigram Jaccard 与固定题库及同批新题互去重，阈值 0.6，3 单测）
- [x] R2.4 解析质量写入章节出题 prompt（须引用章节概念、禁止空话、无依据不编造）
- [x] R2.5 出题失败降级（服务端 AI 失败回退本章固定题带 fallback 标识；前端错误文案兜底不白屏；2 单测）
- [x] R2.6 AI 变体题与错题本打通（答错刷新来源错题条目、答对移出；4 组件单测含错题本读写）
- [x] R2.7 AI 题标注来源（🤖 AI 生成徽标 + fallback 标识 + 卡片底部免责一行；5 组件单测）
- [x] R2.8 review 页 AI 题幂等（作答一次锁定、recordWrong 同 key 覆盖不重复、举报去重；单测覆盖）
- [x] R2.9 出题语言跟随 locale（buildChapterQuizPrompt 双语指令，en 出英文题；2 单测）
- [x] R2.10 成本控制（maxTokens 3000 + 同章/语言/难度 24h 内存缓存；edge 实例级，跨实例去重靠 R2.3）
- [x] R2.11 题目举报入口（review 变体题与章节 AI 题均有一键举报 → /api/ai/feedback unhelpful，单次去重）
- [x] R2.12 覆盖率看板（27/27 可 AI 出题、固定题 27/27 共 81 道、en 元数据 27/27；npm run check:quiz-coverage）

## R3 课程内 AI 入口（R3.1–R3.12）

- [x] R3.1 课末「问 AI」按钮升级（LessonAskAi 组件：预填问题 + ctx/ct 上下文参数 + 点击埋点 + 开关控制；3 单测）
- [x] R3.2 导读覆盖检查（scripts/summary-coverage.mjs：zh 27/27、en 27/27；npm run summary:coverage）
- [x] R3.3 划词解释（TermExplainer：选中正文 2–30 字术语弹浮层，复用 /api/ai/chat RAG 管线 + contextChapter 限定本章；shouldExplain 纯函数 + 5 单测）
- [x] R3.4 追问链（回答底部按引用/推荐标题生成 3 个关联问题 chips，点击即发；单测覆盖）
- [x] R3.5 导读缓存 7 天 TTL（localStorage {text,at} 结构 + 过期重出按钮；2 单测）
- [x] R3.6 导读失败降级（失败整个卡片隐藏，不展示错误文案；单测覆盖）
- [x] R3.7 课程上下文链路（/ai?ctx&ct 横幅 + chat API contextChapter 注入 system 优先本章内容；单测覆盖横幅）
- [x] R3.8 摆位（问 AI 保持测验/练习双栏之后全宽一行，不与 CTA 争位；沿用既有顺序）
- [x] R3.9 统一开关（ai-toggle：hasAiServerEnv 读 AI_API_KEY，服务端页 aiEnabledForPage 判断，/ai 禁用态 + 各卡片 aiEnabled prop；单测覆盖）
- [x] R3.10 总开关（NEXT_PUBLIC_AI_ENABLED=false 一键隐藏所有入口；单测覆盖）
- [x] R3.11 点击埋点（src/lib/analytics.ts console 通道先行：lesson-ask-ai / ai-quiz-start / chapter-summary；单测覆盖）
- [x] R3.12 双语复核（修复 ai-quiz/review 变体题硬编码中文；scripts/check-ai-copy.mjs 扫 en 字典 CJK 残留并入 CI 门禁；当前 0 残留）

## R4 每日目标与连续性（R4.1–R4.12）

- [x] R4.1 分钟三档目标（tb-daily-goal-min：5/15/30、默认 15；DailyGoal 档位切换按钮；3 单测）
- [x] R4.2 学习时长台账（study-time.ts 按日期×来源记录；去重口径 total=max(read,quiz+replay) 防同页双计；阅读 5s tick / 测验会话耗时 / 回放每轮耗时三源接通；7 单测）
- [x] R4.3 断签挽回提示（getStreakBreak：事实说明 + 历史最长展示，不伪造连续天数；单测覆盖）
- [x] R4.4 完成庆祝（🎉 脉冲徽标 + 进度条变色，纯 Tailwind CSS 无动画库）
- [x] R4.5 统计页空态引导（全 0 时展示 🚀 行动卡 + 学习路线 CTA，替代一片零数据）
- [x] R4.6 周报视图（WeeklyReport：getStudySeries(7) 柱状，纯 CSS 柱 + useSyncExternalStore 值稳定快照；3 单测含口径对账）
- [x] R4.7 目标云端同步（0005 user_settings 迁移 + syncGoalUpsert 随写随推 + hydrateFromCloud 登录拉取、本地意图优先）
- [x] R4.8 时区宽限（date-utils 统一日期口径 + streak lastTs 36h 宽限窗：跨时区/夏令时跳天不误判断签；date-utils 3 + streak 4 单测）
- [x] R4.9 最低门槛文档化（阅读计时 5s tick、打开课程页停留 ≥5s 计入当日；口径写入 study-time.ts/daily-goal.ts 模块注释与 roadmap）
- [x] R4.10 口径对账（readSummary 抽为唯一实现，统计页与学习路线页共用；总时长切换账去重口径 totalStudySeconds；单测对账 Σ各日 max=read,quiz+replay）
- [x] R4.11 移动端布局（周报 flex 均分 + min-w-0 + 相对高度柱，320px 不溢出）
- [x] R4.12 无障碍（周报 role=img + aria-label 同步摘要文字 + 图下文字摘要；DailyGoal 进度条 progressbar aria 值）

## R5 间隔重复复习 SRS（R5.1–R5.12）

- [x] R5.1 艾宾浩斯间隔表（srs.ts EBBINGHAUS_INTERVALS=1/3/7/14/30 天）
- [x] R5.2 下次复习日期计算（srsOnAnswer：答错明天再见、答对按间隔表推进、走完掌握；12 单测）
- [x] R5.3 今日到期置顶（到期/过期排前、其余按到期日升序；集成测试验证 DOM 顺序）
- [x] R5.4 温和过期提醒（「过期 N 天——今天补上就好」，旧数据不标红；代码内引用一致为 R5.4）
- [x] R5.5 状态机（new→stage0→…→mastered 状态图写入 srs.ts 注释；wrongbook.applySrsResult 落地，ai-quiz/review 接入）
- [x] R5.6 旧数据回填（无 srsDue 的条目按 at+1 天推算，effectiveSrs 统一入口；单测覆盖）
- [x] R5.7 云端同步（迁移 0006 wrongbook+srs_stage/srs_due；syncWrongbookWrite 带字段、hydrate 合并不覆盖本地计划）
- [x] R5.8 复习计入每日目标（每题 addStudyTime("quiz",60)，与台账 quiz 源合并去重）
- [x] R5.9 SRS 开关（tb-srs-mode，关闭=入库倒序纯列表、隐藏到期徽章；单测覆盖）
- [x] R5.10 孤儿清理（pruneOrphanWrong 在 review 渲染时执行并同步删云端；单测覆盖）
- [x] R5.11 单手操作（掌握了/还没掌握双大按钮 px-6 py-3、间距加开）
- [x] R5.12 空日鼓励（「🌙 今天没有到期的复习——下一轮时间已排好」；单测覆盖）

## R6 内容运营自动化（R6.1–R6.13）

- [x] R6.1 kb:update 产物 diff 摘要（`scripts/kb-diff.mjs` 输出文件新增/删除/内容修改，并写入带 hash 和上游指针的 manifest）
- [x] R6.2 新课程自动进 sitemap 回归断言（双向对账阻断 missing/stale；新增/删除课程用例见 `scripts/sitemap-lib.test.mjs`）
- [x] R6.3 测验挂载点自动校验（AST 解析 27 个挂载，chapter/doc 存在且每题 ≥3 道；重复键阻断；CI 阻断）
- [x] R6.4 题库覆盖率脚本（27/27 章，共 81 道；按真实 questions 数组计数并阻断缺口）
- [x] R6.5 frontmatter 描述长度检查（`npm run check:frontmatter`：缺 title/description 或 description <15 字符均退出 1，CI 阻断）
- [x] R6.6 图片 alt 缺失检查（remark 全量扫描；同时阻断空 alt、引用缺失、孤儿资产与 zh/en 镜像漂移）
- [x] R6.7 中英标题对照表生成（`npm run kb:translation-status` 产出 `docs/translation-status.md` 与历史快照，CI 校验快照新鲜度）
- [x] R6.8 术语交叉覆盖（check:glossary：20 术语/孤儿 0 个 → docs/glossary-coverage.md）
- [x] R6.9 FAQ 候选（ops:faq-candidates：近 30 天 unhelpful 聚类 → docs/faq-candidates.md；无 key 友好跳过）
- [x] R6.10 changelog 自动片段（`check-kb-changelog` + `content-changelog-lib` 识别新增/内容更新/移除并按章节渲染；5 项回归测试通过）
- [x] R6.11 内容宪法扫描（默认报告式巡检并豁免明确教育语境，`--strict` 可升级阻断；当前零未豁免命中）
- [x] R6.12 外链巡检（ops:link-patrol：HEAD 降级 GET + 超时重试；.github/workflows/link-patrol.yml 每月定时 + 手动触发）
- [x] R6.13 运营手册（docs/ops.md：门禁/流水线/运营工具/迁移清单全覆盖）

## R7 性能与质量门禁（R7.1–R7.12）

- [x] R7.1 预算细分（check:bundle 新增 zh/ai 310KB 预算 + AI chunk 隔离断言；Markdown 渲染链按需加载使 AI 页 347→254KB）
- [x] R7.2 懒加载审计（markdown img renderer 已带 loading=lazy，补测试锁定）
- [x] R7.3 低端机降级（perf.ts rAF 采样 1.5s，<24fps 只保留最近 150 根 K 线；3 单测）
- [x] R7.4 虚拟化评审（docs/perf-notes.md：数据规模天然有界 ≤81 条，暂不引入；设重评触发条件）
- [x] R7.5 上游超时重试（http.ts：30s AbortController + 429/5xx 重试 1 次；chat/streamChat/embed 全部接入；6 单测）
- [x] R7.6 前端错误上报分级（fatal / recoverable / silent 三档；`reportRouteError` 已接入路由级 `error.tsx`，单测覆盖三档、digest 元数据、非 Error 输入与上报自身失败。自定义根级 `global-error` 经实测会给全部 454 条路由各加 13.4KB gzip JS 并击穿 R13.15 预算，故保留 Next 内置兜底页。**统一上报端点**已接入：`POST /api/error-reports` 同源接收匿名诊断，只接受 `level/scope/kind/digest` 白名单字段、拒绝未知字段与超长 body、按 IP 限流，仅写 sanitized 服务器日志且不落库；客户端 `sendBeacon` 优先、失败回退 `keepalive` fetch，silent 档不上报。详见 `docs/error-reporting.md`）
- [x] R7.7 E2E 冒烟（Playwright 7 用例：首页/路线/测验闭环/复习/回放/AI 页/软 404，进 CI；无 Supabase env 时降级本地模式）
- [x] R7.8 视觉基线（5 页 toHaveScreenshot 基线入库，npm run e2e:visual 人工复核流程；不进 CI 因字体平台差异）
- [x] R7.9 依赖评审（docs/deps.md：14 个运行时依赖逐个理由 + 明确不引入清单 + 审查流程）
- [x] R7.10 构建时间监控（CI 计时步骤，>4 分钟 warning 注解）
- [x] R7.11 缓存文档（docs/caching.md：页面层/localStorage/edge 内存三层 + 云端合并规则）
- [x] R7.12 安全头（next.config：CSP（Supabase connect/wss 白名单）/nosniff/DENY/HSTS（`max-age=63072000; includeSubDomains`，含 max-age 下限单测）/Referrer-Policy/Permissions-Policy；e2e 对 `next start` 真实响应断言全套安全头与内容重验证缓存）

## R8 增长与分享（R8.1–R8.12）

- [x] R8.1 成绩分享卡（测验 S/A 评级生成 OG 图，纯前端 canvas）
- [x] R8.2 回放战绩分享卡（连胜/正确率卡片）
- [x] R8.3 连续学习分享卡（streak 天数卡）
- [x] R8.4 分享落地页（/share/[kind]/[path]：SSR + OG meta + JSON-LD；CopyLinkButton；32 单测）
- [x] R8.5 邀请参数透传（?ref= 落地写 localStorage TTL 30 天，InviteBanner 可关闭，19 单测）
- [x] R8.6 新手引导 tour（首次访问三步 dialog：path/replay/review，可跳过/重看，19 单测）
- [x] R8.7 空态 CTA 复核（bookmarks/activity-heatmap 补 CTA 按钮 → /path，3 单测）
- [x] R8.8 邮件订阅占位（NewsletterSignup：localStorage + 复制 JSON 导出 + 显式标注"占位"，16 单测）
- [x] R8.9 社交元标签全页复核（twitter:title/description 无缺失）
- [x] R8.10 结构化数据扩展（Course + Quiz 的 JSON-LD）
- [x] R8.11 404 页推荐位（按 URL 猜测最接近课程，编辑距离实现）
- [x] R8.12 关于页文案复核（中立承诺段：不接受广告/卖课/导流/捐赠；明确"保持免费"理由；附 NewsletterSignup）

## v0.4 关账标准

1. R1–R5 功能项完成且 Playwright 冒烟通过
2. R6–R7 门禁类全部进 CI 并连续三次通过
3. R8 至少完成分享卡 + 新手引导 + 结构化数据
4. 测试用例单独补充（不占本表名额），覆盖率不下降

## v0.4 收官（2026-09-05）

**全 R 100/100 完成**（R1–R8 共 76 项功能 + 24 项门禁/文档/优化）。CI 在 v0.4 收官期内连续 5 次全绿：
33961184657 / 33961951901 / 33962439305 / 33962710019 / 33962914876。

**v0.4 测试规模**：81 文件 / 549 用例 / typecheck 0 错 / lint 0 error / E2E 7/7 / check:bundle 全预算通过 + AI chunk 隔离断言。

**v0.4 主要决策（与 AGENTS.md 边界）**：
- 内容中立：about 页新增独立承诺段（不接广告/卖课/导流/捐赠），保持免费
- 增长收尾：分享卡 + 落地页 + 邀请参数 + 新手引导 + 空态 CTA 全部到位
- 邮件订阅：纯前端占位（无后端），明标"邮箱仅本机保存"

**v0.5 待输入方向**：登录体验与保留 / 内容扩产 en 补齐 / AI 出题质量迭代 / 移动端体验深化 / SEO 与增长复盘（任选其一）

---

# Roadmap v0.5「账号、隐私与留存」（R9，10 项）

> 2026-09-06 关账记录：R9.1–R9.10 已完成。该版本在不改变“本地数据即时真相”与免费核心课程原则的前提下，补齐登录保留、隐私自助和账号生命周期能力。

- [x] R9.1 登录回跳与会话恢复
- [x] R9.2 登录后本地/云端进度合并
- [x] R9.3 离线写队列与重放
- [x] R9.4 合并摘要与同步反馈
- [x] R9.5 账号数据同步边界与越权防护
- [x] R9.6 登录态 bundle 隔离与预算
- [x] R9.7 同步失败降级与可诊断状态
- [x] R9.8 七天未访回归提示
- [x] R9.9 隐私数据导出
- [x] R9.10 注销账号（服务端删除 + 本地数据清理）

## v0.5 关账验证（2026-09-06）

- R9.10 已提交并推送：`d357271`。
- 本地门禁：96 files / 719 tests，typecheck 通过，lint 0 error，build 通过，bundle 预算与 AI chunk 隔离通过。
- CI run `34003305405` 全绿（3m35s）；E2E、Lighthouse、所有内容质量门禁均通过。
- 已知非阻塞告警：GitHub Actions 的 Node.js 20 deprecation，以及既有 ESLint warnings；不影响发布。

---

# Roadmap v0.6「内容覆盖、AI 质量与学习留存」（100 项开发任务）

> 目标：在 v0.5 的账号与隐私基础上，把产品推进到“内容持续扩产、AI 可评估、学习结果可分享”的可运营阶段。所有任务先以免费、合规、可降级为前提；测试不占下表名额，重大能力仍按单项提交、单测、CI 验证。

## R10 内容扩产与双语覆盖（R10.1–R10.25）

- [x] R10.1 内容清单与中英覆盖率报告（JSON + Markdown 产物）
- [x] R10.2 章节/课程缺口排序（按章节重要性与搜索需求）
- [x] R10.3 中文标题与英文标题术语一致性检查
- [x] R10.4 课程 frontmatter 描述质量评分
- [x] R10.5 课程风险提示块覆盖率报告
- [x] R10.6 知识库新增课程自动验收清单
- [x] R10.7 内容变更 changelog 自动片段
- [x] R10.8 sitemap 新增 URL 回归检查
- [x] R10.9 搜索索引新增文档回归检查
- [x] R10.10 章节导航与上一篇/下一篇链路回归
- [x] R10.11 相对链接跨语言解析审计
- [x] R10.12 图片资产与 alt 文本审计增强
- [x] R10.13 术语表双语扩展
- [x] R10.14 中英 slug 冲突检查
- [x] R10.15 课程摘要与 SEO description 去重
- [x] R10.16 新章节上线 dry-run 命令
- [x] R10.17 内容质量报告 CI artifact
- [x] R10.18 上游知识库版本变更提示
- [x] R10.19 翻译状态历史快照
- [x] R10.20 关键章节英文 parity 预算
- [x] R10.21 内容搜索同义词词典
- [x] R10.22 站内搜索无结果诊断
- [x] R10.23 内容页 canonical/hreflang 复核
- [x] R10.24 内容更新后的缓存失效策略
- [x] R10.25 内容运营手册 v0.6 更新

> **R10 收官（2026-09-06）**：R10 内容扩产与双语覆盖 25/25 完成，v0.6 进度 25/100。
> 末段提交：R10.21 `a093ead`（同义词）→ R10.22 `5a1b663`（无结果诊断）→ R10.23 `1fdc42e`（canonical/hreflang + en 页 metadata 取 locale）→
> R10.24 `818e167`（内容产物 revalidate 策略锁定）→ R10.25 本手册。对应 CI 除 R10.21 一次
> 竞态失败（R10.22 修复）外全部单次全绿。R11（AI 出题）/R12（留存）/R13（分享、移动端）待排。

## R11 AI 出题质量与可靠性（R11.1–R11.25）

- [x] R11.1 AI quiz 输出 schema 严格校验
- [x] R11.2 题干/选项/答案完整性校验
- [x] R11.3 题目与章节相关性评分
- [x] R11.4 重复题与近重复题检测
- [x] R11.5 解释必须绑定引用或明确无引用
- [x] R11.6 引用章节可访问性回归
- [x] R11.7 错题驱动生成策略配置化
- [x] R11.8 难度分层与本地记录
- [x] R11.9 AI 题目质量离线 fixture 集
- [x] R11.10 生成失败的本地题库降级
- [x] R11.11 无 API key 禁用态文案复核
- [x] R11.12 AI 请求取消与重复提交防护
- [x] R11.13 AI 流式响应断线恢复
- [x] R11.14 配额与速率限制用户反馈
- [x] R11.15 AI 错误分级指标
- [x] R11.16 prompt 版本与输出 schema 绑定
- [x] R11.17 模型响应敏感内容过滤
- [x] R11.18 投资建议/收益承诺文案门禁扩展
- [x] R11.19 AI 反馈闭环导出
- [x] R11.20 AI 质量抽样报告
- [x] R11.21 AI 端点超时预算监控
- [x] R11.22 AI 成本估算与请求计数
- [x] R11.23 AI 页面首屏与降级性能预算
- [x] R11.24 AI 功能可观测性文档
- [x] R11.25 AI 质量发布检查清单

## R12 学习留存与个人统计（R12.1–R12.25）

- [x] R12.1 学习总览卡片（课程/测验/回放）
- [x] R12.2 课程完成率趋势
- [x] R12.3 测验成绩趋势与最高分
- [x] R12.4 错题复习效率统计
- [x] R12.5 回放练习时长统计
- [x] R12.6 streak 断档后的温和恢复提示
- [x] R12.7 个性化下一步学习建议
- [x] R12.8 本地数据与云端数据来源标识
- [x] R12.9 多设备同步冲突提示
- [x] R12.10 学习数据时间范围筛选
- [x] R12.11 统计页面空态 CTA
- [x] R12.12 统计导出字段版本化
- [x] R12.13 隐私设置入口复核
- [x] R12.14 数据保留与清理说明
- [x] R12.15 复习提醒频率设置
- [x] R12.16 提醒免打扰窗口
- [x] R12.17 提醒事件去重与可测试时钟
- [x] R12.18 课程完成庆祝但不暗示收益
- [x] R12.19 学习目标可编辑
- [x] R12.20 每周学习摘要本地生成
- [x] R12.21 统计组件移动端布局
- [x] R12.22 统计页面性能预算
- [x] R12.23 统计数据一致性校验
- [x] R12.24 统计功能无登录降级
- [x] R12.25 留存指标定义与审计文档

## R13 分享、移动端与增长质量（R13.1–R13.25）

- [x] R13.1 分享卡视觉模板统一
- [x] R13.2 分享卡字体与无障碍文本替代
- [x] R13.3 分享链接参数白名单
- [x] R13.4 分享落地页隐私脱敏
- [x] R13.5 分享页 OG 图片错误降级
- [x] R13.6 分享下载失败反馈
- [x] R13.7 320px 核心路径回归扩展
- [x] R13.8 触控目标尺寸审计
- [x] R13.9 移动端键盘与焦点管理
- [x] R13.10 移动端表格/代码块横向滚动
- [x] R13.11 移动端图表降级策略
- [x] R13.12 移动端网络慢速加载体验
- [x] R13.13 PWA 离线页复核
- [x] R13.14 安装提示与关闭状态
- [x] R13.15 首屏性能预算按路由细分
- [x] R13.16 SEO 结构化数据回归
- [x] R13.17 sitemap 与 robots 发布复核
- [x] R13.18 搜索引擎无结果页面 CTA
- [x] R13.19 分享/邀请转化事件设计
- [x] R13.20 增长事件隐私审计
- [x] R13.21 不引入暗黑模式增长文案
- [x] R13.22 社交功能轻量化设计评审
- [ ] R13.23 评论/排行榜是否引入的用户研究 — `BLOCKED_EXTERNAL`：需真实目标用户访谈/问卷证据，不得用代码或竞品清单替代（设计结论见 docs/social-features-review.md）
- [x] R13.24 v0.6 全站 E2E 冒烟扩展
- [x] R13.25 v0.6 关账与发布复盘（docs/v0.6-release-review.md；v0.6 = R10–R13，99/100，R13.23 外部阻塞）

## v0.6 关账标准

1. R10–R13 所有质量门禁有自动化验证，内容与 AI 功能均保留无配置降级路径。
2. 核心新增能力各有单测、移动端回归与至少一条 Playwright 冒烟；不降低现有 719 测试的覆盖范围。
3. 不引入荐股、收益承诺、券商导流或付费墙；每篇知识库内容继续满足风险提示契约。
4. 构建、bundle、搜索索引、链接、SEO、Lighthouse 与 CI 全部通过，再进行版本关账。

---

# Roadmap v0.7「稳定性与发布可靠性」（v0.6 后累计修复固化 · 已发布）

> 本版不引入新功能，也没有新增需求编号：范围是 v0.6 之后持续落地的生产回归修复、
> 质量门禁与依赖可靠性固化。发布证据见 [`docs/v0.7-release-review.md`](v0.7-release-review.md)
> 与 [`docs/v0.7.1-release-review.md`](v0.7.1-release-review.md)；
> 版本单一来源 `src/data/release-notes.json`（站内 `/changelog` 与 `CHANGELOG.md` 同源）。

- [x] v0.7.0 发布（2026-09-20，发布提交 `364515b`）：统一剪贴板助手、匿名 AI 写入端点限流、回放首轮战绩与分享评级修复、本地快照损坏兜底、lockfile 可复现门禁、TypeScript 6.0.3、亮色主题对比度 axe 回归
- [x] v0.7.1 发布（2026-09-22，tag `v0.7.1`）：游客被认证边界误判的线上回归（未登录访客的 AI 问答整条链路不可用）、19 个从未上远端的提交与 4 个被关闭 PR 的回收、`package.json` 版本号绑定门禁、CI 墙钟抖动消除
- [x] v0.7 关账验证：lint / typecheck / 259 文件 2393 单测 / 474 静态页 / 93 E2E / `db:test` / `backup:drill` / 38 项内容、隐私与安全门禁全绿

# Roadmap v0.8「发布工程、红线可验证性与测试确定性」（R14，12 项）

> 立项依据不是功能诉求，而是 v0.7.1 盘点时暴露的结构性事实：一次线上回归在单测全绿、
> CI 全绿、门禁全绿的情况下仍然上线；19 个提交在本地 `main` 悬空近一天而无人发现；
> 项目的头号内容红线在一条主要路由上根本没有守卫。以下每条都标注验证方式。

## R14 发布工程、站内红线守卫与测试确定性（R14.1–R14.12）

- [x] R14.1 `package.json` 版本号绑定最新发布版本并门禁防漂移（`check:docs` 新增 `auditReleaseVersion`；此前 `0.1.0` 与已发布 `0.7.0` 并存，跨 0.4.0→0.7.0 四次发布无人发现。验证：把版本改回 `0.1.0`，`check:docs` 变红）
- [x] R14.2 课文页风险提示兜底 + 站内接线阻断式门禁（`check:risk-warning` 的 `auditFallbackWiring`：章节页与课文页任一去掉兜底即 CI 变红；此前红线只在章节页成立。验证：摘掉课文页守卫后门禁报「未调用 shouldShowRiskWarningFallback」；PR #109）
- [x] R14.3 发布必须留 git tag，且新增 `check:release-tag` 校验「除最新发布版本外，每条发布记录都存在同名 tag」。验证：`npm run check:release-tag` 通过；本地删除 `v0.7.1` 后打印「待合并后补打」而不判失败，删除已被取代的版本 tag 则 CI 变红。背景：`0.4.0`–`0.7.0` 四次发布从未打 tag，`v0.7.1` 是本仓库第一个 tag（遗留四次发布用显式豁免清单而非回填：给已被取代的旧提交补 tag 可能把过期代码推成生产部署）
- [x] R14.4 悬空提交防护：`npm run ops:work-audit` 报出两类问题——本地既不在 `main` 也不在任何远端的提交，以及被关闭但工作去向未确认的 PR（台账 `docs/work-audit-ack.json`）。第二类的判定（rebase 合并会改写 SHA，必须用 `git cherry` 比补丁而不是比 SHA）是在对自己历史实测时纠正出来的。**已进 CI**（R14.4 收尾）：ci.yml 用 `WORK_AUDIT_REQUIRE_GH=1` 跑这道门，读不到 GitHub 即判失败，不允许静默变绿；第一类在 CI 里天然为 0（runner 检出的是分离 HEAD，看不到开发者本地分支），所以它只在本地有意义，脚本对两种模式都成立。验证：本地造一个未推送提交，门禁必须报出。背景：PR #99/#101/#102/#104 因 `codex/*` 分支被清理而关闭且从未合并，19 个提交只在本地 `main` 存活近一天
- [x] R14.5 内容报告幂等化：`check:risk-warning` / `check:glossary` / `kb:inventory` 等 14 个报告产物在内容未变时不得产生纯日期 diff（保留上次内容变更日期）。验证：连跑两次门禁，`git status` 必须干净
- [x] R14.6 测试确定性巡检：`npm run check:test-clock-hygiene` 扫全部 264 个测试文件，两条口径——**口径 1 阻断**（`expect(...)` 语句里直接读 `Date.now()`/`performance.now()`，无已知误报，故真实命中已清零后即可当门禁），**口径 2 报告式**（使用真实 `setTimeout`/`setInterval` 且同文件从不使用受控时钟，现存 10 处需人工判断，`await new Promise(r => setTimeout(r, 0))` 这类排空写法是合法的）→ `docs/test-clock-hygiene.md`。此前「静态扫 `Date.now` 属低信号」的判断是因为口径太宽：按「断言里读墙钟」收窄后既能阻断又不误报。验证：临时引入一个依赖真实耗时的断言，巡检必须点名。背景：`quiz.test.tsx` 的学习时长断言只在单跑 <500ms 时成立，全量并行必现抖动，R14 之前无人知道还有多少同类
- [x] R14.7 内容红线守卫覆盖面盘点：除章节导语与课文外，测验页、术语表、错题本、AI 生成内容是否都满足「每篇内容带风险提示」；结论写入本文件并各自配接线门禁。验证：每类内容一条断言（结论见下节；盘点逮到 `/share/*` 三类分享落地页完全没有承载面，已修复并加断言）
- [x] R14.8 发布检查单固化：版本号 → `release-notes.json` → `changelog:generate` → tag → 全量门禁 → 生产部署 → 生产域名冒烟 → 进度记录，落为 `docs/release-checklist.md` 并在 `CONTRIBUTING.md` 指路。验证：`check:docs` 断言清单存在且含关键步
- [ ] R14.9 预览站自动化冒烟 — `BLOCKED_EXTERNAL`：预览域启用了 Vercel Deployment Protection，未授权请求一律 302 到 SSO，需要账号级 protection-bypass 密钥才能跑自动化。当前以生产域名冒烟代替（已验证可用）
- [ ] R14.10 错误监控与告警通道（承接 Q2.7）— `BLOCKED_EXTERNAL`：需 Sentry 生产 DSN 与告警接收渠道；站内已具备隐私合规的上报端点与本地日志脱敏门禁
- [ ] R14.11 上游内容遗留（承接 R10 系列）— `BLOCKED_EXTERNAL`（必须在 kline-buty 仓库改）：14 篇章节 README 风险块不合规（2 gap + 12 review）、70/364 篇 description 待复核、120/182 条标题术语待复核；站内已用 R14.2 的兜底与报告门禁保证不阻断上线也不误报为 pass
- [x] R14.12 覆盖率继续爬坡：statements 95.47% → **96.24%**，分支 90.35% → **91.10%**（functions 96.24% / lines 98.30%，265 文件 / 2483 用例），阈值保持 84/77 **未下调**，全部增量来自真实缺陷路径：结构化数据畸形文档容忍、新章节契约校验的缺字段分支、术语检查的降级分支、统计页 SSR 快照、知识库宽容模式（临时知识树驱动）、搜索页输入联想与零结果诊断的交互路径。过程记录：关账后 R14.4/R14.6 新增门禁代码把分母抬高，一度回落到 90.98%；没有用降阈值或引用旧数字掩盖，而是由 PR #122 补交互用例把分支率推回 91.10%。验证：`npm run test:coverage`

#### R14.7 盘点结论（2026-09-22）

盘点方式：从构建产物枚举全部预渲染路由（36 条非知识库路由）逐条抓 HTML 查 `⚠️`，再按内容类型
核对承载组件与守卫。**唯一发现的空洞是分享落地页**——`/share/*` 挂在根级、不在 `[locale]` 布局下，
全站页脚够不着，quiz / replay / streak 三类对外转发页一句风险提示都没有。

| 内容表面 | 风险提示承载 | 守卫（删掉接线即变红） |
| --- | --- | --- |
| 课文正文（zh 182 / en 182） | 上游合规块；不合规时渲染本地兜底 `RiskWarningNotice` | `check:risk-warning` 的 `auditFallbackWiring`（阻断式校验接线） |
| 章节导语（54 篇：40 pass / 12 review / 2 gap） | 同上 | 同上；上游缺口本身记 R14.11，不在站内误报为 pass |
| 术语划词解释 | `termDisclaimer` | `src/components/term-explainer.test.tsx` |
| AI 章节测验（含错题本入口的出题） | `ai.disclaimer` | `src/components/ai-chapter-quiz.test.tsx` |
| AI 对话回答 | `ai.disclaimer` | `src/components/ai-chat.test.tsx` |
| 行情图 / K 线 / 回放训练 | 各自 `disclaimer` | `chart-embed.test.tsx`、`kline-chart.test.tsx`、`replay-trainer.test.tsx` |
| 不渲染正文的工具页（首页、`/ai`、`/chart`、`/replay`、`/glossary`、`/stats`、`/path`、`/review` 等） | 全站页脚 `footer.disclaimer` | `e2e/static-surface.spec.ts`「内容红线：全站风险提示」13 条路由断言 |
| 分享落地页 `/share/{quiz,replay,streak}/*` | 本次新增：与页脚同一句 `footer.disclaimer` | 同一套件 3 条断言（变异：删掉该行 3 条全红） |
| 404 / `not-found` 外壳 | 无 | 有意不覆盖：该页不含任何可免责的观点内容 |

断言一律取 `src/lib/i18n.ts` 的词典原文逐字比对，并同时校验词典本身仍带 `⚠️` 与
「不构成（任何）投资建议 / not constitute investment advice」表述——这样改文案时门禁跟着词典走，
把文案改软也会立刻变红，不会出现「测试与产品各自漂移」。

#### R14.8 发布检查单（2026-09-22）

发布流程落为 [`docs/release-checklist.md`](release-checklist.md)：判级 → RELEASE_FREEZE 检查 → 发布记录与版本号 →
全量验证（固定顺序）→ 发布提交与 rebase 合并 → 合并后打 tag → 部署与生产域名冒烟 → 进度记录 → 回滚。
`npm run check:docs` 的 `auditReleaseChecklist` 断言该文件存在且 13 个关键步骤标记仍在，`CONTRIBUTING.md`
的指路行同时进入贡献契约。变异验证三向：删文件 → 「文件缺失」；把 `git tag -a vX.Y.Z` 改成 `git tag` →
「缺少发布步骤」；删掉 CONTRIBUTING 指路行 → 贡献契约报错。

### v0.8 关账标准

1. R14.3–R14.8 每项都有可失败的门禁或脚本承载，不靠「记得做」维持；`BLOCKED_EXTERNAL` 项保持显式未勾选，不得用本地半边工作冒充完成。
2. 红线兜底覆盖所有可渲染内容类型，且删除任一接线时 CI 必须变红（用变异验证证明，不接受只加代码不加断言）。
3. 全量门禁在本地与 CI 连续两次运行结果一致：无随机红灯、无纯日期 diff、无需要人工判断的顺序耦合。
4. 发布链路可复现：任何人按 `docs/release-checklist.md` 都能从 `main` 得到一个带 tag、带双语发布说明、带生产冒烟记录的 patch/minor 版本。
5. 不引入荐股、收益承诺、券商导流或付费墙；核心课程继续永久免费。

---

# Roadmap v0.9「共享浏览器上的数据归属与认证边界」（R15，盘点进行中）

> 立项依据：v0.7.2 修掉的是「切换账号后仍看到上一个账号的数据」这一次线上回归，但它只覆盖了
> 飞行中的响应与写队列。对认证 / 授权 / 数据隔离做一轮完整盘点后发现，同一类问题在本地镜像、
> AI 端点的限流与分页口径、以及后台人工抽检查询上仍然存在。每项都必须先有可复现证据再写进本节，
> 不允许把「看起来像缺陷」当作需求。

## R15 数据归属与认证边界（盘点进行中）

- [x] R15.1 本地学习镜像钉归属账号：`tb-*` 镜像是**按设备**存的，A 登出、B 登录后 `hydrateFromCloud(B)` 会把 A 留下的镜像并进 B 的本地状态，并以 `user_id = B` 补传回云端——RLS 允许，因为那是 B 自己的行，于是 B 的进度里混进一批无法分辨来源的 A 的记录。现在 `tb-data-owner` 记录镜像归属：同一账号幂等、无戳（登录前的游客数据）由第一个登录的账号认领、归属为别人则先丢弃上一账号的镜像再合并。丢弃范围严格限定在 `hydrateFromCloud` 自己负责合并/补传的键（云端都有对应行，账号回来重新登录即可恢复）+ 由它们派生的合并元数据；设备偏好不在内。验证：`src/lib/account-mirror.test.ts` 7 例 + `src/lib/sync-layer-hydrate.test.ts`「换账号登录的本地镜像归属」3 例；变异（摘掉 `adoptAccountMirror(id)`）后换账号用例立即报「A 的私密进度出现在 B 的镜像里」
- [ ] R15.2 仅本地存在的学习记录仍然跨账号可见 — **需产品决策，不擅自选边**：书签（`tb-bookmarks`）、连续天数（`tb-streak`）、学习时长（`tb-study-time`）、活动日历（`tb-activity`）、答题账本（`tb-quiz-attempts` / `tb-review-attempts`）在 Supabase 里**没有对应表**（迁移文件里的用户表只有 progress / wrongbook / quiz_scores / replay_history / replay_best / user_settings / ai_*）。换账号时清掉它们能彻底堵住共享浏览器的残留泄漏，但这几份是设备上唯一的副本，误删就是真丢数据；留着则下一个使用者仍看得到上一个的使用轨迹。三个候选：①按账号命名空间存（彻底，但要改 6+ 个 store 与全部读路径）；②登出即清（简单，代价是个人设备上一次性登出的用户丢本地数据）；③保持现状 + 在登出时明示「这台设备仍留有本地上课记录」。R15.1 已经把**不可逆**的那一半（写进别人云端）堵死，本条只剩展示层与留存策略
- [x] R15.3 AI 匿名可写端点的两处边界（`/api/ai/feedback`、`/api/ai/citation-click`）：①限流仍按 IP 分桶（`check(clientIp(req), false)`），与 `/api/ai/chat` 上 `0e752af` 修掉的是同一个坑——同一 NAT/校园网出口下多个登录账号共用一桶，一个人的脚本就能把整栋楼的真人反馈一起 429；现在先定身份再限流，登录用户按 `user.id` 分桶、游客退回 IP。②`resolveAuthUser` 一抛错就 500 且不写库，而过期 cookie 是常态路径：RLS 明确允许 `user_id is null` 的匿名行（`0002_ai.sql:104`、`0004:25`），前端又是 fire-and-forget，500 等于把一次真人反馈/点击凭空丢掉；现在降级为匿名行、照常 200，只留一条 warn。对照项：**`/api/ai/conversations` 故意不跟着降级**——对话轮次是用户私有内容，错归成匿名行比不存更糟，身份不可确定时仍 401/500，这是已评估的边界而不是漏改。验证：两端点各 3 条用例（getUser 抛错与返回 error 各自按匿名入库、同 IP 两个账号各有自己的配额），变异还原任一处 → 6 条同时变红
- [x] R15.4 AI 边界的 C 级盘点结论（四条全部核实完毕；①已由 R15.5 修掉，②核实为**打不到的死路径**，③④已评估、按现状保留）：
  - ①（已修）盘点时站内只有 `/api/error-reports` 对请求体做了字节上限，其余 7 个 AI 路由直接 `req.json()`——字段级上限（单条消息 8000 字符等）要**整包缓冲并解析完之后**才生效，所以那一行等于把内存放大的额度交给客户端决定。见 R15.5。
  - ②（核实为打不到）`ai/quiz` 章节模式的 `fixedQuiz` 兜底不按 `locale` / `difficulty` 过滤，读起来像「英文用户拿到中文卷」。实测这条路径在产品里不可达：`/api/ai/quiz` 的章节模式只有一个调用方 `AiChapterQuizCard`，而 `[doc]/page.tsx:301` 是 `QUIZZES[chapterSlug] ? <ChapterExamCard> : <AiChapterQuizCard>`——挂载 AI 卡的章节按定义**没有**固定题库，于是 `fixedQuiz` 恒为 `undefined`，兜底分支只会走 `if (fixedQuiz)` 的假侧。顺带核实两点：`ChapterQuiz`/`QuizQuestion` 没有难度维度（`src/lib/quiz-types.ts`），固定题库本就无从按 `difficulty` 过滤；缺 `CHAPTER_SLUG_RE` 也不构成注入面，因为 `getChapterTitle` 取的是 `TITLES[locale][chapter].title`，`constructor`/`__proto__`/`toString`/`hasOwnProperty` 这些继承属性上没有 `title`，一律回 `null` → 400（已用脚本探针逐个验证）。真正该记下的是：**R2.5「AI 失败降级到本章固定题，绝不白屏」这条设计是空的**——能进这个端点的章节按构造就没有固定题，AI 失败必然落到 502 文案。
  - ③（保留）限流的 IP 维度建立在可伪造的 `x-forwarded-for` 上（`src/lib/ai/rate-limit.ts:9-11` 自己写明），且 `BoundedMap` 满 10_000 键会挤掉仍在窗口内的真实计数，等于攻击者可用大量新 IP 让老配额清零。这是进程内限流的固有边界：站内没有可信的客户端身份可依赖，换成按账号分桶的那半已经在 R15.3/R7.12 做完了；要真正收紧需要边缘计数（Vercel/WAF），不在仓库侧。
  - ④（保留）`/api/auth/session` 与 `/api/auth/signout` 在站内没有任何调用方（`session` 只被文档与 `ops:smoke-prod` 用作 #107 回归探针，`signout` 连探针都没有——浏览器登出走的是 Supabase 浏览器客户端），也无限流，每次请求都要跑一趟 Auth API。删掉是可达性最小化的正解，但这两个是对外可见的 API 面，删除属产品/API 决策，留待用户拍板；本轮不擅自下线。

- [x] R15.5 所有解析 JSON 请求体的端点统一走有界读取（收口 R15.4①）：新增 `src/lib/request-body.ts`（`readBoundedBody` 从 `/api/error-reports` 提出来共用，外加 `readJsonBody` 把「读流设闸 → 超限 413 → 解析失败 400」固定成一个形状），8 个 POST 端点逐个把 `await req.json()` 换掉，并按「413 与 400 是两件事」各自补用例（超限一律在检索/模型/写库**之前**返回，断言 `chat`/`retrieve`/`insert` 未被调用）。每个上限都由该路由自己的字段上限算出来（字符上限 ×3 是 CJK 的 UTF-8 上界，再加 JSON 结构开销），不写行内魔法数字：`MAX_CHAT_BODY_BYTES`≈988 KB、`MAX_CONVERSATION_BODY_BYTES`≈95 KB、`MAX_FEEDBACK_BODY_BYTES`≈31 KB、其余 1.3–15 KB。并把它钉成门禁 `npm run check:request-body-bounds`（`scripts/request-body-bounds.mjs`）：扫 `src/app/api/**/route.ts`，任何 `req.json()` 直接判违规、有界读取的上限必须是具名常量。验证：新用例 14 条（含「首块就超限且永不 close 的流必须被 cancel」「注释里写 `req.json()` 不算违规」）；变异（把 plan 路由改回 `req.json()`）后门禁 exit 1 并点名该文件，改回后 exit 0；`scripts/ci-workflow.test.mjs` 的「CI 步骤 ↔ `docs/ops.md` 门禁表 ↔ `package.json` 脚本」三方契约同步通过。

---

# Roadmap v0.10「学习数据口径一致性」（R16，盘点进行中）

> 立项依据：R15 盘的是认证与数据隔离边界，这一轮盘的是**同一份学习数据在不同入口被算成不同数字**。
> 学习记录有两条独立通路（本机 localStorage 镜像 + Supabase 云端行），每个统计入口各自挑一把尺子，
> 漂移就在所难免。判据与 R15 相同：必须能在测试里造出「两个入口对同一状态给出不同答案」才算缺陷，
> 不允许把「看起来像缺陷」当作需求。

## R16 学习数据口径（盘点进行中）

- [x] R16.1 写失败队列此前根本不可达：postgrest-js 的 builder 在 `.then()` 之前就把错误吞成 `{data:null,error}`，所以 `.then(undefined, onReject)` 形式的兜底永远不进 reject 分支——断网时这次写入既没进云端也没进队列，直接消失。现在同时检查 fulfilled 结果里的 `error` 与真正的 rejection。顺带发现原有两个「客户端存在但写入失败」用例是**假绿**（`vi.doMock` 不会替换已被加载模块的依赖，实际走的是无客户端分支），删除后在 `src/lib/sync-layer-write-failure.test.ts` 用静态 `vi.mock` 重做：6 个写入函数 × {返回 error 入队 / 成功不入队 / rejection 入队 / 响应前已换账号则不入队}
- [x] R16.2 清空错题本只清了本地：`clearAllWrong()` 删掉 `tb-wrong` 后，下次 `hydrateFromCloud` 会把整本错题原样拉回，「清空」在用户眼里等于没生效。新增 `syncWrongbookClearAll`：整表按 `user_id` 删除，失败时退回逐条入队重放（快照必须在删本地之前取）
- [x] R16.3 每轮回放被统计两次：`replay_history.recorded_at` 是服务器落库时刻（`default now()`），与客户端 `at` 必然差一段网络延迟，而合并的去重键含 `at`，于是认不出是同一轮 → 每次登录本地历史翻倍、统计页轮数虚高。现在合并把本地完成时刻作为云端时间，并按「统计指纹 + 10 秒容忍窗」去重；容忍只作用于「云端行 vs 本地记录」，不作用于云端行之间，否则离线批量补传的真实不同轮次会被误并成一条
- [x] R16.4 复习页与统计页的「今日到期」不是同一个数：`review-client` 的头部计数与置顶排序读原始 `srsDue`，行内徽章、`stats-client`、`streak-recovery-card` 读 `effectiveSrs()`（R5.6 的回填）。无 `srs_due` 的条目（R5 之前的旧数据、云端该列为空的行）于是同时被算成「今日到期」并显示「1 天后」——同一屏两个数字打架，且断签提醒卡的口径与复习页也不同。统一到 `effectiveSrs()`；`wrongbook-efficiency` 的 `overdue`（旧数据不标红）另有已固化断言，属另一个入口，当时暂不并入（R16.9 收口）
- [x] R16.5 「总学习时长」承诺了一个并不存在的全历史口径：台账按**条数**裁到 90 条，稀疏用户（每 3 天学一次）的 90 条记录可以横跨一年以上，于是统计页多承诺了覆盖范围、隐私页的「仅保留最近 90 天」多承诺了删除。裁剪改为锚定「台账里最新一天」的日历窗口（`STUDY_LEDGER_KEEP_DAYS`，不依赖真实时钟所以测试不会随日期腐烂），标签改成「近 90 天学习时长」，并加断言把两种语言的标签钉回同一个常量
- [x] R16.6 合并摘要把云端行数当成新增：`replay_history` 是 append-only，本机自己上传的那一轮也在返回的行里，于是对着「本地与云端完全相同」的数据 Toast 仍报「新增 N 轮回放」、`hasAny=true`（原来那条用例的断言写的就是这个 bug）。指纹/坏时间戳/容忍窗三个判定抽成共用函数，`countNewReplayRounds` 只数合并真正带入的轮次，测试直接断言「摘要说几轮，合并就多几轮」
- [ ] R16.7 复习成果在多设备间不收敛、且可能倒退 — **需设计决策，不擅自选边**：`mergeWrongbook` 用 `answered_at` 判新旧，但客户端 upsert 载荷不含该字段、表上也没有 `updated_at` 列或触发器（`supabase/migrations/0001_init.sql:31` 只有 `default now()`），它永远停在首次插入时刻；本地 `at` 也在复习推进时被刻意保留（`src/lib/wrongbook.ts:63` 的幂等设计）。两边都不比对方新，于是有本地副本的设备永远收不到对端的推进（B 停在 stage 1，哪怕云端已是 stage 4），而任何一次复习又会无条件用本地值覆盖云端（B 复习到 stage 2 就把云端的 stage 4 拉回去）。三个候选：①云端 upsert 显式带 `answered_at`——但它是「错题入库时刻」的语义，改用它判序会连带改掉错题本的日期展示；②加 `srs_updated_at` 列 + 触发器，按它比对（要迁移，旧行回填策略待定）；③引入显式 `plan_version`/LWW 逻辑时钟。R16.3/R16.4 只修了去重与口径，本条是剩下的那半：**数据不丢，但计划不会更新**
- [x] R16.8 已评估，保持现状：streak 的 36h 宽限窗不看日历跨度（`src/lib/streak.ts` 里只要求 `daysBetween >= 1`）。看着像漏洞——`lastDate` 是 2020 年、`lastTs` 是 10 小时前，连续天数照样不归零——但 `src/lib/streak.test.ts`「getCurrentStreak 在宽限窗内不归零」正是钉这个行为的用例，而 `lastDate` 与 `lastTs` 永远由同一次 `touchStreak()` 用同一个时钟写出，正常路径造不出这种状态（跨账号混写那一来源已由 R15.1 堵掉），只剩下手改 localStorage 自欺。收窄到 `<= 2` 的代价是改写一条已固化断言、收益只是防自己骗自己，不值
- [x] R16.9 收口 R16.4 剩下的那半：复习页的「已过期」与 `wrongbook-efficiency.latest.overdue` 从来不是同一个数。R16.4 把「今日到期」统一到了 `effectiveSrs()`，但同一把尺子被顺带用在了「已过期」上——回填出来的到期日是推断值、不是系统真正排过的复习计划，于是 R5 之前的旧数据、云端 `srs_due` 为空的行会被标成红色「过期 N 天」，等于对用户宣布了一个没人定过的逾期天数，也推翻了 `isSrsOverdue` 自己注释里写的「旧数据不标红」（那个 `!due → false` 的守卫经过回填后永远拿不到空值，形同死代码）。而版本化统计导出走的是另一套：只认真实 `srsDue`。现在两个口径各归各位并且各只算一次：`dueToday` 仍按回填（旧数据该出现就出现），`overdue` 只看原始 `srsDue`，条目构造时算成 `ReviewItem.overdue`，徽章/左边框/头部计数共用该结论。验证：`src/components/review-client.test.tsx`「回填的旧数据算今日到期但不标红，且与错题效率统计同口径」从渲染出的头部文案里取出两个数字，再与 `buildWrongbookEfficiency` 的 `latest` 互比——任何一侧改口径都会红；变异（把 `overdue` 换回复填值）后只有这一条变红，其余 22 条不受影响。
- [ ] R16.10 测验成绩的「满分」判定与分享卡片的评级用的是两个分母 — **需设计决策，不擅自选边**：本地记录 `tb-quiz-{chapter}` 只存 `{best, done}`（`src/lib/sync-layer.ts:431` 的 `normalizeLocalQuiz`、`:479` 的 `mergeQuizScore` 都把云端行的 `total` 丢掉，`mergeQuizScore` 直接对两台设备的 `best` 取 max），而展示端的分母永远是**当前**课题库的 `quiz.questions.length`。于是题量一变（kline-buty 删题、或 A 设备缓存旧版题本、B 设备已同步新版），归档的 `best` 与今天的 `total` 就不同源：`best=11`（11/12 卷，并非全对）遇到收窄到 10 题的库，`quizScoreCount`/`quizScorePct`（`src/lib/quiz-score.ts:9,18`）封顶成 10/10 = 100%，评级 `S`（`src/lib/share-card.ts:62`）、落地页标题「满分」（`src/lib/share-landing.ts:149`）与 `i18n` 同条文案随之成立。同一状态下两个入口给出不同答案：`src/components/quiz.tsx:158` 的 `perfect` 用**原始** `best === questions.length` 判定，所以站内 🏆 与「全对！」正确地不出现，而分享出去的卡面在宣称满分——正是要按本系列判据（能在测试里造出分歧）登记的缺陷。三个候选：①本地记录随 `best` 存下 `total`（跨设备合并时按同一行的 `best/total` 成对取优），百分比按「那次作答自己的分母」算，代价是站内所有读数（雷达图、章节卡、`learn-stats`、`quiz-score-trend`）都要改读记录分母而非课库题数，且要给 localStorage 做一次带迁移的口径升级；②保留当前分母但**不封顶**：`best > total` 时判为记录过期，两处入口统一降级为「未满分」并提示重做本章测验；③把「满分」的定义从「答对题数=题数」改成「百分比=100% 且该次作答确实全对」，即分享端也读 `perfect` 而不是读百分比。R16.3/R16.4/R16.9 已把复习与回放侧的分母/时间口径收口，本条是测验侧剩下的那半；未选定前不改任何计算，避免把「哪个分母才是对的」写成第四次口径。
- [x] R16.11 统计导出把「测验平均分」装在名为 `bestPct` 的字段里 — schema 决策已选定并落地：走该文件头写明的迁移通道（**改名 + `STATS_EXPORT_VERSION` 1→2**），不追加同义键、也不留在注释里当传说。`quizzes.bestPct` → `quizzes.avgBestPct`（`src/lib/learning-overview.ts:87` 的 `safePct(input.avgQuizScore)` 语义没变，变的只是名字），`engagement.totalStudySeconds` → `engagement.studySeconds`，窗口天数不再编码进键名（那个数会随 `STUDY_LEDGER_KEEP_DAYS` 变）而是随行给出 `engagement.studyWindowDays`，值直接取自裁剪台账的同一个常量。屏幕上也补了口径：总览卡片原来只写中性的「测验记录 / Quiz record」加一个裸 `NN%`，现在写成「NN% · 各章最高分的平均」（`i18n-stats` 新增 `overviewQuizzesAvg`，中英同步）。验证：`src/lib/stats-export.test.ts` 的叶子路径清单从 22 条改为 23 条并钉死新名（变异：把 `avgBestPct` 改回任意别名，三条用例同时红）；`studyWindowDays` 断言读的是活的常量（变异：导出里写死 90 + 常量改 120 → 红，只改一处不红，正是要的语义）；`src/lib/learn-stats.test.ts` 补上此前没人证的「均值不是最大值」（各章 100% 与 0% 造出分歧，变异成 `Math.max` 后红）；`src/components/stats-client.test.tsx` 断言口径文字真的到达屏幕（变异：删掉后缀 → 红）。同时收掉一个测试夹具漏洞：该文件的 `dict` 原先以 `as unknown as` 双层强转，新字段漏补既不报错也不显示，现改为从真实 `STATS_DICTS.en` 派生并用 `StatsDict` 注解，拼错或已删的键会被 tsc 拒掉。v1 文件没有导入工具会读到它（`src/components/stats-client-guest.test.tsx:98` 只断言 `format`），故不做双写兼容。

- [ ] R16.12 低带宽是否应该真的把 K 线根数降到精简模式 — **需产品决策，不擅自选边**：`src/components/kline-chart.tsx` 里 `density` 只看视口（`getChartDensityFromViewport(isNarrowViewport, forceFull && !lowBandwidth)`），低带宽只做到两件事——`useNetworkQuality()!=="online"` 时不建 WebSocket、隐藏「显示完整」的入口。桌面宽度慢网下 `dataLimit` 仍是 `FULL_CHART_CANDLES`（500 根）。原来那句提示写的是「已切换为 180 根 K 线精简模式」，在桌面端是假话，已按「只说代码真做了的事」订正（`slowNetwork` 现在只说暂停实时推送）。剩下两个方向要选：①让低带宽真的把根数降到 `COMPACT_CHART_CANDLES`（省流量，但桌面用户会突然看不到长历史）；②保持现状，即低带宽只关推送（当前实现）。选①要同时决定窄屏是否还允许手动「显示完整」。

- [x] R16.13 英文翻译状态的两句文案可能已经过期 — **需上游核实，不在站内改口径**：`content/kline-buty/docs/knowledge/en/` 现在有 27 个章节目录（与 zh 同数），于是 `/[locale]/path` 的 `translationNote` 渲染出来是「🚧 English translation in progress — 27/27 chapters available so far」，FAQ 也还写着「英文内容正在翻译中，部分章节可能仍是中文」。目录数不等于翻译完成度：`check:kb-parity-budget` 盯的是结构对齐，句子通不通、有没有整段仍是中文要在 kline-buty 侧逐章确认（本仓不得就地改 submodule 内容）。确认完成后统一改这两处文案；确认之前保持现状，避免把「目录齐了」当成「翻完了」写进界面。 **2026-09-24 结**：这条卡在「需上游核实」上，其实它含两半——文案那一半已由 R16.43 落地，可测的那半一直只是手算过一遍、没留下常驻检查，这次补上。①**文案现状**：`/[locale]/path` 的 note 在 zh 侧是空串（`src/lib/i18n.ts:67`，`src/app/[locale]/path/page.tsx:60` 判空即不渲染），en 侧 `:456` 是「English and Chinese cover the same {chapters} chapters…」，只讲覆盖面不讲完成度；FAQ 与 404 里「正在翻译中」那几句由 R16.43 撤掉。全站再搜 `翻译 / translat / bilingual / 双语`，剩下的只有术语表那句「中英对照」——界面对英文译文的地道性没有任何断言，也就没有哪一句在等上游核实才敢不说。②**「有没有整段仍是中文、有没有只翻了个开头」是可测的**：R16.43 当时按非空白字符手算过一次（最高 0.6%），算完没留检查。现在常驻为门禁 `scripts/check-kb-en-content.mjs`（口径与阈值集中在 `scripts/en-content-lib.mjs`）：en 树里每个 markdown（含 27 个章节 `README.md`，它们在站上会渲染成章首页）去掉 frontmatter 之后必须①非空、②CJK 字占比不超过 2%、③不少于同名中文正文的 30%。CI 步骤 `npm run check:kb-en-content`，登记在 `docs/ops.md` 门禁表与 R10.20 那一节之后。2026-09-24 实测：en 与 zh 各 209 个文件、按「章节/文件名」1:1 对齐、0 个找不到同名中文；最高占比 0.52%（`reading-list/quant-psychology-books.md`），超过 2% 的有 0 篇；最短的一篇也有同名中文的 1.70 倍（`quant-practice/data-acquisition.md`）；空正文 0 个。两处数字对不上是算法差别：这里分母取正文全部码点（含空格与换行），R16.43 取的是非空白字符——同一棵树、两种口径，写清楚免得日后当成漂移。③**验证**：`scripts/en-content-lib.test.mjs` 14 条；变异核对四组——把 CJK 段起点下移到 0x3000（连中文标点一起数）只红「不数中文标点」，按 UTF-16 单元而非码点计长只红「按码点计」，摘掉除零守卫只红「空正文不除零」，去掉「无同名中文就不判 thin」的豁免时该条与占比那条一起红。门禁脚本另用一棵四个文件的夹具树验过：中文占八成、只翻开头、frontmatter 之后全空三种坏样各判对一类并被逐条列出，好样不在名单里，退出码 1。④**仍留给上游的只有一件**：译文读起来地不地道。本仓不得就地改子模块内容（AGENTS.md 的硬约束），但没有任何界面句子依赖这个结论；上游若塞进 zh-only 占位文件，这条门禁会红并把处理指向 kline-buty。

- [x] R16.14 「图表支持哪些币」在四个地方各写一份，其中一处是错的 — FAQ 答「支持 BTC/ETH/BNB/SOL 四个币种」，而练习图表的输入框接受的是**任意以 USDT 计价的交易对**（`src/components/kline-chart.tsx` 的 `/^[A-Z]+USDT$/`），把范围说小了；同一时间首页行情条列 3 个、回放列 4 个，三份清单分别写死在三个组件里，谁也不引用谁。现在标的清单只有一个来源 `src/lib/chart-symbols.ts`（`CHART_QUICK_SYMBOLS` / `REPLAY_SYMBOLS` / `TICKER_SYMBOLS`，外加自定义输入的 `CHART_CUSTOM_SYMBOL`、短标签 `symbolBase` 与「是否同一批」判定 `sameSymbolSet`），默认选中项与 FAQ 文案全部由它生成。三份清单**故意**不同（版面宽度与教学范围各自的选择），所以收口方式不是合并成一份，而是把彼此关系钉成门禁：`src/lib/chart-symbols.test.ts` 要求行情条与回放的每个标的都出现在快捷按钮清单里、都能过自定义输入校验，并禁止组件自带 `const SYMBOLS = [` 或裸交易对字面量；`src/app/[locale]/faq/chart-scope-claims.test.tsx` 渲染真实页面，断言可见答案里的币对名单、数量与「可输入任意以 USDT 计价的币安现货交易对」都取自常量，且同一份清单在一条回答里只念一遍。顺带把 `CHART_CUSTOM_SYMBOL` 放宽到允许数字，并按实测数据把范围说准：币安**现货**确有 `1INCHUSDT` 这类以数字开头的标的（`api/v3/ticker/price` 返回 200），只允许字母会把它们挡在「任意」之外；而 `1000PEPEUSDT` 只在合约市场有（现货 `-1121 Invalid symbol`），所以文案限定在「币安现货」而不是笼统的「任意交易对」。同一处还修掉一个自相矛盾的界面：交易对输入框是非受控的（只有 `defaultValue`），用按钮换币后框里仍停在上一次手输的标的，等于显示了一个图上并没有的交易对，改为随 `symbol` 重挂载。验证：变异逐项确认非空转（FAQ 退回写死清单 → 文案门禁与渲染门禁各 1 条红；把 `XRPUSDT` 塞进行情条 → 子集门禁红；`[A-Z0-9]+` 改回 `[A-Z]+` → 数字对用例红；组件自带副本 → 2 条红；默认值改回 `"BTCUSDT"` 字面量 → 字面量门禁红；删掉回放范围那半句 → 对应语种 1 条红；强制走「清单不同」分支 → 只念一遍门禁红；摘掉 `key={symbol}` → 只有该行为用例红）

- [x] R16.15 下线已久的假行情组件仍在测试里声称自己是对的 — `src/components/hero-chart.tsx` 是首页改版（`1b35b9f`）留下的尸体：一份手写死的 12 根 K 线，套着浏览器外框，右上角标 `BTCUSDT · 4H`、左下角绿字 `+12.6%`。全站已无任何 import（只有它自己的 4 条用例在渲染它），但它的内容正好踩在内容宪法的两条线上：把一个虚构走势挂在真实交易对名下，并给出一个凭空的投资收益率——一旦有人复用就是真话变假话。连同用例一起删除；首页现在的行情模块 `market-ticker` 走的是 Binance 公开 API 的真实数据，无需替代。

- [ ] R16.16 `/[locale]/calendar` 是一份写死的示例日历，站内没有任何入口指向它 — **需产品决策，不擅自选边**：页面里 9 条事件全部硬编码在 `2026-08-26 → 2026-09-05`，而它是 SSG 出来的，构建之后只会一天天变旧（今天 2026-09-23，整页没有一条还是未来的事）。本条先按「文案只说示例做得到的事」订正：标题下的说明与 `pageMeta.calendarDesc` 不再承诺「本周」，日期窗口改由数组算出（`src/lib/calendar-sample.ts` 的 `calendarSampleWindow()`），并补上「不会自动更新，也不构成任何投资建议」；`src/app/[locale]/calendar/sample-claims.test.tsx` 三条门禁禁掉时效承诺，并把窗口与列表首尾日期对死。剩下三条路要选：①接第三方财经日历 API（要数据源与密钥，站内目前只有币安公开行情，还要过一次合规判断）；②整页下线（零内部链接：`check:nav-chain` 不要求它、sitemap 不含它、页面本身 noindex，代价只是一个直接 URL 变 404）；③改成教学内容——讲「经济日历怎么读、为什么公布前后波动大」，与知识库既有的 `economic-calendar` 一课同源（`src/lib/quizzes.ts:1094` 挂着它的测验），不新增外部依赖。推荐 ③：把一份会过期的假数据变成一个不会过期的知识点。

- [x] R16.17 更新日志页把整部发布历史烤进同一份静态 HTML，发一版就长一截 — `/[locale]/changelog` 是 SSG 出来的，页面把 `src/data/release-notes.json` 里全部 13 个版本连标题带 5 条要点一次性渲染，于是路由体积随发布次数单调增长：v0.7.9 的发布记录本身（+6 条要点）把 `zh/changelog` 的 HTML 顶到 **45.7KB / 预算 45KB**，`check:bundle` 的 `static-info` 组第一次红。预算不是问题，**增长没有上界**才是问题——按这个斜率每发几版就要重谈一次预算。改为只列最近 `CHANGELOG_WINDOW = 8` 版，页面那句「本页只列最近 M 个版本，更早的 N 个版本完整记录在 CHANGELOG.md」的两个数字与渲染出来的 section 由 `changelogSurface()` 同一次返回（分成两个取值的话，句子迟早和列表对不上），并指向仓库里那份真正全量的 `CHANGELOG.md`。顺带把仓库地址收成 `src/lib/site.ts` 的 `REPOSITORY_URL`：`src/lib/jsonld.ts` 里本来私有一份同名常量，本页又要再写一次，三处链接现在共用一个字面量。验证：新增 `src/app/[locale]/changelog/changelog-window-claims.test.tsx` 4 条（渲染真实页面，section 数 = M、M+N = 发布记录总条数、两种语言各给出唯一的 CHANGELOG.md 链接、并断言数据确实多到需要折叠以免门禁空转），变异四组确认非空转（退回全量渲染 → 3 条红；窗口改成 13 不折叠 → 2 条红；N 写错 → 1 条红；M 写死成 7 → 1 条红）；`e2e/smoke.spec.ts` 原来钉死 `v0.6.0` 与其标题，那正是会滑出窗口的写法，改为从发布记录读最新一条并核对页面自己声称的 M/N 与真实 section 数。过程里被自己的门禁抓到的是一次误用探针：先按「版本字符串不该出现在页面上」断言折叠生效，结果 v0.7.2 的正文里就写着「`0.4.0`–`0.7.0` 属门禁上线前的遗留」——新版本提到旧版本号是正常叙述，折叠的判据只能是**结构**（那一版有自己的 section 吗）与版本标题，不能是裸版本数字。修后 `check:bundle` 回到 `static-info` 330.5/340KB 且此后与发布次数无关。后续收口（`refactor/changelog-older-line`）：那句话原先在页面里无条件拼好，再靠页面上一句 `older.length > 0` 决定渲不渲染——今天没问题，但「守卫」和「句子」是两处代码，谁把守卫挪走或改了条件，页面上就会出现「更早的 0 个版本」这种句子。改为 `changelogOlderLine(locale, surface?)`：没有可折叠的版本时**返回 null**，页面只判断有没有这句话，不再自己数第二遍；两个分支各有用例（含注入一个空 `older` 的窗口外场景），变异（撤掉 null 分支 / 条数 +1 / 窗口写死 9）分别转红

- [x] R16.18 时钟卫生台账上 10 处「真实定时器 + 不受控时钟」有 4 处是白等的睡眠，1 处的等待长度会悄悄失去效力 — `docs/test-clock-hygiene.md` 的 `uncontrolled-timer` 是一面报告式镜子（不阻断，逐条人工判断）。逐条看完的结论：**`bookmarks-client` / `newsletter-signup` / `onboarding-tour` / `invite-banner` 四个文件共 19 处 `await new Promise((r) => setTimeout(r, 30|50))` 全部删掉**——RTL 的 `render()` 本身就包在 `act()` 里，组件的 `useEffect` 在 `render()` 返回前已经跑完，这些睡眠不是在等任何真实的东西，只是在给抖动让路。删除后用变异证明断言没有被削弱：把 `invite-banner` 的「无 ref 也不显示」分支改成 `setRef("ghost"); setVisible(true)`，两条否定断言立刻转红（第一次我先只 `setVisible(true)`，而渲染门是 `if (!visible || !ref) return null`，变异压根不发生——**惰性的变异什么也不证明**，这条判断本身要连变异一起验）。`replay-trainer` 那处 700ms 是真的探针（暂停之后什么都不该再发生，方向上不会被慢机器冤枉），但它写死 700ms：倍速档位是 `SPEEDS = [1, 2, 4]`，tick 是 `1000 / speed`，哪天加一档 20x（tick 50ms）这句「等满两个 tick」就悄悄失效，于是改为 `1000 / Math.max(...SPEEDS) * 2 + 200`，并把 `SPEEDS` 导出成测试与组件共用的来源；变异（把 `return () => clearTimeout(t)` 摘掉）后该条转红。剩下 5 处明确保留：`reading-time` / `sync-layer-queue` / `sync-layer-write-failure` / `sync-queue` 是 0–1ms 的排空写法（巡检口径本身写明这类合法），`scripts/check-dark-pattern-copy.test.mjs` 那条命中的是被检查规则的**夹具字符串**，不是真定时器。台账 10 → 6。验证：`npm test` 282 文件 / 2721 条全绿，`check:test-clock-hygiene` 再生台账，`lint` / `typecheck` 干净

- [x] R16.19 断档恢复卡给用户立了一条代码里不存在的时间门槛 — 统计页的恢复卡写着「今天完成一件 **5 分钟**的小事，就算重新开始」（英文同位置写 `one small 5-minute task`）。连续天数不看时长：`touchStreak()` 是在记录学习活动时被调用的（`src/lib/progress.ts:87`、`src/lib/progress-helpers.ts:5`、`src/lib/wrongbook.ts` 四处），读完一课、复习一道错题、10 秒都算，字典里另一句 `streakReassureTpl` 写的「今天学一点就接回来」才是真规则。于是这句话立了一条比系统本身更严的规矩——只学了两分钟的人会以为自己的连续天数还没救回来，而这张卡恰恰是说给断档的人听的。改成「今天学一点，哪怕只读完一课，就会重新开始计数」，不报任何门槛。新增 `src/lib/streak-claims.test.ts`（3 条）：先自证禁令抓得住旧文案，再扫两种语言所有 `streak|recovery` 键在剥掉 `{n}` 代入值之后不得出现裸时间数字，并要求占位符仍是代入值；变异（中英各自把 5 分钟写回去）各转红一次。**顺手抓到一个更普遍的坑**：正则第一次写成 `/\d+\s*(分钟|秒|…|day|week)s?\b/i`，中文断言「通过」其实是假绿——CJK 不是 `\w`，「5 分钟」后面接「的」不构成词边界，`\b` 让整条正则对中文静默不匹配（旧文案因此漏网，靠"禁令必须抓得住旧文案"这条自证用例才暴露）。改用「数字 + 可选空格/连字符 + 单位，英文侧再用后瞻排除拉丁字母」的写法。验证：`npm test` 284 文件 / 2728 条全绿，`lint` / `typecheck` 干净

- [x] R16.20 隐私政策与服务条款页首行写死「更新日期：2026 年」 — 两个页面整页 SSG，这句话跨到 2027 年不会有任何人来得及改，而读者看 privacy/terms 恰恰就是拿这个日期判断条款是否现行。改为构建期用 `git log -1 --format=%cd -- <本页源文件>` 取真实最后修改日期（新增 `src/lib/legal-currency.ts`，两页共用一句措辞），**取不到就整句不出现**——浅克隆或没有 `.git` 的构建环境属正常，宁可不说也不补一个看起来合理的年份。`src/lib/legal-currency.test.ts` 3 条：禁令自证抓得住旧文案、两个页面不再出现写死年份且确实接到 `legalPageLead`、有历史文件给 ISO 日期而查不到时返回 null。实测构建产物：`zh/privacy` 写 2026-09-23、`en/terms` 写 2026-09-05（各自源文件的真实最后一次提交）。**本条自己的一个假前提被变异推翻**：我一开始认定 pathspec 里的 `[locale]` 会被 git 当字符集，于是加了 `:(literal)` 前缀并配一条「丢掉前缀日期会静默消失」的用例；把前缀单独摘掉重跑，三条用例**全部仍然通过**，直接跑 `git log` 也确认两种写法结果相同——那条用例永远不会红，属于「cannot-fail 的门禁比没有门禁更糟」，于是前缀和用例一起删掉，只保留路径两侧的引号

- [x] R16.21 死文案（字典里没人读的键）升级为预算式门禁 — 原本登记的是「先做成报告式台账，误报逐条豁免后再升级」。实际落地直接取严格那一头：`npm run check:dead-copy`（`scripts/dead-copy-lib.mjs` 判定 + `scripts/check-dead-copy.mjs` 落盘），**预算冻结在 0** 并接进 `ci.yml`，新造一个没人渲染的词条当场判失败，而不是写进报告等人来看。判定口径刻意保守——标识符在 `src/`（字典文件自身除外）、`e2e/`、`scripts/` 的**非测试**代码里出现一次就算活着，因为误报会把还在用的文案指使成「可删」；测试文件不算引用点正是本条的来由（`home.subtitle` 那批就是「只有自己的测试在读」）。首次运行抓到 4 条死键：`overviewLocal` / `noBadges` / `goalUnit` 只有 `stats-client.test.tsx` 的假字典在引用，`dataExportDone` 连假字典都没用到——四条中英两侧一起删除（403 → 399 词条）。两处防空转：提取到的词条数低于 300 即失败（字典结构变了或提取器坏掉时，台账会静默变成「零死键」），以及 `scripts/dead-copy-lib.test.mjs` 在夹具内部做正反对照（已知死键必须报出、已知活键必须不报，夹具不碰真实仓库，否则夹具里的键名会互相把对方判成「活着」）。变异三组确认非空转：往字典塞一条没人读的词条 → exit 1 且点名该键；同一词条被页面引用 → exit 0；把提取正则改坏 → 触发下限报警而不是假绿。`docs/ops.md` 门禁表同步登记（`scripts/ci-workflow.test.mjs` 有一条「ci.yml 每道门禁都要登记」的用例，第一次就是它把我抓出来的）

- [x] R16.22 FAQ「数据安全吗？」数完三类就收尾，漏掉隐私页自己写明的第四样东西 — FAQ 说「服务器上可能存在三类内容：登录邮箱、同步的学习进度、AI 评分与引用点击的匿名记录」，而隐私政策另有一段写崩溃诊断 `/api/error-reports` **会写入短期服务端日志**（`src/app/api/error-reports/route.ts:99` 只有 `console.info`，确实不落库）。按「存下来的东西」数，三类没错；按「服务器上可能存在的内容」数就少一项，而未登录用户看 FAQ 恰恰是在问「还有什么离开过我的设备」。现在 FAQ 两语都补上「以上三类是被存下来的内容；崩溃诊断另有短期服务端日志，不写入数据库」，把口径本身也写清楚。新增 `src/app/[locale]/faq/data-kinds-claims.test.tsx`（3 条，渲染 FAQ 与隐私页两个真实页面）：先用旧答案自证模式可分辨（旧文案必须**不**匹配，否则第二条断言空转），再要求两语 FAQ 都点名日志、并加一条跨页面一致性断言——FAQ 与隐私页对同一件事不许各说一套。变异：zh、en 分别退回旧答案，各 2 条转红

- [x] R16.23 AI 页副标题承诺「不预测」，而 prompt 里从 v1.0.0 起没有任何一条约束管预测 — `src/lib/i18n.ts` 的 AI 页副标题中英两处都写着「不荐股、**不预测**、只讲知识」/ `No stock picks, no predictions, just education.`。对上的实现只有两条：输入侧护栏 `src/lib/ai/guardrail.ts` 只拦 `stock-pick` 与 `profit-promise` 两类（`能涨多少`、`price target` 恰好落在收益承诺里，所以看起来像拦了预测），对话 system prompt 的五条约束是不荐股/不承诺收益/基于知识库/坦诚告知/用用户语言，**没有任何一条说不预测走势**。也就是产品替模型许了一个 prompt 里不存在的规矩；用户问「BTC 下周怎么看」，模型完全可以给一个方向判断而不违反任何约束。按 `prompt.ts` 文件头自己写的规矩（「改 prompt 先加版本、写 changelog，不直接改线上版本」）落地：新增 `SYSTEM_PROMPT_V2`（在原五条之上插入「不预测未来走势，不给目标价、也不给『该在什么时点买卖』；可以讲概率、风险与历史复盘，但要说成分析而不是预知」，后续条目重编号），注册 `v1.5.0` 并把 `PROMPT_VERSION` 指过去，`v1.0.0`–`v1.4.0` 原文保留不动（注册表是历史表，改它就等于伪造历史）。答案缓存键含 `PROMPT_VERSION`，因此旧缓存自然失效，不会把「没有这条约束时生成的回答」继续发给新用户。新增 `src/lib/ai/prompt-claims.test.ts`（3 条）把「文案承诺集合 ⊆ prompt 约束」做成门禁：先从真实副标题里数出三条承诺（文案改了而映射表没跟着改会当场失败），再要求每条承诺在当前 prompt 里有对应约束，最后一条是反向对照——旧版 `v1.4.0` **必须不**包含该规则，否则说明正则写宽了。变异四组：把 `v1.5.0` 指回旧 prompt → 2 条红；副标题去掉「不预测」→ 映射表计数红；把规则正则放宽成 `/教育者/` → 反向对照红；**还有一次变异打错文件（正则其实在测试文件里），exit 0 看起来像「变异存活」，其实是变异根本没落地**——needle 断言补上之后才看到真的红

- [x] R16.24 没有任何测试守着「词典占位符必须代入」，漏一个用户就看到 `{chapters}` — 这条约束早就写在 `src/app/[locale]/ai/page.tsx` 的注释里（「占位符漏到界面上，用户看到的就是『基于 {chapters} 篇章知识库』」），但全仓（含 e2e）没有一处断言守着它：词典与统计词典合起来 33 个占位符名、98 条带占位符的中英词条，每一处代入都是手写的 `.replace("{n}", …)`，删掉任何一处门禁照绿。新增 `e2e/placeholder-leak.spec.ts`（11 条，并补进 `package.json` 的 `e2e` 清单——`scripts/e2e-suite.test.mjs` 有一条「e2e/ 下每个 spec 都必须被脚本登记」的用例，第一次跑就是它把我这个新 spec 判红的）。判定按**占位符名**而不是整条模板，覆盖三条渲染面：459 个预渲染页面的可见文本、这些页面的可见属性（`placeholder`/`aria-label`/`title`/`alt`，读屏与输入框提示走这条通道，文本节点里没有它们）、6 个路由水合后的 DOM。词表从 `src/lib/i18n*.ts` 的取值递归抽出，另有一条用例把这份来源清单与 `scripts/check-dead-copy.mjs` 的字典文件口径对齐。**三处设计是被自己的变异逼出来的**：① 第一版按「整条模板逐字出现在产物里」判定，把 `/[locale]/path` 那句的 `{done}` 代入摘掉后产物扫描全绿——`{chapters}` 已代入，整条模板不再连续，「只代入一半」正是最容易犯的那种错，改成按占位符名判定才抓住；② 第一版只读 `i18n.ts`，把周报 `aria-label` 的 `{n}`/`{avg}` 代入摘掉后同样全绿，因为 `weeklySummaryTpl` 住在 `i18n-stats.ts`——于是有了那条清单对齐用例；③ 水合组一开始**完全空转**：无数据的访客态根本不渲染周报和趋势图（`role="img"` 在服务端 HTML 里就不存在），变异打在上面是空枪。现在 `openWithStudyHistory()` 先用 `addInitScript` 写 7 天 `tb-study-time` 台账（每天 1140 秒），并且有一条前置断言要求「由 `getStatsDict("zh").weeklySummaryTpl` 现场算出的那句周报文案必须出现在界面上」——水合或数据通路坏掉时这条先红，而不是让整组退化成一遍 chrome 文案复读。回访提醒 toast 单独一条：用 `sessionStorage` 的 `tb-return-nudge-pending` 触发，以 `data-testid` 可见作为「不是空跑」的证据。误报侧两处处理：① 知识库课文合法带着花括号（Python f-string 与 `1:{ratio}` 盈亏比标注），判定前先丢 `<pre>` / `<code>`；② **更新日志页渲染的是仓库原文**——git 提交标题与发布说明正文，本门禁上线第一天就把我自己的 commit 标题（`test(e2e): …界面上不许出现 {chapters}`）判成泄漏，`zh/en/changelog.html` 双双转红。这不是「关掉这条检查」的理由：自由文本与词典代入是两个不同的面，所以 `src/app/[locale]/changelog/page.tsx` 给提交标题与发布说明加了 `data-copy-source` 标记，巡检按标签配平整棵跳过（夹具自证同时防两种坏法：截不干净会让 `{avg}` 混进来，截过头会连兄弟节点的 `{n}` 一起没了）。RSC payload 里未代入的模板属正常，`<script>` 整段丢掉。**已知网外**：组件自建字典（`market-ticker.tsx` 的 `const DICT`，形状是 `Record<"zh"|"en", …>`，不在 `i18n*.ts` 口径里）只是它的 `{n}` 与词典重名才被顺带覆盖；`{max}` 这类只在 `src/lib/release-notes.ts` 出现的名字靠 R16.17 那条 e2e 数字正则兜着（`\d+` 不可能匹配 `{max}`）。变异三组各自转红：路径页文本 `{done}` → 产物扫描红；周报 `aria-label` → 水合组 `/zh/stats`、`/en/stats` 与那条数据文案用例一起红（产物侧不红，因为这些节点服务端不存在）；toast `{days}` → toast 用例红。**CodeQL 连着三轮把巡检器自己判成高危**：第一轮 `/<script[\s\S]*?<\/script>/g` 不带 `i`——HTML 标签名大小写不敏感，一个 `<SCRIPT>` 就能让未代入的模板留在扫描面上；补上 `i` 后第二轮判 `</script >`（`>` 前有空格）仍然绕过，改成 `<\/script\s*>`；第三轮判 `</script\t\n bar>`——闭合标签 `>` 前可以有任意空白与残留属性，最终定为 `<\/script[^>]*>`，`script` / `style` / `pre` / `code` 一并改。这三条和「标记取错」是同一类缺陷：**巡检器自己的漏检不会报错，只会一直绿**，所以三种绕过写法（大写标签、`</script  >`、`</code\n x=1>`）各配一条夹具反例，把 `[^>]*` 写回 `<` 反例当场转红。**元数据面同样在网内**：`<title>` 与 description 家族 meta（`description` / `og:description` / `twitter:description` / `og:title` / `twitter:title` / `apple-mobile-web-app-title`）走同一份 `withChapterCount` 代入，漏了用户在标签页和搜索结果里就能看到，而按「去标签取文本」的写法它们整段被丢掉——把首页 `generateMetadata` 的 `withChapterCount(t.metaDesc)` 摘掉做变异，产物扫描报出 `zh.html / en.html → {chapters}`，而在补这一面之前同样的改动是完全静默的。杂项 meta（`keywords` 等）刻意不收：那不是词典代入面。顺带订正一条我自己写错的记录：`40c0efa` 的提交信息把时钟卫生台账 286 → 287 归因于「新增 e2e spec」，但巡检器只收 `*.test.{ts,tsx,mjs}`，e2e spec 根本不在口径内；真实原因是 `src/lib/ai/prompt-claims.test.ts`（PR #218）落地时没人重算那份台账——这道「入库报告必须等于当场重算」的缺口另立 R16.26

- [x] R16.25 风险提示兜底「接了线」被当成「页面上有块」——红线只校验到源码字符串 — `check:risk-warning` 的阻断部分是 `auditFallbackWiring`：它读 `src/app/[locale]/knowledge/[chapter]/page.tsx` 与 `[doc]/page.tsx` 两份**源码文本**，要求出现 `shouldShowRiskWarningFallback(` 调用、出现 `<RiskWarningNotice`、且该调用点前 240 字符里有 `&&`。这三条全过的页面完全可以一个兜底块都不渲染：把判定写成 `false && shouldShowRiskWarningFallback(introContent)`，三个模式一条不缺，而 14 个上游不合规页面（12 review + 2 gap）界面上再无 ⚠️ 块。也就是说这条红线一直校验的是「代码里写了这件事」，不是「页面长这样」。改为对构建产物逐页核对：`auditFallbackRendering({ rows, readArtifact })` 拿同一批覆盖率记录（上游 pass / review / gap）算出**每一页应当有没有兜底块**，再与 `.next/server/app/<route>.html` 实际比对，两个方向都不许偏——上游缺块而页面无兜底 = 红线失守；上游已合规却仍叠块 = 重复展示。产物缺失（没 build 就乱跑）单独报一条，不静默通过。标记取 `<aside role="note">` 而不是「页面上有没有 ⚠️ 风险提示 字样」：实测 404 篇 pass 页面里 403 篇本来就带这个字样（正文自己的合规块标题），拿字样当标记会把「兜底没渲染」读成「渲染了」，这条判据由一条专门的用例钉住。`docs/risk-warning-coverage.md` 增加一行同次核对结论（418 页逐一比对、兜底块正好出现在 14 页、pass 页面零叠块），把报告里原本那句「两处接线由本门禁阻断式校验」变成真话。**门禁第一天就抓到东西**：变异把章节页的兜底判定改成 `false && …`，源码侧三条模式检查照绿，产物侧报出 14 条并 exit 1；恢复后 `check:risk-warning` exit 0。另加 6 条 `scripts/risk-warning-lib.test.mjs` 用例（路由映射、双向判定、标记判别、产物缺失不静默）。`docs/ops.md` 里「按序重跑七份内容报告」那一行补上前置条件：这一道现在要求先 `npm run build`，否则拿到的是「找不到构建产物」而不是静默通过。上游那 2 个 gap（`technical-analysis` 中英两侧的 README 本体）仍需在 kline-buty 仓库补标准块，本仓不改 submodule 内容——站内兜底已保证红线不裸奔，所以这一项继续留在报告里而不是阻断。

- [x] R16.26 报告式门禁会静默过期：入库台账停在 286，而当场重算是 287，CI 一路全绿 — R14.5 把 `docs/*.md` / `docs/*.json` 那批报告做成幂等写入（`report-write-lib.mjs` 的 `writeReport`：日期归一化后内容相同就不重写），它自己的注释写着「让『门禁跑完工作区应当干净』这类断言终于可能成立」，但**从来没有人真的去断言**。于是 CI 每次都把过期报告重写一遍、丢在工作区里蒸发：`src/lib/ai/prompt-claims.test.ts`（PR #218）新增了一份测试文件，`docs/test-clock-hygiene.md` 的「扫描测试文件」当场重算就是 287，入库版本仍是 286，之后连绿的 CI 一次都没提过这件事。报告式台账的全部价值在于「它是真的」，静默过期比没有台账更危险——读的人会以为那是当前状态。新增 `npm run check:report-freshness`（`scripts/report-freshness-lib.mjs` 判定 + `scripts/check-report-freshness.mjs` 落盘）：报告清单**由机制推导**而不是手维护——谁的源码里调了 `writeReport(`，它 `path.join(root, "docs", …)` 的路径就进清单（当前 17 份）；这个定义域顺带把按日追加的历史快照（`kb:translation-status`、`kb:diff`）排除在外，那些文件里日期本身就是数据，CI 跑一次就会合法地改动它们。判定用 `git status --porcelain -uall -- <清单>`：被改写的即过期，清单里在仓库查不到的即「新报告忘了提交」，两种都 exit 1 并点名文件；推导结果为空也判失败（`inventory-too-small`），否则巡检器自己坏掉的样子就是「零份要核对，全部通过」。排在 CI 所有报告步骤之后（`check:dead-copy` 那一步以后），`docs/ops.md` 门禁表同步登记（`scripts/ci-workflow.test.mjs` 逐条比对 ci.yml 里出现的 `npm run`）。防空转两处：8 条 `scripts/report-freshness-lib.test.mjs` 用例（两种 `path.join` 写法、非幂等写入器不产出、rename 取新路径、清单为空即失败），以及一次真实变异——把 `docs/test-clock-hygiene.md` 的 287 改回 286，门禁 exit 1 并点名该文件，改回即 exit 0。本条落地时又现场演示了一次这个缺口：新增那份测试文件让扫描数变成 288，同一次提交里得把台账再生一遍，否则新门禁立刻把自己判红

- [x] R16.27 CONTRIBUTING 让贡献者 `cp .env.example .env.local`，可这个文件从来没入库 — `.gitignore` 第 34 行是 Next 模板原样的 `.env*`（注释还写着「can opt-in for committing if needed」），**没有** `!.env.example` 例外，`git ls-files` 里也没有这个文件；而 `CONTRIBUTING.md:29` 第一步就是 `cp .env.example .env.local`，`docs/v0.6-release-review.md:117` 更写着「受版本控制的只有 `.env.example`」。三处说法里只有 CONTRIBUTING 是要人执行的动作，所以新贡献者照做会 `No such file or directory`——`docs/env.md` 那份权威说明读得到，但没人会先想到要照着手抄 13 个变量。修法取「让说法变成事实」而不是改历史记录：`.gitignore` 补 `!.env.example` 并入库该文件（值全是占位符：`https://your-project.supabase.co`、`your_anon_key`、`gpt-4o-mini`、`text-embedding-3-small`，逐个核对过不等于本地 `.env.local` 的真实值，`check:secrets` 现在扫得到它且 0 findings）。只入库还不够——**没有门禁保证它不腐烂**，下一个新增变量的 PR 就会让它重新变成假话，所以把 `check:env-docs` 从「代码 ↔ docs/env.md」两方扩成三方：`extractExampleVars` 收 `.env.example` 的键（`# KEY=` 这种注释掉的可选变量同样算登记），代码读取的每个运行时变量必须在示例里出现，示例里的每个键必须真的被代码读取；`run()` 额外要求文件存在，缺席即 `exit 1`（正是今天的状态）。两侧今天恰好一一对应（13 ↔ 13），门禁即刻通过，并以 `extractExampleVars(...).size === required.length` 作为防空转。`docs/env.md` 开头那句「本文件是唯一受版本控制的环境变量说明，`.env*` 全被 gitignore」同批改掉——它描述的正是那个让 CONTRIBUTING 落空的规则。测试 +4 条（缺键、幽灵键、注释行算登记、CLI 分支含「文件不存在」），变异三组各自转红：删掉示例里的 `AI_MODEL` 行 → 「.env.example 未列出 AI_MODEL（代码在读取它，见 src/lib/ai/client.ts）」；加一行 `AI_RETIRED_KEY` → 幽灵条目；把 `.env.example` 改名 → CLI 分支报「不存在」而不是静默通过

- [x] R16.28 课末「问 AI」按钮对**任何登录过用户都不提问** —— 两个入口把问题写进 URL，接收端只在「没有云端历史」时才读它 — 生产 `?q=` 的地方有两条：`src/app/[locale]/knowledge/[chapter]/[doc]/page.tsx` 的 `LessonAskAi`（`?q=帮我总结《X》的要点&ctx=章节&ct=标题`）和 `src/components/review-client.tsx` 错题卡上的「问 AI」。而 `src/components/ai-chat.tsx` 的挂载 effect 拉完 `/api/ai/conversations` 后写的是 `if (data.messages?.length > 0) { setMessages(…); return; // 有历史就不走 ?q= 自动发送 }`——只要这个人以前问过一句 AI，恢复出的历史就让 `return` 提前结束，`q`/`ctx`/`ct` 三个参数一次都不解析。用户看到的是一根按了没反应的按钮：回到旧对话、问题蒸发、连「正在基于《X》篇章回答」的横幅都不出现。FAQ 那边还写着「每篇课程页面底部有 AI 对话入口，可以提问课程相关问题」，入口确实在，提问不在。修法分三层，缺一不可：① 参数解析移到 fetch 之前，`ctx`/`ct` 无条件应用（横幅与历史无关）；② 消费完就用 `history.replaceState` 把地址栏清回 `pathname`——这不是顺手优化，③ 引入自动发送后若不抹参数，刷新会把同一个问题再问一遍并再扣一次配额（有历史的用户原本靠那个 `return` 侥幸免疫，改动反而把这个侥幸拿掉了）；③ 问题交给 `pendingAskRef` + `historySettled` 之后的独立 effect 发出。**为什么不当场 `send()`**：`send()` 读的是渲染期闭包里的 `messages`（`[...messages, userMsg]` 与 `messages.length + 1`），在 `setMessages(历史)` 之后同步调用会发出一份只剩新问题的 history、并把流式填充的下标指错，而 R1.8 的多轮护栏正建立在这份 history 上。用例侧：原有那条「恢复云端历史时……**不触发** ?q= 自动发送」是把 bug 写成了规格，改成要求 `body.messages` 精确等于「历史两问 + 新问题」三条按序；另加一条以第二次 GET 历史为同步点，断言重新挂载（等价刷新）不再发第二遍。**变异三组**：把发送挪回异步块里直接 `send(…)`（最自然的错误修法）→ 用例红，且历史里的 `suggested` 推荐链接一起消失，正好证明它把历史冲掉了；退回 `return` 旧行为 → 等不到「自动回答」；删掉 `replaceState` → `window.location.search` 断言红。落地时先写成 `pendingAsk` state、在 effect 体内 `setPendingAsk(null)`，被 `react-hooks/set-state-in-effect` 判红（渲染期不得在 effect 体内直接 setState），换成 ref + 异步续体里置位的布尔标志，同步点不变。47 条 `ai-chat` 用例、288 文件 2752 条单测、`npm run build`、`check:risk-warning`（418 页产物核对）/`check:env-docs`/`check:dead-copy` 三道门禁全过

- [x] R16.29 占位符巡检自己记下的那条「已知网外」：组件自建字典不在词表口径里，界面上一个陌生名字的 `{占位符}` 没人管 — R16.24 按**已知占位符名**判，词表从 `src/lib/i18n*.ts` 推导，所以形状不是 `i18n*.ts` 的字典（`market-ticker.tsx` 的 `const DICT: Record<"zh" | "en", …>`）整个在网外——它当时只是恰好有个 `{n}` 与词典重名才被顺带覆盖；换成 `{slowSeconds}` 这种词典里从没出现过的名字，删掉 `.replace()` 后 459 个页面全绿。收口前先看误报代价：把通用模式 `\{[a-zA-Z_][a-zA-Z0-9_]*\}` 直接套到全部产物上，命中只有 `zh/en` 两个 changelog 页的 git 提交标题（仓库原文，`data-copy-source` 本来就跳过），**38 个界面页零误报**——因为界面侧没有任何合法的花括号用法，合法用法全在知识库课文里（`1:{ratio}` 盈亏比、Python f-string）。于是分两档而不是换一档：词典词表继续覆盖所有页面（知识页只认这一档），界面页在其上再叠「任何 `{名字}` 都算泄漏」。**两档的差别必须有证据，否则严格档可以空转**：① 夹具成对——同一个 `{slowSeconds}`，词表档判 `[]`、严格档判 `["{slowSeconds}"]`；② 分类不许塌——`pages.filter(非知识页).length ≥ 30` 且知识页 `> 400`，防止「全部划成知识页」把严格档静默清空；③ 六条水合用例各自先 `expect(isKnowledgePage(route)).toBe(false)`，路由挪进知识库时当场红，不是悄悄降级。**真实产物上的双向变异**（不是只在夹具里自证）：往首页 zh 文案塞一个字面 `{unknownTickerTpl}` → `npm run build` → 产物扫描红，报 `zh.html → {unknownTickerTpl}（界面页严格口径）`；再把判定里的 `{ anyBrace: strict }` 写回死的 `false`（即旧那一档），同一份带泄漏的产物**完全静默通过**——这才说明抓到它的是新加的严格档，不是词表档。恢复源码后重跑：本 spec 11 条 + 全量 `npm run e2e` 全绿

- [x] R16.30 `docs/ops.md` 门禁表只防「漏登记」，不防「幽灵登记」——删掉一道流水线步骤，文档还说它在防 — `scripts/ci-workflow.test.mjs` 只有一个方向：ci.yml 里跑的每道门禁都必须在 `docs/ops.md` 表里出现（R16.21 落地时就是它把我抓出来的）。反向没有覆盖：**从流水线里删掉、却留在表里的命令**不触发任何失败。读者判断「本站被什么防着」看的就是这张表，所以一条幽灵记录比从没登记更糟——它读起来像还在防，实际什么都没跑。新增 `门禁表不登记 ci.yml 里没有的命令`，两个方向共用同一份 `gateIdentifierOf`（命令 → 标识）映射，否则两套规则会各自漂移（原 `ciGateIdentifiers` 就地改为调用它，19 条旧用例全部照绿，说明映射等价）。这条还把「命令形状却没被认出」单独判失败：按 `null` 静默跳过意味着表格里写 `npm run e2e -- --project=chromium`（带参数）就能把幽灵门禁放回来。防空转：映射器必须真的认出 ≥ 40 条（实测 49 条命令 + 6 条 `db-tests`/`actions/checkout` 这类标签）。变异两组：只加一行 `npm run check:retired-gate` → 本条红、点名「门禁表第 56 行」，**其余 20 条全绿**（漏登记与顺序校验都不反应，证明取的确实是 `ops ∖ ci` 而不是把两个方向混在一起）；再加一行带参数的命令 → 落进「没被认出」那一支而不是静默通过。今天两侧一一对应，所以这条是防护性收紧，不修现存问题；用例数 19 → 21

- [x] R16.31 移动端溢出巡检量的 10 个页面**全是 `/zh`**，其中一个根本不是页面——`docs/ops.md` 却写着「14 个关键 zh/en 页面」 — 三处各自独立地不成立：① `e2e/mobile-overflow.spec.ts` 的 `CORE_PATHS` 有 10 条、没有一条是 en，而门禁表说覆盖 zh/en，en 的字符串普遍更长、溢出风险更高，那一侧从来没被量过；② 清单里的 `/zh/feedback` 在站内根本不是一页（只有 `POST /api/ai/feedback` 与 `/api/ai/feedback/export` 两个接口），它返回 404，而 404 页永远不横向溢出——这条用例一直在测 404 页并且永远不会红，属于「cannot-fail 的门禁比没有门禁更糟」；③ 数字本身对不上，14 既不是 10 也不是别的什么。修法分两层：**让说法变成事实**——清单改成 `CORE_SUFFIXES × LOCALES`（真的两语，10 条 × 2 共 20 条），`/feedback` 换成 `/chart`（最宽的交互界面，且此前只在后面的交互用例里出现）；**让同类错误不可能再静默发生**——`expectNoPageOverflow()` 先断言 `page.goto()` 返回 200，把「死路径冒充覆盖」本身变成失败，再加一条清单前提用例（每种语言 ≥10 条），塌回单语时当场红。`docs/ops.md` 那一行不再写死数量（`≥10 条核心路径 × 全部语言（CORE_SUFFIXES × LOCALES 生成）…清单里每条路径还必须真返回 200`），因为写死的数字就是下一次漂移的种子。**变异**：把 `/feedback` 塞回清单 → zh 与 en 两条各自转红，报「`/zh/feedback` 未返回 200（清单里混了不存在的路径）」；恢复后 20 条全绿。en 一侧实测没有藏 bug（10 个页面在 320px 下均无页级溢出），但从这条起才算真的覆盖到

- [x] R16.32 冒烟断言的条数在两份文档里各写一次，代码加一条探针不会有任何东西变红 — `docs/ops.md`「生产冒烟」写着「跑 10 条只读断言」，`docs/release-checklist.md` 又写一遍「这 10 条断言不是随手挑的」。这个数字由 `scripts/prod-smoke.mjs` 的 `buildChecks()` 现场决定：往后加第 11 条探针，两份文档会一起变成过时的说法，而读者正是拿这句话判断生产冒烟覆盖多宽（R16.30 是命令列的同族问题，这次在描述列）。今天两侧恰好都是 10，所以这条**不修现存错误**，只把「文档 == 代码」钉住：新增一条用例直接数 `buildChecks({ expectedVersion }).length`，再用正则从两份文档里抓出各自写明的数字逐个比对。措辞本身也被钉：正则匹配不到「N 条只读断言」这句话时用例判**失败**而不是跳过——否则把句子改写成「跑若干条断言」就能静默绕过。变异三组：① `docs/ops.md` 改成 11 条 → 「docs/ops.md 写着 11 条，buildChecks 实际产出 10 条」；② 把那句话改成「跑若干条只读断言」→ 落进「找不到『N 条断言』这句话……不许把数字藏起来」那一支；③ 真往清单里加一条探针（最贴近未来的真实漂移路径）→ 「docs/ops.md 写着 10 条，实际产出 11 条」。`scripts/prod-smoke.test.mjs` 用例 24 → 25，不新增测试文件，时钟卫生台账与 `check:report-freshness` 均无需再生

- [x] R16.33 登录用户点「清空对话」只清掉了屏幕：下一次进页，最近 50 条历史整段回来 — `src/components/ai-chat.tsx` 的 `clear()` 过去是三行本地状态（`setMessages([])` / `setError(null)` / `setFeedback({})`），而挂载时 `GET /api/ai/conversations` 会从 `ai_conversations` 倒序取最近 50 条（25 轮）填回去，所以按钮承诺的「清空」在服务器上一次都没发生。**同一类缺陷本站已经修过两次**：错题本 `src/lib/wrongbook.ts:206`「只删本地=没删：下次 hydrate 会把整本错题拉回来」、`src/lib/sync-layer.ts:176`「用户视角里『清空』等于没生效」——两处注释写得很清楚，AI 对话是这条口径剩下的最后一个入口，而 `docs/privacy` 又明确把「AI 对话记录」列在账户存续期间的云端数据里。修法分三层：① 新增 `DELETE /api/ai/conversations`（`getServerAuthUser()` 抛错→500、无身份→401、独立限流 `guestLimit: 0 / authedLimit: 10`→429 带 `Retry-After`），删除语句只带 `.eq("user_id", user.id)` 一个条件——服务端客户端不受 RLS 约束，这个条件就是「只删自己的」唯一的闸，漏掉它等于删全站；② 客户端 `clear()` 改为等这个请求，失败时把 `dict.clearFailed`（zh「云端对话未能清空，请稍后再试」/ en 对应）显示出来——云端没删成却说「已清空」是最坏的一种静默失败；游客本来就不落库（隐私页也是这么写的），`if (!auth?.id) return` 直接跳过，不发无谓的删除请求；③ 补上流式竞态：回答还在返回时点清空，`runStream` 结尾那发 fire-and-forget 归档 POST 会把刚清掉的那一轮原样写回云端，所以 `archiveGenerationRef` 在 `clear()` 里先自增、`runStream` 开头取快照，POST 只在代际未变时发出。**变异三组，每组只红它该红的那条**：DELETE 换成假 `{ok:true}` → 「点清空连云端一起删」与「云端没删成时说未能清空」两条转红；`if (archiveGenerationRef.current === generation)` 写成 `if (true)` → 只有「回答还在流式返回时点清空，那一轮不再被写回云端」转红；去掉 `if (!auth?.id) return` → 只有「游客清空不发删除请求」转红。新增 5 条接口用例（200 且 `.eq` 收到 `user_id`、游客 401 且不触库、身份异常 500、删除失败 500 且不泄露库内文案、连点 11 次第 11 次 429）+ 4 条组件用例；`route.test.ts` 25 条、两份 `ai-chat` 用例 55 条、全量 289 文件 2774 条、`lint`、`typecheck` 全绿

- [x] R16.34 手册转述的巡检参数没人核对：代码改了超时，`docs/ops.md` 还写着旧的那个数 — R16.31/R16.32 连着抓了两次「文档写死数字、代码说了算」，同一形状还留在 `docs/ops.md` 的三段说明里：同义词「等 25 组」、FAQ 候选「近 30 天 / ≥3 次 / 截到 80 字符」、外链巡检「10s 超时 + 网络错误重试一次」。逐条核对今天全部为真，但**没有任何一处比对**：`K_MIN_COUNT`、`MAX_QUESTION_LEN`、FAQ 窗口、`checkExternalLink()` 的默认参数都是代码里的常量或形参默认值，改它们不会让任何门禁变红，而读者判断「巡检到底防到什么程度」看的正是这段话。更糟的是外链那两个默认值更没有对手：`scripts/link-patrol.test.mjs` 里唯一核对超时的用例把 `timeoutMs` 显式覆盖成 1s，所以 `10_000` 与 `retries = 2` 只是「被用到」，从没被任何断言读过。修法两步：① 让数字有名字（`WINDOW_DAYS`、`MAX_QUESTION_LEN` 导出，`DEFAULT_TIMEOUT_MS`/`DEFAULT_ATTEMPTS` 从形参默认值里提出来，仍由 `checkExternalLink` 使用）；② 新增 `scripts/ops-patrol-claims.test.mjs`，把六处转述逐条钉回常量——组数从 `search-synonyms.ts` 现场数（不是抄另一个数），重试次数认中文数词（「重试一次」而不是 `retries === 2`）。**防空转按 R16.29 的老规矩**：正则抓不到句子本身判失败（改措辞不算绕过），另加一条前提用例要求组数 ≥ 20、核对项 ≥ 6，防止解析器退化成拿 `null` 比 `null`。**变异三组**：文档 `等 25 组`→`等 26 组` → 红，报「文档写 26，代码是 25」；`DEFAULT_TIMEOUT_MS` 10s→15s → 红，报「文档写 10，代码是 15」；删掉一个同义词组 → 红，报「文档写 25，代码是 24」。恢复后 `docs/ops.md` 补一句指路：这些数由该门禁钉住

- [x] R16.35 点「继续生成」补出来的那半截答案，从来没进过云端 —— 续写那一发归档发的是空问题，而端点把空问题判成畸形载荷直接 400 — `src/components/ai-chat.tsx` 的 `continueGeneration()` 给 `runStream` 传 `userMessage: ""`，`parseSaveBody()`（`src/app/api/ai/conversations/route.ts:44`）对空问题 `return null` → 400；这条判定早就被 `route.test.ts` 钉住了，钉不住的是客户端：归档是 fire-and-forget 且 `.catch(() => {})` 从不看状态码，于是「补全的答案」永远不落库。同一处还连着另外两个缺口：① 存档写的是 `stripTruncatedMarker()` 之后的干净文本，`truncated` 只活在内存里那一轮 → 恢复出来永远是不截断，半截答案在界面上读起来像说完了，而「继续生成」的入口彻底消失（缓存命中那一侧专门测过要留着这个入口，落库这一路却没人管）；② 续写跳过检索所以响应没有 `X-Sources`，就算内容存下来，来源链接也会丢。修法：续写的归档带上**这一轮的问题与来源**（往前找最近一条 user 消息，找不到就干脆不发——发了必是 400，静默失败比不存更糟）；归档保留截断标记，恢复时用它决定「这一轮还没说完」并把按钮给回来；同一问题连续出现且前一份带截断标记时折叠成最新的一份——用户真的把同一个问题问两遍不折叠，这条边界正反各钉一次。**变异五组**：`userMessage: question` 退回 `""` → 两条转红（存档内容条数与来源）；`sourcesArr ?? opts.archiveSources` 退回只读 `sourcesArr` → 来源那条转红；`assistantMessage: rawFull` 退回 `fullResponse` → 「存档里必须还看得到标记」转红（第一次跑这一步时它**仍然全绿**：恢复端是用带标记的夹具直接喂的，归档端没人钉，补上这条断言后才红）；去掉折叠 → 折叠用例转红；把折叠条件里的 `truncated` 判据拿掉 → 「问两遍不折叠」转红。新增 5 条用例，`ai-chat.test.tsx` 52 条、`test:coverage`、`lint`、`typecheck` 全绿

- [x] R16.36 报告新鲜度门禁只说「过期了」，不说该跑哪一条 —— 这条门禁今天连抓我两次，第一次拿到消息时并不知道去哪儿重算 — `docs/ops.md` 的门禁表只登记「谁在 CI 里跑」，而 R16.26 那条门禁的失败输出是「入库版本过期，把重算结果一起提交」：17 份报告分属十几个巡检器，读者得自己回去翻表、再猜是哪一份写的那一份。#234 与 #235 各撞一次（新增一个测试文件就得把 clock-hygiene 台账一起提交），两次都靠人肉定位。修法：失败信息里直接给出重算命令。`collectReportProducers()` 与 `collectReportInventory()` **共用同一次扫描**（`scanReportPaths()`）——两份视图各扫一遍就是下一次漂移的种子，所以新增一条用例要求「清单里的每一份都有出处、出处里也没有清单外的份数」；runner 从 `package.json` 反查脚本名，对不上时退回 `node scripts/<路径>`，两种写法都各有用例。**端到端验**：临时塞一个测试文件让台账过期 → `check:report-freshness` exit 1，输出第二行就是 `重算：npm run check:test-clock-hygiene，然后把新内容一起提交`；删掉临时文件后门禁回到 0。**变异两组**：`collectReportProducers` 扫空集合 → 两条映射用例转红（含那条防漂移的）；命令名解析写死 `undefined` → 消息用例转红，退回到只报文件名的旧形状。用例数 8 → 10

- [x] R16.37 对本地构建冒烟时，量到的可能是上一次留下来的旧服务——旧构建的缺陷会被算成本次的红，本次的缺陷会被藏成绿 — v0.7.11 发布核对时踩到：`npm run build` 后 `npm start -- -p 3111`，但 3111 上还驻留着更早一次验证留下的进程（`lsof` 显示 PID 86686 先占了端口），新起的进程没绑上端口，`ops:smoke-prod` 于是打到那份**旧构建**上，报「`/zh/changelog` 里没有 0.7.11，生产构建落后于 main」。这句话在本地语境下完全错指——本地根本没有「部署」可言；而同一形状反过来更危险：旧构建若把某个真缺陷修掉了（或还没引入），冒烟会给出一个漂亮的绿。核对本身没有分辨力，等于把发布判断交给进程列表。修法是在跑断言之前先问「量的是哪份构建」：本地目标（`localhost` / `127.0.0.1` / `::1`）额外要求响应 HTML 含当前 `.next/BUILD_ID`，对不上就 exit 1 并说明多半是端口驻留，**十条断言一条都不跑**（跑完再解释只会让人去查站内代码）。生产域名不做这项核对，也不去读 `.next`。**证据取自真实现场**：那份旧服务返回的 HTML（当场抓取留存）里确实不含现在的 `GcsLcSebH2yl0IUigAQfE`，判据对它返回「过期」；恢复服务后本地复跑 **10/10 全绿**，其中 `POST /api/ai/chat 游客` 通过而生产同一探针 502 —— 这才把「生产红项属上游配置」从推断变成实测。**变异两组**：把这段核对短路成 `if (false)` → 「驻留旧构建退出 1」与「标识对得上照常跑完」两条转红；把判据写死 `return false` → 「判据本身」与「驻留旧构建」两条转红。新增 4 条用例（判据四分支 + 三种目标形状），`prod-smoke.test.mjs` 25 → 29 条；`docs/release-checklist.md`「已知陷阱」与 `docs/ops.md` 的冒烟用法行同步写明
- [x] R16.38 回放「截止日期」一个输入框两套口径：界值与界外都按 UTC 划，UTC+8 用户每天前 8 小时划不到今天，划到的那天又少掉后半段 — `src/lib/date-utils.ts` 顶部写着 `localDateStr` 是全站今天口径的唯一出口（R4.8），`src/components/replay-trainer.tsx` 的自定义回放日期却没走它：`max` 与初始值都取自 `new Date().toISOString().slice(0, 10)`，对 UTC+8 意味着每天 00:00–08:00 那 8 小时里本地今天还被算成昨天，选择器把当天划在界外；同一格子里点「开始回放」再用 `Date.parse(value + "T00:00:00Z")` 把本地日历日读成 UTC 午夜，窗口上界落在本地 08:00，那天剩下时段静默消失（纽约 9 月是 UTC-4，上界甚至是本地前一天 20:00）。文案承诺一个日历日，代码给的是一个时刻。改法：上限与初始值走 `localDateStr()`（初始仍往前 30 天），换算新增 `localDayEndMs(dateStr)`——先过 `isLocalDateStr`（拒 2026-02-31 这类会滚到邻近日的写法），再取该本地日 23:59:59.999；返回 NaN 继续沿用组件里已有的非法输入分支，校验点仍只有一处。验证：`src/lib/date-utils.test.ts` 新增 3 条，`src/components/replay-trainer.test.tsx` 新增 2 条并改写 1 条既有断言（两文件 41 条绿，全量 290 文件 2794 条绿）；组件测试 mock `@/lib/date-utils` 时保留真实校验、只把结果换成 UTC 换算不可能命中的哨兵，否则「上界取本地日结束」会被 UTC 正午的巧合值蒙过。变异六组逐条点名：`max` 退回 `toISOString()` → 上限/初值那条红；初值退回 UTC → 两条红（含「往前 30 天」那条）；换算退回 `Date.parse(…T00:00:00Z)` → 自定义截止那条红；摘掉 `isLocalDateStr` 守卫 → NaN 那条红；改用 `Date.UTC(…)` 字段 → 2 条红；改成当日 00:00 → 2 条红。后两组只有跨时区才判得动：CI 恒为 UTC，那里「本地」与「UTC」不可区分，所以用例显式钉住 Asia/Shanghai 与 America/New_York 各一侧。台账 `docs/test-clock-hygiene.md` 因插入行号位移，重算入库
- [x] R16.39 `Kline.time` 注释写着「UTC 秒」，代码却减掉 8 小时，而第二条路自己又抄了一遍这个减法 — `src/lib/binance.ts` 里 `time: number; // UTC 秒` 与下一行的 `- 8 * 3600`（注释「对齐到 UTC+8 展示习惯」）互相矛盾：lightweight-charts 按 UTC 渲染时间戳，为了让横轴读起来像北京时间，REST 侧交出去的值已经被挪过一截，它只是一个展示坐标，谁按字面意思拿去和 `Date.now()` 相减就会差 8 小时。更要紧的是这个位移在 `src/components/kline-chart.tsx` 的 WebSocket 分支里手写复刻了一份（实时帧自己 `- 8 * 3600`），而 `update()` 靠 `time` 认它该覆盖哪一根——两条路口径一旦错开，实时帧就对不上最后一根。既有测试恰好覆盖不到这层耦合：REST 侧用字面量钉住了位移，WS 侧那条断言写的是 `expect.objectContaining({open,high,low,close})`，把 `time` 漏在外面，等于两份位移没有任何东西在核对。取证脚本自己也出了一处事故：变异矩阵收尾用 `git checkout` 还原测试文件，连带清掉了本轮尚未提交的编辑——快照必须在 mutating `sed` 之前取、还原要用反向替换，事后靠留在 `/tmp` 的副本重放并复跑套数与变异矩阵，才确认还原没有丢东西。改法：`DISPLAY_TZ_OFFSET_SEC` 作为唯一出口从 `src/lib/binance.ts` 导出，REST 与 WS 两条路共用，字段注释改成「展示坐标，见 DISPLAY_TZ_OFFSET_SEC」并写明不能与真实 epoch 相减；测试侧把 `vi.mock("@/lib/binance")` 换成 `importActual` 打底、只桩 `fetchKlines`（整模块替换会让常量由 mock 自己声明，改真值也测不出来），再给 WS 断言补上 `time`。验证：两文件 40 条绿；变异三组——常量改成 7h 时 REST 与 WS 两条同时红（跨文件核对成立）、WS 侧去掉位移只红 WS 那条、把期望写成不位移也红同一条（证明新断言判得动而不是恰好相等）
- [x] R16.40 `src/lib/date-utils.ts` 自称全站「今天」的唯一口径，清点时库房里其实有七份私有副本 — 修完 R16.38（回放截止日期走了 UTC）再回头看这句话，数出来的完全不是「唯一」：`src/lib/daily-goal.ts` 的 `todayStr()`、`src/lib/weekly-summary.ts` 的 `toDateStr()`、`src/lib/activity-calendar.ts` 的 `todayStr`（这个最离谱，文件第 6 行就写着 `import { isLocalDateStr } from "./date-utils"`，同一份文件一半用共享校验、一半自己拼日期）、`src/lib/review-reminder.ts` 里一个与 owner **同名**的私有 `localDateStr`、`src/components/activity-heatmap.tsx` 与 `src/components/review-client.tsx` 的行内拼装，外加 `src/lib/streak.ts` 的 `getRecentDays()`。七份今天恰好都等价（全是本地字段 + 补零），所以没有一条测试会红——问题不在今天，在于修口径时只修得动一份，而 `src/lib/streak.ts:24` 早就给出了正确写法（`const todayStr = () => localDateStr()`）。改法分两步：① 七份全部删掉，消费方一律调 `localDateStr`；② 加门禁防止第七份长出来。判据的形状是教训：**第一版正则按整行模板字面量写，`streak.ts` 那份把年、月、日拆成三个变量再拼，根本扫不到**——我是对 `padStart(2, "0")` 重扫一遍才发现它的，所以最终判据盯「补零的日历字段」这个形状而不是任何一种写法（本地字段与 `getUTCMonth` 一并列入），另加一条 UTC 侧形状：`toISOString().slice(0, 10)`、`substring(0, 10)`、`slice(0, -14)`、`split("T")[0]`、`toJSON()` 五种拼法说的都是同一件事，即 R16.38 的原始病灶。新 `src/lib/date-caliber.test.ts` 是 vitest 内的清单式核对（照 `chart-symbols` 那套），不占 CI 步骤：扫描面本身 `> 100` 文件（防空转）、owner 里构造式恰好一处、四条正则各自先证明抓得住对应的旧写法、用到 `localDateStr` 的文件必须真从 date-utils 导入。变异九组逐条点名：注入整行拼法、拆分拼法、`getUTCMonth` 字段拼法各红扫描那条；注入 `slice(0, 10)` / `substring(0, 10)` / `slice(0, -14)` / `toJSON()` 四种 UTC 切法也各红扫描那条；消费方删掉 import → 导入核对红；owner 里出现第二处构造式 → 持有者那条红；还原一律用事前 `cp` 的副本并以 md5 核对。全量 291 文件 / 2798 条绿；`docs/test-clock-hygiene.md` 因新增测试文件重算（289 → 290），这次 `check:report-freshness` 直接把「去哪儿重算」说出来了——R16.36 的收益当场兑现
- [ ] R16.41 中文链接坏了，404 却用英文回答：`/zh/nope` 整页英文，连「返回首页」都指向 `/en` — 实测（本地 `next start`，`.next/BUILD_ID` = `5ubDabIXJDSSGd6GlFrbA`）：`/zh/nope` 与 `/zh/auth/nope` 都是 HTTP 404 + `<html lang="en">`，页面上唯一的中文字是那句装饰性 tagline，三个 CTA 与六张入门卡全部链向 `/en/...`，等于把中文用户从自己的 locale 里送走。站内那批**软** 404（未知章节 / 未知课程）反倒是本地化的（`chapter-no-result-cta` 链向 `/zh/search`，e2e 已钉住），坏的只有路由层这一张。**为什么不是顺手改**：App Router 的 `not-found.js` 只在段内调 `notFound()` 时渲染，而未匹配的 `/zh/*` 属于路由层，落到根级 `app/not-found.tsx`，那里没有 locale 上下文，只能取 `DEFAULT_LOCALE`（现有 e2e 也是按「locale -less 的 URL → 默认语言」钉的，那条没错）。试过加 `src/app/[locale]/[...rest]/page.tsx` + `src/app/[locale]/not-found.tsx`：`next build` 直接崩在预渲染上，两条事实同时成立——**not-found 边界拿不到 `params`**（`await params` 为 undefined），而且边界是每个 `[locale]` 页面渲染树的一部分、构建期就会被渲染，所以任何请求期数据（`headers()` / `cookies()`）都会把 459 页 SSG 拖成动态渲染。Next 16 的 `global-not-found.js`（实验特性，文档正好点名「根布局用了顶层动态段」这一情形）能绕开布局，代价是要自己带样式与主题。第三条路最可行：正文改成客户端按 `usePathname()` 选语言（SSR 期路径已知，不会水合错位），但推荐位的语料 `buildKnowledgeCorpus(locale)` 单语言就有 22.6KB(zh) / 28.0KB(en)，内联两份等于给这张 88KB 的 404 页再加约 50KB。**需要拍板**：坏链接进来时，404 的语言与出口要不要跟着 URL 走——要跟，则接受载荷增长，或者把推荐位改成运行时拉 `public/search-index.json`（搜索页已经这么取数据，顺带把 404 的载荷降下来）；只想要最小伤害版，就把三个 CTA 的 href 按 URL 前缀改对（约 20 行，正文仍是英文）。证据与三条路的取舍都写在这里，别重新踩一遍
- [x] R16.42 搜索页的「{n} 条结果」数的是当前这一页，而且篇章筛选发生在截断之后 — `src/components/search-client.tsx` 原来先 `results.slice(0, visibleCount)` 再按篇章过滤（`:95` 与 `:106-109`），页头那句 `{n}` 取的就是这个「过滤后的可见条数」（`:318`）。两句话同时不对：23 条命中写「20 条结果」；更糟的是选了某个篇章后，排在第 21 位之后的命中永远翻不到，而 `filterZeroTpl` 会对着确实存在的结果说「该篇章暂无匹配」——「加载更多」的门槛用的却是未筛选的 `results.length`（`:457`），所以按钮一直在、列表一直是空。改法是先筛选后截断（新增 `chapterMatches`，`filtered` 从它切页），`{n}` 与加载更多门槛都读 `chapterMatches.length`，切换篇章时一并复位分页。验证：`src/components/search-client.test.tsx` 夹具改成 23 条命中里第 23 条属于另一个篇章，外加一条索引里有、但对本次查询零命中的篇章（真正的「暂无匹配」）。变异三组：把筛选挪回截断之后 → 「排在首页之后的篇章也能翻到」红；`{n}` 改回可见条数 → 「数的是命中数，不是当前页的行数」红；两条新用例在改后的实现上都过，扫描面其余 22 条不受影响
- [x] R16.43 四句文案还在替一个已经结束的阶段说话 — 清点时英文覆盖早已补齐：`content/kline-buty/docs/knowledge/en` 与 zh 同为 27 篇章 / 182 课，逐篇统计非空白字符里的中日韩文字，最高的一篇只有 0.6%（书名与专有名词），没有一篇超过 10%。但文案没跟着变：`src/lib/i18n.ts:451` 的英文路径页 note 写着「🚧 English translation in progress — {done}/{chapters} chapters available so far」，代入后就是「正在翻译中——27/27 章可用」，自己跟自己矛盾；FAQ 两边（`src/app/[locale]/faq/page.tsx:52`、`:71`）说「英文内容正在翻译中，部分章节可能仍是中文」；404 的 `docHint` 把坏链接的原因之一仍写成「可能尚未翻译」；`src/app/not-found.tsx:71` 的「热门入门课程 / Popular starters」更是另一回事——它是 `getChapters(DEFAULT_LOCALE).slice(0, 6)`，按 `chapterRank` 取前六章，全站没有任何读取点击量或访问量的排序逻辑（`analytics.ts` / `growth-events.ts` 只写不读）。改法：note 与 FAQ 改成两边对齐的完成态（篇章数仍走 `{chapters}` 占位符，不写死），`docHint` 只说它真做的事（本章最接近的几节），`popularStarters` 改成「从这几篇开始 / Start here」。新 `src/app/[locale]/bilingual-coverage-claims.test.ts` 是双向对账：先从知识库算出此刻的覆盖（篇章集合、课时数、英文正文的中日韩占比），再看文案说的是不是这个覆盖——覆盖完整时任何可见文案都不许再出现「正在翻译 / in progress / 仍是中文」那批句式，覆盖一旦回退则必须讲出来（只删文案过不了第二半）。变异两组：往 zh 词典塞回一句「英文内容正在翻译中」→ 说法那条红；把 CJK 扫描指向 zh 树 → 事实那条红并点名 182 篇。`check:docs` 那边「27 章 / 182 篇，zh/en 对齐」是同一事实的第二处独立佐证
- [x] R16.44 一颗 pill 少说一半、一句注释多许一半 — 首页那颗连续学习徽章把 `labels.current`（「连续学习 / Streak」）定成**必填 prop**，调用方 `src/app/[locale]/page.tsx:55` 老老实实传了值，组件 `src/components/streak-badge.tsx` 却从没渲染它：屏幕上只剩「🔥 3 天」。单位是「天」，那 3 到底是连续几天还是别的一几天，读者只能猜；偏偏同一颗 pill 里的「最长 9」是有标签的，一半有据一半靠猜。`src/components/streak-badge.test.tsx` 那条用例名字写着「显示当前连续天数」，断言里却只有 `3` 和 `天`——所以这个死 prop 一路活到清点。改法：把 `labels.current` 说在数字前，用例补上「当前 3 天」整串与 label 本身（变异：删掉那个 span → 红）。另一处在 `src/lib/bookmarks.ts:2`：注释写着「localStorage 存储 + 云端双写」，可 `sync-layer.ts` 里没有 bookmarks 这个键、`supabase/migrations/*.sql` 里也没有这张表，`toggleBookmark()` 只写 `localStorage` 并派发 `tb-bookmarks`。收藏页的文案（`i18n.ts:187-189`）倒是中立，没跟着吹，所以这次只改注释——但照着旧注释读代码的人会以为换台设备收藏还在
- [x] R16.45 两处话说得比代码大：首页的「主线课程已完成」和 404 推荐的排序说明 — `src/components/today-pick.tsx:28-36` 的 `allDone = !pick` 是在**调用方传进来的全部篇章**上找第一篇未读，首页 `src/app/[locale]/page.tsx:35-39` 传的是 `getChapters(locale)` 映射出来的 27 章 / 182 课，而 `:54` 的 `done` 文案写「主线课程已完成 / Core path complete」——`src/lib/path.ts:11-24` 里「主线」是三个阶段中的那一个，比检测范围窄。结果两头都不对：真把主线读完、进阶篇还剩一堆的人永远看不到这句话；看到它的人其实整套都读完了，文案却在暗示他只是走完了主线。按本系列的规矩不擅自选边改检测范围（那是要不要给「主线完成」单独做一件事的产品决策），只把话收回到代码真做的事：「全部课程都读完了」。新 `src/components/today-pick.test.tsx` 的两条把范围与口径两头钉住：调用点必须仍传 `learningChapters`（并且它来自全量 `getChapters(locale)`），`<TodayPick>` 那段 JSX 里不许再出现「主线 / core path」。变异核对：把旧文案塞回去 → 口径那条红并点名整段 JSX；范围那条不受影响，证明它不是靠文案过绿的。另一处在 `src/lib/url-suggest.ts:8`：文件头写着「打分：slug 命中 > 标题命中；篇章命中 > doc 命中（篇章更稀、匹配更有价值）」，而 `itemDistance`（`:53-61`）算的是 `slugDist + 0.6 × cappedTitleDist`，`pickClosest`（`:64-71`）只按这个和升序、同分按 slug 字典序取前 k——没有任何一处给篇章加权。这条不影响用户看到什么（推荐次序本来就由这段代码决定），但它是下一个改排序的人的第一手依据，所以按实现改写成「slug 距离 + 0.6 × 标题距离，篇章与 doc 同权」，并把「别照着想象去改排序」写在同一行注释里
- [x] R16.46 换账号会把答题账本一起扫走，而文件头明说这种事不会发生 — `src/lib/account-mirror.ts:24-25` 写着镜像重置**不**包含「云端没有对应表的本地记录（书签、连续天数、学习时长、活动日历、答题账本）」，理由是清掉那些是真丢数据；可 `:41-43` 的判定是 `key.startsWith("tb-quiz-") && key !== "tb-quiz-difficulty"`，而 `src/lib/quiz-attempt-ledger.ts:3` 的键正是 `tb-quiz-attempts`。于是 `resetAccountMirror()`（`:64-68`）在换账号与注销时把它删了，`src/lib/quiz-score-trend.ts:77` 读的就是这份账本——测验分数趋势从此永久少一段，且云端无从恢复（`supabase/migrations/*` 与 `sync-layer.ts` 里都没有 quiz 尝试表，已 grep 确认）。归属判断撞名的根因是前缀：`tb-quiz-<chapter>` 是镜像、`tb-quiz-difficulty` 是设备偏好、`tb-quiz-attempts` 是本地独有记录，三者同住一个前缀下，而 `startsWith` 看不见区别。`src/lib/account-mirror.test.ts` 当时只钉了 `tb-quiz-difficulty` 那一个例外，账本从未进过夹具，所以这条路径一路是绿的。改法两步：①除名单改成显式列表 `PER_CHAPTER_QUIZ_EXCLUSIONS`（含这两个键）并导出；②加一条库房核对——扫 `src/` 里所有写死的 `"tb-quiz-xxx"` 字面量键（测试文件除外），要求每一个都出现在除名单上，多一个没定性的键就红，逼写字面量的人当场回答「这个键归谁」；扫描本身先断言非空，防空转。变异核对两组：把 `tb-quiz-attempts` 从除名单里拿掉 → 行为那条红（`expected undefined to be '{"spot:1"…'`）且库房那条同时红；只删一个不属于镜像的键 → 只有库房红。顺手修掉一处假夹具：`src/components/stats-client-guest.test.tsx:38` 种的是 `tb-quiz-attempt-ledger`，全站没有任何生产代码读这个名字（`grep -rn "tb-quiz-attempt-ledger" src/` 只有这一行），所以那个「答题账本」从来没进过被测路径；改成真键后 12 条用例照旧全绿
- [ ] R16.47 K 线横轴到底是哪个时区 — **需产品决策，不擅自选边**（注释与测试标题的假话已先订正）：R16.39 把那个手抄两遍的减法收敛成 `DISPLAY_TZ_OFFSET_SEC = 8 * 3600`，并在 `src/lib/binance.ts` 的文件头写下「lightweight-charts 按 UTC 渲染时间戳，而本站习惯用北京时间读数，于是两条路都把 UTC 秒往前挪这一截」。方向是反的：翻遍 `node_modules/lightweight-charts@5.2.1` 的打包产物，格式化刻度只用 UTC 访问器（`getUTCDate` 5 处、`getUTCFullYear` 7 处、`getUTCHours` 2 处、`getUTCMonth` 7 处……），本地访问器 `getDate` / `getHours` / `getMonth` / `getFullYear` **一处都没有**，所以「UTC 秒 − 8h」画到轴上就是比 UTC 还慢 8 小时——既不是 UTC，也不是北京时间，也不是访问者的本地时间，而这三者才是仅有的三种合理解释。也实测过：本地 `next start` + Chromium 打开 `/zh/chart`（`interval=1h&limit=500`，最后一根 14:00Z）把时间轴那张 canvas 抠出来看，刻度是 17…22 与 3,5,…,23——但 v5 默认右侧留 60 根空白，尾部刻度落在未来区，所以**光看刻度认不出基准**，结论只能建立在格式化器只用 UTC 这一条上，别拿肉眼看图当证据。屏幕上没有假话：`grep -rn "UTC\|时区\|北京" src/app/\[locale\]/chart/page.tsx src/lib/i18n-chart.ts src/components/kline-chart.tsx` 只命中 `UTCTimestamp` 这个类型名，站内从没说这张图是哪个时区；说假话的是注释和 `src/lib/binance.test.ts:15` 的用例名「对齐 UTC+8（时间 -8h）」，两处都已按事实改写。三条路各有代价：①去掉位移 → 轴读 UTC，与数据本身、`UTCTimestamp` 类型名和币安 API 一致，改动最小，但对按北京时间看盘的中文用户不友好；②把符号翻成 `+ 8 * 3600` → 所有人看到北京时间，恒定且不依赖访问者设备，代价是与 R16.38 刚定下的「日界一律按本地日历取」（`src/components/replay-trainer.tsx:136`）分叉，海外用户看图是北京时间、看回放日界是当地日界；③数据不动，给 `timeScale` 配 `localization.timeFormatter` / `tickMarkFormatter` 用本地访问器 → 每人看到自己的时区，与 R16.38 同口径，代价是轴上的数字不再等于 `Kline.time`，且要新增一处格式化实现（`DISPLAY_TZ_OFFSET_SEC` 随之作废）。选定后请把口径写进界面（轴上或图例里标 UTC / 北京时间），别再让横轴自己沉默
- [x] R16.48 一份没人读的收藏表，和把它当功能列出来的两处说明 — `src/components/kline-chart.tsx` 的币对按钮每次点击都往 `localStorage` 写 `tb-chart-favs`（注释写着 `收藏最近使用的币对`，去重后截到 6 条），而全仓库唯一的读者就是它自己那次 read-modify-write：快捷按钮始终按 `CHART_QUICK_SYMBOLS` 的固定顺序渲染，站内没有任何地方念过这份清单，所以「收藏 / 最近使用」这个功能并不存在。两处跟着它说话：`src/lib/account-mirror.ts:23` 把「自选行情」列成换账号时**故意保留**的设备偏好（保留的是一份没有界面的数据），`src/components/kline-chart.test.tsx` 有一条用例把这份写入当成断言目标，等于给假话盖了「有测试」的章。按事实收口：删掉这段写入与「自选行情」那句，用例改名为只测切换（切换的断言照旧）。真要把最近使用的币对排到快捷位，是一个单独的产品决策，本次不顺手实现。
- [x] R16.50 「朗读」只念前 3000 字，而且念完那截就像念完了整篇 — `src/components/read-aloud.tsx` 把课文 `.slice(0, 3000)` 之后交给一条 utterance，而 3000 是**整篇课文**的上限：`content/kline-buty/docs/knowledge/zh` 的 182 篇里 173 篇超过它（中位数 6,646 字，最长 13,074），于是中位课文有一半以上（6,646 字里只交出去 3,000）从没进过引擎；更糟的是那条唯一挂了 `onend` 的 utterance 报完，按钮就从「停止」退回「朗读」，界面把「这一截念完了」演成「整篇念完了」。`read-aloud.test.tsx` 里还有一条用例把这个上限当契约写死（"truncates very long text to 3000 characters"），所以它看起来像设计而不是事故。改法：3000 改为**每条 utterance** 的上限（`READ_ALOUD_CHUNK_CHARS`），按空行分段装满多条排队 `speak`，单段超限才硬切；`onend` 只挂在队尾，任何一条 `onerror` 就 `cancel()` 整队并退回待命，空课文直接不进入播放态。同一处还有一句写死的 `title="语速"`——它在英文界面里也是中文，改成按 locale 取的 `rateLabel`。新门禁 `npm run check:localized-labels`（`scripts/check-localized-labels.mjs`，登记进 `docs/ops.md` 与 CI）把「`title` / `aria-label` / `alt` / `placeholder` / `label` 的字面量含中日韩文字」钉成失败：这一类此前手工清过一轮而没有门禁，所以又长回来一处。**未验证的边界**：Chrome 对长时间连续朗读有已知的自行停顿问题，本次没碰（本地无法验证朗读音频），切成多条不改变也不恶化它，但也不声称解决。变异核对三条：只交一条 chunk → 整篇排队那条用例红；把 `onend` 挂到每条 → 队尾用例红；塞进一个 `title="临时探针"` 的临时文件 → 门禁 exit 1 并点名整改路径（探针文件已删）。
- [x] R16.49 同步冲突横幅念的是「存下来几条」，不是「查到几处」 — `recordSyncConflicts` 把明细截到前 20 条再落盘（`items.slice(0, 20)`，几十条错题分歧不该整表进 `localStorage`），而唯一的读者 `SyncConflictNotice`（`src/components/stats-client.tsx:143`）把 `record.items.length` 代进文案「另一台设备有 {n} 处数据与本机不同」：23 处分歧在屏幕上说 20 处，再多也恒定说 20。修法是把两个用途分开——记录里新增 `total` 存检测到的条数，明细照旧截断，横幅念 `total`；那个裸数字收敛成导出的 `MAX_STORED_CONFLICT_ITEMS`。顺带把解析收成一个出口 `parseConflictRecord`（原来横幅自己 `JSON.parse` 一遍、`readSyncConflicts` 再验证一遍，两套判断），换账号前留在盘上的旧记录没有 `total` 时按明细条数兜底，下一次 hydrate 重算即自愈。变异核对：把横幅改回 `items.length`、或把 `total` 从落盘对象里删掉，新增的两条用例各自点名转红。
- [x] R16.51 门禁只查属性，等于放过了眼睛直接看到的那一类 — R16.50 的 `check:localized-labels` 只盯 `title` / `aria-label` / alt 这类属性，把 `>…<` 之间的裸 JSX 文本也划进判据后，当场又抓出 4 个文件 9 处「这一处根本没问语言」的写法；连着藏在表达式里的字符串一起清，共 16 条界面文案改按 locale 取。明细：复习页 11 条（重答面板 5 条、错题列表的两条出口「重做本章测验 →」「问 AI 深入理解」、错题本 `.txt` 导出文件里的 4 条标签——标题行、`导出时间：`、`你的选择：`、`正确答案：`，英文访客下载的是一段中文表头）；AI 章节测验的「难度」1 条；测验「跳过」1 条，这条走 `src/lib/i18n.ts` 字典新增 `skip`（中英各一条，`check:dead-copy` 保证它真被读到，不再是造一个没人渲染的键）；课程页 OG 分享卡 3 条。**一处自我订正**：本来看待办清单时把 OG 卡整类当成「图卡路径拿不到 locale」想豁免掉，这是假的——`src/app/[locale]/knowledge/[chapter]/opengraph-image.tsx:9-10` 取的就是 `params.locale`，分享卡正常渲染的三张也按 `p.locale` 出文案，于是英文课程的封面图上那行「免费中立交易教育 / 不荐股 · 不导流 · 不承诺收益」是写死的中文。豁免因此从「所有 OG 卡」缩成一处（分享卡的降级图，见 R16.52），清单由用例钉住条数——往里加一条就等于放弃一处检查。**类型层面**：`QuizDict` 在 `src/components/chapter-exam-card.tsx` 被整份抄了一份（18 个字段一字不差）。本轮给字典加 `skip` 时，正是这份抄本让 `tsc` 在两个组件里各报一次同样的缺字段错——改一处不够，收敛成 `quiz.tsx` 单一导出出口。**没装作解决的部分**：判据是中日韩字符，把英文写死在同一处它认不出来（ASCII 没有语言特征），那半边靠新增的 5 条按 locale 用例兜（`review-client.test.tsx` 3 条含导出文件标签、`ai-chapter-quiz.test.tsx` 1 条、`quiz.test.tsx` 1 条）。变异核对三组：①把重答面板两条裸文本改回写死中文 → 门禁 exit 1 点名两处，且英文面板那条用例同时红；②把 `exportText` 里的 `const en = locale === "en"` 改成 `false` → 只有导出 txt 那条红；③把错题列表两条出口改回写死中文 → 门禁点名 2 处 + 对应用例红。还原后门禁 exit 0、`review-client.test.tsx` 26/26 绿。
- [ ] R16.52 分享卡降级图那行品牌语，是要中英并列还是接受英文访客看到中文 — **需拍板，属品牌呈现而非代码正确性**。`src/app/share/[kind]/[path]/opengraph-image.tsx` 的 `renderBrandFallback()` 在两种情况下出图：`kind` 不是 quiz/replay/streak（`:103-105`），或 payload 解码/汇总失败（`:107-110`）。这两条路上都没有任何语言信号——这个路由本身也没有 `[locale]` 段，正常那三张卡的语言是从 payload 里读出来的，所以「拿不到 locale」在这里是真事实而不是没查。图上写死的一行 `免费中立交易教育`（`:83`）是 `LOCALE_FREE_SURFACES` 里唯一一处界面文案，也是全站唯一一处门禁认得出、却按豁免放行的写法。三条路各有代价：①中英并列（`免费中立交易教育 · Free, neutral trading education`）→ 谁都能读到一半，代价是这行从 11 字变 50 字符，1200×630 的卡上需要重新量宽度、字号得降；②降级图只留品牌名 `Trade Buty` → 干净且无语言，代价是丢掉整句定位，而这张图恰恰是链接坏掉时唯一的门面；③维持现状 → 受众本来就是中文用户为主，代价是英文访客转发的链接落到一张看不懂的行上。选定前它留在豁免清单里，用例钉住清单条数，不做「悄悄留一处违规」的处理。
- [x] R16.53 隐私页与 FAQ 宣称「AI 那两类记录不带账户」，而两个端点写的都是 `user_id: user?.id ?? null` — `src/app/api/ai/feedback/route.ts:87` 与 `src/app/api/ai/citation-click/route.ts:85` 都把调用者的账户 id 写进行里（前者的函数注释甚至写着「登录用户署名，游客匿名」），可 `src/app/[locale]/privacy/page.tsx:41` 说的是「只有两种点击会以**匿名方式**落库……这些行**不带账户**、不带邮箱、不带设备标识」，`:53` 的 FAQ 同样写「匿名记录（**不关联账户**）」。同一份隐私页下面两屏还写着另一套：删除账户时「你给 AI 回答打过的评分」会被删掉、引用记录「会在那一刻**摘掉账户标识**、以匿名行保留」——这两句只有在「行里本来带着账户」的前提下才成立，也就是说这份文档自己拆自己的台。为什么之前没被发现：`faq/data-kinds-claims.test.tsx` 钉的是「两页都得提崩溃诊断日志」，`privacy-endpoints.test.ts` 钉的是删除段落与 `on delete` 那张表；而两个端点的用例只测了游客一侧（`user_id: null`），登录后那一半从来没进过断言，所以代码对、文案错、测试双方都没看见。改法按事实三分：未登录时这两类行确实匿名；登录后它们带着账户标识；两类都不带邮箱地址与设备标识——并在两处都指向「数据保留与清理」那段说清注销时各自的去留。用例三条：①一条窗口检查，任何「不带账户 / carry no account / 不关联账户」式说法前后 60 字内必须出现「未登录 / logged out」，否则判违规，旧写法三种语言各留一份作为禁令自证（断言它确实被抓到，防断言空转）；②两页两种语言都得正面出现「登录后」与「账户标识」；③两个端点各补一条「登录用户的写入带着自己的账户 id」，把文案钉回实现。变异核对：把任一 route 的 `user_id` 改成恒 `null` → 对应新用例红；把隐私页那句限定语去掉退回旧写法 → 禁令用例红并点名 `en 隐私页`（探针当场还原）。
- [x] R16.54 两处 AI 失败态把上游状态串当成界面文案，而「稍后重试」是一句做不到的事 — ①`src/components/ai-quiz.tsx`（错题本里的 AI 变体题）过去写的是 `throw new Error(err.error || dict.error)`，服务端响应体赢过本站字典，于是 `src/app/api/ai/quiz/route.ts:69` 的 `Login required`、`:75` 的 `Rate limit exceeded`、`:138` 的 `No matching questions` 原样出现在中文界面上，而同一处 429 明明带着 `Retry-After`（`:76`，`ai-chat.tsx:352` 就在用它）却被丢掉；更要紧的是这条泄漏**被用例当成了契约**——`ai-quiz.test.tsx` 原来断言屏幕上就该出现 `"登录后才能生成"`，跟 R16.48 那条「给假话盖了有测试的章」是同一个形状。②`src/components/study-plan.tsx` 把 `暂时无法生成学习计划，请稍后重试。` 写死在 catch 里（英文界面同样出中文），而且它写进的是 `plan`，而按钮的显示条件是 `{!plan && …}`——一次失败顺手把「重试」按钮一起吞了，于是那句「请稍后重试」当场变成做不到的承诺；这张卡在 `/stats` 上是无条件渲染的（`src/app/[locale]/stats/page.tsx:47`），未登录访客点「生成学习计划」必然撞上 `src/app/api/ai/plan/route.ts:75` 的 401，真正的原因是「没登录」，文案却从没说过。改法：ai-quiz 按状态码三分（401 → `loginRequired`、429 → `rateLimited` + 从 `Retry-After` 换算的分钟数、其余 → `error`），catch 不再把抛出的消息当文案；`AiQuiz` 的字典契约新增 `loginRequired` / `rateLimited`，`review-client.tsx` 按 locale 传入（措辞与 `i18n.ts` 的 `aiQuizLogin` 对齐）。study-plan 新增独立的 `failed` 状态：失败只写 `failed`，按钮留在原地，`error` / `loginRequired` 两条由调用方（`stats-client.tsx`）按 locale 给。用例：ai-quiz 那条改成四轮 mock（401/429/502/网络异常），除断言三种说法外再钉一条「三条上游状态串一条都不许出现在屏幕上」；study-plan 补「非 2xx 与异常都保留重试入口」「401 说的是要登录」「换英文字典就拿英文、屏幕上不残留中文」四条。变异核对：把 catch 改回 `setError(e.message)` → ai-quiz 那条红（只把 `!res.ok` 改回 `throw err.error` 不足以复现，泄漏点是 catch，说明守卫要落在真正决定显示什么的那一行）；删掉 401 分支 → 登录那条红；把失败写回 `plan` → 两条「按钮还在」的红。全部还原后 18/18 绿。
- [x] R16.55 课文里的 markdown 语法被当成界面文案截出去，22 个页面印着 `[09-市场与品种专题篇/01-外汇市场.md](../…)` — 正文走 `rewriteLinks`（`src/lib/content.ts:353`）把相对链接换成站内路由，但**导语与摘要是从原文里截出来的**，不经那条通道：`readFirstParagraph`（`src/lib/md-utils.ts`）只去掉 `#`、`>`、`**` 再截 120 字，frontmatter 的 `description` 更是原样用。于是 `content/kline-buty/docs/knowledge/{zh,en}/forex-trading/README.md:3` 那句开头的链接被截成 `…/01-外汇市场.md](../markets-instruments/forex-market.md) 讲清了外汇的「概念」…`，经章节 hero、路线页列表、单课页左侧栏（`chapter-rail.tsx:73`）铺到 **22 个预渲染页面**的可见文字上（`grep -o 'leading-relaxed">\[…' .next/server/app/**/*.html` 实测），其中 `{zh,en}/knowledge/forex-trading.html` 两页还把它塞进了 `<meta name="description">`；另有 4 篇课文的 frontmatter description 同一种写法（`career/quant-career-path.md`、`reading-list/ta-classics.md` 的 zh/en 版）。**内容仓的原文不改**（那是 kline-buty 的地盘），改在本侧：新增 `plainText()`（内联链接、引用式链接、尖括号裸链、行内标签、反引号 → 纯文本），`readFirstParagraph` 与 `fmDesc` 两处都过它。用例三条：①`src/lib/derived-copy-claims.test.ts` 扫两个语言的全部篇章导语与全部课文摘要，断言不再出现 `](`、`**`、反引号，并用计数器自证「确实扫过 50+ 条导语 / 300+ 条摘要」而不是循环体空转；②路线页的 `{docCount} lessonsUnit →` 数的是课文，英文侧却写着 `lessonsUnit: "chapters"`——同一个数字在路线页叫 chapters、在篇章页叫 lessons，而同一页别处又说全书 27 chapters，改成 `lessons` 并加渲染用例（用「行尾带箭头」把这一处与那句合法的 27 chapters 分开）；③`src/components/knowledge-graph.tsx:42` 的注释写着「完成度小点」，而它标的条子是 `c.docCount / maxCount`——与读没读无关，图上方的图例本来就说「bars show lesson count」，注释按事实改写。变异核对：把 `plainText` 从两处撤掉 → 四条扫描用例同时红并点名 `zh/forex-trading 的导语`；把 `lessonsUnit` 改回 `chapters` → 渲染用例红；重建后同一把扫描从 22 页 / 2 处 meta 降到 **0 / 0**，并正向确认那句导语仍在屏上（`09-市场与品种专题篇/01-外汇市场.md 讲清了外汇的…`），排掉「0 命中是因为元素没了」这种假绿。已知取舍写进注释：反引号只删记号不保护内容，且尖括号清理跑在删记号之前，所以 `` `<br>` `` 会连同里面的字一起吃掉——首段与 description 里没有这种写法，所以不做代码区间保护。新增两个测试文件让时钟巡检台账从 292 个文件重算到 294（`docs/test-clock-hygiene.md` 一并提交）。**落地后 CodeQL 连着两轮在 `plainText` 上判「值里可能还剩 `<script`」**：第一轮是 `</?[a-zA-Z][^>]*>`，第二轮是换成 `<[^>]*>` 之后——该查询只看那条正则本身像不像消毒器，不看后面还跟着什么步骤，末尾补一条删尖括号的步骤它并不认账（`src/lib/md-utils.ts:25`，check-run 107345432575）。这批字符串只流向 React 文本节点与 `<meta content>`（两处都转义），本不构成注入，但半消毒的值比没消毒更危险，所以「不留尖括号」这件事要留着、写法要换：改成逐字符扫描 `dropAngleSpans`——成对区间整段去掉、`<https://…>` 只脱壳、落单的 `<` 与 `>` 各自删掉，全程不再有任何含尖括号的正则。顺带修掉本轮自己写下的两处过头话：①「标签正则也挡不住 `<scr<scriptipt>`」不实，那条正则够宽、会把整段吃掉，能不能拼回标签取决于正则宽窄，而扫描只认「第一个 `<` 配最近的那个 `>`」，不靠这个巧合；②「反引号被随后的标签清理吃掉」写反了顺序，尖括号清理跑在删记号之前。扫描用例相应加了一条落单右括号的断言（`收益 > 3%` → `收益 3%`）：正则版把左右括号并成一步删，扫描版是两个分支，右括号那一支此前没有任何用例走过。变异核对四组，逐条点名：留下落单的 `>` → 新加那条红；留下没闭合的 `<` → `停在 <script 结尾` 那条红；裸链接连内容一起删 → `尖括号裸链` 那条红；成对区间不整段跳过（`i = close + 1` 退回 `i += 1`）→ `<br>` 那条红。
- [x] R16.56 两处注释在替代码说话，而代码说的是另一套 — ①`src/components/sync-summary-toast.tsx` 文件头写「不阻塞登录流程，**3 秒**后自动消失」，下一行实现是 `setTimeout(…, 8000)`；又写「**同一个 userId** 同一会话只弹一次」，而 `:25-26` 用的标记键是常量 `"tb-merge-summary-shown"`，里面没有任何身份——`MergeSummary`（`src/lib/sync-layer.ts:763-773`）本来也不带 userId，所以真实行为是「同一个标签页只弹一次」，在同一标签页里切到第二个账户再合并，用户什么都看不到。这不是文案瑕疵而是承诺错位：注释把「按账户」写成既成事实，读的人就以为换账户会有第二次提示。改法按本仓惯例给数字一个出口：导出 `SYNC_TOAST_AUTO_DISMISS_MS`，`setTimeout` 与注释都读它（注释里不再手抄秒数），去重那条按事实改写并写明「要按账户去重得先改事件载荷」；同时补一条用例——这条自动消失路径此前**零覆盖**（测试文件里没有 fake timers、也没有 8000），现在按常量推进假时钟，跨过/不到那一刻各断言一次。②`src/app/api/ai/chat/route.ts:141` 的注释说「历史（保留最近 **5 轮**）」，而同一文件 `:144` 是 `HISTORY_KEEP = 10` + `history.slice(-HISTORY_KEEP)`，`:101` 另一条注释写的就是「最近 10 轮」——本站的「轮」等于一条消息（`src/lib/ai/chat-input.ts:29` `MAX_CHAT_TURNS = 40` 注为「20 组问答」），所以 `:141` 把窗口说小了整整一半，照它读代码的人会以为护栏与摘要看到的是更短的历史。改成「保留最近 10 轮 = 5 组问答」。变异核对：删掉 `window.setTimeout(…)` 那一行 → 新用例红（证明它测的是真消失，不是渲染）；把常量与用例同时改数值不会误红，因为用例读的就是同一个出口。
- [x] R16.57 篇章「已读几篇」的注释自称唯一口径，实际四处各算各的，其中一处连 `readProgress()` 的归一化都绕开了 — `src/lib/learning-overview.ts:106` 的 `readDocsForChapter`（去重 + 按篇章课数封顶）头顶写着「唯一口径」，旁边却长着四份算法：①`src/lib/course-completion-trend.ts:104-111` 就地抄了一份等价的去重+封顶；②`src/components/stats-client.tsx` 三处（`pendingQuizChapter`、断档恢复卡的 `hasUnfinishedChapter`、`StudyPlan` 的 `doneChapters`）直接取 `(progress[slug] ?? []).length`，既不去重也不封顶；③`src/components/chapter-complete-celebration.tsx:43-46` 最彻底，自己 `JSON.parse(localStorage.getItem("tb-progress"))` 再取 `.length`，外面还裹了一层把异常整个吞掉的 `try/catch`。**只有 ③ 会改变今天的显示**：字符串也有 `.length`，存储值坏成 `{"getting-started": "ab"}` 时它读出「已读 2 篇」，于是在别的界面都显示 0/2 的场合放一次「篇章完成！」的礼花——`normalizeProgress`（`src/lib/progress.ts:19-31`）里「非数组直接丢掉」那条规则存在的理由就是这种值不该被当成进度。①②与出口在可达状态上算得一样（`useLocalProgress()` 走 `readProgress()`，重复项与非字符串进来前就被清掉），换的是「以后只有一处可改」。④判据分歧：`learning-overview.ts:64` 与 `learn-stats.ts:29` 判 `read >= docCount`，`course-completion-trend.ts:171` 与 `chapter-rail.tsx:52` 判 `>= docCount && docCount > 0`——0 课的篇章（英文章节回填期间只放了 `README.md` 的那批目录）在前两者算「已完成」、在后两者不算，同一件事两张卡打架；`stats-consistency` 把这件事盯住了一半——它确实比 `overview ↔ courseTrend` 的 `doneChapters`（`course-done-chapters-mismatch`），但首页与路线页走的是 `readSummary`、课文页走的是侧栏与庆祝，这三个消费者根本不在审计的输入里，那半边的分歧没人看。改法：四处统一调 `readDocsForChapter`，两处补 `docCount > 0`，庆祝组件改用 `readProgress()` 并删掉那层 `try/catch`（`readProgress` 与 `readProgressCompletions` 自己都不抛）。**本轮实测不改变任何数字**：`getChapters` 扫 zh/en 两棵树 0 个空篇章，且每个篇章 `docCount === getDocMetas().length`（临时探针逐章比对，`MISMATCH_ROWS: []`，探针不入库）。验证：新增 `src/lib/read-count-owner.test.ts`——同一份含重复键、空串与非字符串项的脏进度同时喂给 helper、`readSummary`、`buildLearningOverview`、`buildCourseCompletionTrend`，断言读数与完成章数四向一致（4 篇 / 1 章），另有「0 课篇章不完成」与「封顶不超总数」两条；`chapter-complete-celebration.test.tsx` 加坏值不庆祝、0 课不庆祝两条。变异四组逐条点名：庆祝组件退回 `JSON.parse(...).length` → 坏值那条红；去掉庆祝的 `docCount > 0` → 0 课那条红；去掉 `learn-stats.ts:29` 的守卫 → 一致用例红；去掉 `learning-overview.ts:64` 的守卫 → 同样红。删掉的那份趋势抄本没有对应用例变红——它与被调方逐字等价，这条属「少一处可改」而非修一个数，按事实登记不冒充缺陷修复。全量 `npm test` 296 文件 / 2852 条绿，时钟巡检台账随之从 294 重算到 295。
- [ ] R16.58 「已读」到底数什么：唯一口径按篇章课数封顶，课文清单与侧栏却按「现在还在的课」取交集 — `src/components/doc-list.tsx:29` 与 `src/components/chapter-rail.tsx:50` 数的是 `metas.filter((m) => readSet.has(m.slug)).length`，注释明写「旧键（改课留下的）不在 metas 里，既不算已读也不会把进度顶过 100%」；而 `readDocsForChapter` 是「去重后按 `docCount` 封顶」——它照收改课留下的旧 slug，只保证总数不越界。于是同一次课文改名之后：侧栏显示 2/3，首页「已读 N 篇」、路线页、`已完成 N 章` 却按 3/3 算，那一章被记成完成，而侧栏明说没完成。**今天没有触发面**：内容仓自 2026-08-22 双语重构以来没有任何课文改名或删除（`git log --diff-filter=RD --since=2026-08-23 -- 'docs/knowledge/*/*.md'` 空输出），R16.57 也未把这条算作待修。要把交集口径铺到只有计数的界面，得把每章的课文 slug 列表传进 `/path` 与首页的 RSC props（今天只传 `{slug, docCount}`），代价是每页多几 KB payload 与构建期多跑一遍 `getDocMetas`。**开工条件**：内容仓下一次课文改名/slug 调整落地之前，或本地台账里出现「读过但站上已不存在」的键被用户报出来时。
- [x] R16.59 首页那颗 ☁ 只对「登录了没有」负责，念的却是一句完成时 — `src/components/global-read-stat.tsx:32` 的条件就是 `user &&`，而它渲染的 `title={syncedLabel}` 在 `src/lib/i18n.ts:53` 写的是「已云端存档，换设备不丢」（en `:438` "Synced to cloud"）。断网期间的读不会丢，但也不会立刻上云：`syncProgressWrite` 失败时把这条写进离线写队列（R9.5，`src/lib/sync-layer.ts:82-104`），而它旁边那句「已读 N 篇」是按本地进度算的——于是 ☁ 恰好出现在最不该出现的时刻：数据只活在 localStorage 里，界面却承诺「换设备不丢」。`getQueueLength()`（`src/lib/sync-queue-store.ts:150`）此前只有测试读者，全站没有任何界面读它（全仓 grep 核对）。改法：条件换成「登录且待传队列为空」，并给队列补一条变化通知 `QUEUE_EVENT = "tb-sync-queue"`——`persist()` 与 `clearPersistedQueue()` 各发一次（此前两处都不 announce，重放完成后界面无从把标记收回来）；写 localStorage 失败也照发，长度是现算的，存不进去本身就是一种变化。**这次没接、写清以免被当成已覆盖**：`sync-layer-queue-fallback.ts:95` 那块内存缓冲区不计入——接它要把该模块静态引入首页，正撞 R9.6 的体积守门（它存在的意义就是让队列不进共享 chunk），而它只在队列 chunk 自身加载失败时握着写入；那条路径下 ☁ 仍可能早出现一次。验证：`global-read-stat.test.tsx` 加 3 条（有待传不显示 ☁、已读数字照常显示、清空后标记自己回来——最后一条只发事件不 rerender，验的是订阅本身）；`sync-queue-store.test.ts` 加一条断言入队/重放/清空各通知一次。变异三组逐条点名：条件退回 `user &&` → 有待传那条红；`persist()` 不再通知 → 通知用例红；订阅换成空函数 → 「标记自己回来」红。首页路由 JS 预算留给 PR 的 `check:bundle` 实测（本次把 `sync-queue-store` 静态引入首页 chunk）。
- [ ] R16.60 ☁ 现在只是消失，用户看不到「还有 N 条写着没上云」— R16.59 把那句假承诺收掉了，代价是有待传写时首页什么都不说。真正知道「这些还只在这台设备上」的界面应该给一条待传提示（条数 + 恢复网络后会自动补传），而不是把安抚性标记藏起来。要做需先定三件事：出现在首页还是统计页、条数口径是否含内存缓冲区（见 R16.59 那条已知边界）、以及新文案在 `check:localized-labels` 与分享卡豁免清单里的归属。**开工条件**：R16.59 合入后出现「以为已经同步了、换设备才发现没传」的反馈，或离线写队列长度成为要盯的产品指标时。
- [x] R16.61 「跳到回放末尾」只搬计数器和价格，图表还停在你上次停下的地方 — `src/components/replay-trainer.tsx` 的 ⏭ 按钮原先是 `onClick={() => klines && setIdx(klines.length)}`。全量写序列只有一次：那个「数据变化 → 全量重设」的 effect（`:263-277`），而它的依赖刻意是 `[klines, lowEnd]`、**不含 `idx`**——因为逐根推进走的是 `seriesRef.current.update()`（`:288`），每步重设整张图会把播放做不成。于是跳末时 `idx` 一次跳掉两百多根，却没有任何一次 `update()`/`setData()` 跟上：右上角价格是 `klines[idx - 1].close`（`:467-471`）、进度写着「已回放 270/270」（`:472`），图面上却还是前面那 30 根。今天可复现：自由模式点几下「下一根」再点 ⏭。`replay-trainer.test.tsx:271-282` 原来只断言计数器到了 270/270、播放按钮被禁用，**从没看图表**，所以这条一直是绿的。改法：把「全量填到第 n 根」抽成 `fillSeriesTo(to)`，effect 与跳末共用它（低端机裁剪口径不变，见下面那条未接的 R7.3 边界）。验证：既有用例加一条断言——跳末之后 `series.setData` 最后一次调用拿到整段 300 根；变异核对：把 `fillSeriesTo(klines.length)` 那一行删掉（只留 `setIdx`）→ 该断言红并点名「跳末之后图表应拿到整段 300 根」。**本轮没顺手改的**：R7.3 那句「低端机只保留最近 `REPLAY_REDUCED_CANDLES` 根」在真实常量下（150，`src/lib/perf.ts:29`）几乎不参与——最大起始 context 只有 50（`DIFFICULTIES`，`:30-34`），播放推进又不裁剪，另开一条处理，不与本条混做。
- [x] R16.62 训练趋势块要用户「再完成一轮」，而它自己那张图要两轮才画得出来 — `src/components/replay-trend.tsx:39` 的门槛是 `points.length < REPLAY_TREND_MIN_ROUNDS`（两轮），可 `src/app/[locale]/replay/page.tsx:66` 喂给它的空态文案是 `dict.replay.histEmpty`——那句是给**上一张卡**写的：`src/components/replay-history.tsx:53` 判的是 `rounds === 0`，一轮就够。于是用户做完第一轮回到 /replay，上面的训练记录卡已经在列这一轮、并在「累计轮次」位上写着 1，下面这块却还在说「完成一轮猜涨跌后，这里会出现你的训练记录。」，也就是伸手要一件刚做完的事。为什么一直没被发现：`replay-trend.test.tsx` 的三条用例传的都是测试自己写死的 `emptyLabel="暂无足够数据"`，词典里那句真文案从没进过任何断言，两块共用一句这件事只在界面上看得见。改法给数字一个出口（与 R16.56 同一惯例）：新增 `replay.trendEmpty`（zh `src/lib/i18n.ts:283`、en `:671`），文案里写 `{n}` 而不写「两轮」，由 `REPLAY_TREND_MIN_ROUNDS` 在渲染处代入——以后把门槛改成三轮，文案跟着变，不再靠人记得去改句子。`histEmpty` 留在原处给训练记录卡用，两句从此是两个键。验证：`replay-trend.test.tsx` 新增一条（一轮时屏上是趋势块自己那句、`{n}` 已被代入、屏上不留花括号、且 `trendEmpty !== histEmpty`）；`{n}` 这个名字是 `e2e/placeholder-leak.spec.ts` 从 `i18n.ts` 取值自动推导的，构建产物面 + 水合面一起跑，11/11 绿（含 `/zh/replay 水合后仍无残留`），并直接读构建出的 HTML 正向确认两种语言各自印的是「准确率折线要累计 2 轮记录才画得出来。」与 "The accuracy line appears once you have 2 rounds recorded."（`{n}` 只剩在 RSC payload 的 `<script>` 里，那一面门禁本来就整段丢掉）。变异两组逐条点名：门槛退回 `< 1` → 两条用例同时红（空态块整个不渲染）；把 `{n}` 的代入撤掉 → 该条红并打印 `expected '准确率折线要累计 {n} 轮记录才画得出来。' to contain '2'`。**本轮没顺手改的**：这条折线本身只画最近 20 轮（`replay-trend.tsx:26`、`:32` 的 `.slice(-20)`），界面上没有任何一处说这件事——与下一条同属「窗口没交代」，并到那条一起做，不在这里单开一句文案。
- [x] R16.63 趋势图的数据点说明少算一轮，还在英文页面印中文 — `src/components/replay-trend.tsx:77` 原先写的是 `` `${points.length - i} 轮前 · ${p.acc}%` ``（一条模板字符串，不是属性），两个毛病：①**差一**——`points` 是已经裁到最近 20 轮的数组，`i` 从 0 起，于是最新那一轮被标成「1 轮前」，而它就是用户刚打完的那一轮；②**中文写死在模板字符串里**，`check:localized-labels` 只看属性字面量与裸 JSX 文本节点，看不见 `${}` 表达式里的汉字，所以 `/en/replay` 上这张卡除了标题全是英文、鼠标悬停却出「轮前」。第二点当场探针自证：把那行原样贴回去再跑 `npm run check:localized-labels`，退出 0 且照旧打印「✅ 界面文案没有写死单一语言（属性与 JSX 文本节点两类都查了）」——这条守卫不在这个门禁的能力范围里，只能落在用例上。改法：换成 `localDateStr(new Date(p.at))`（`src/lib/date-utils.ts:7`，本站本地日历日的唯一出口，见 R16.38/R16.40），说明变成「2026-03-04 · 30%」——日期不带语言，差一这件事也随之消失。取舍写在这里以免被当成没看见：同一天打的两轮现在说明完全同名（只差那个百分比），旧写法靠位置把两轮分开，可那个位置数本来就是错的。没有选相对时间（本站没有任何 `new Intl.*`），也没有选 `Date#toLocaleString()`——它在两种语言的页面上都会按浏览器语言出字，而 `replay-history.tsx:76` 那种列表行本来就是这个口径，不在这里顺手扩。验证：`replay-trend.test.tsx` 加一条，用本地时区构造 `new Date(2026, 2, 4, 12)`（换任何运行时时区都得到 2026-03-04），逐点断言 `toBe("2026-03-04 · 30%")` / `toBe("2026-03-05 · 80%")`，再对每个 `<title>` 扫中日韩区间不得命中。变异核对：把 `轮前` 那行贴回去 → 该条红（`expected '2 轮前 · 30%' to be '2026-03-04 · 30%'`），而 `check:localized-labels` 仍然绿——这正是用例要自己扛住的理由。
- [ ] R16.64 训练记录卡一张屏上混着两种窗口，标签却都写成「全历史」— `src/components/replay-history.tsx:48-51` 的 `rounds = history.length` 与 `overall = totalC / totalQ` 只数得进 `REPLAY_HISTORY_KEEP`（100，`src/lib/replay-history-limit.ts:8`）那几轮，本地写入与云端合并各裁一次（`src/lib/replay-store.ts:67`、`src/lib/sync-layer.ts:551`）；同一行旁边的 `最佳连击` 走 `readReplayBest()`（`src/lib/replay-store.ts:80`）读独立的 `tb-replay-best`，合并时取 `mergeReplayBest(local, cloud)` 的最大值（`src/lib/sync-layer.ts:675-677`），从不随窗口裁掉。三个数分别是「最近 100 轮的轮数」「最近 100 轮里答对的比例」「全部历史里最长的一次连击」，而标签是 `累计轮次 / 总正确率 / 最佳连击`（en "Total rounds" / "Overall accuracy" / "Best streak"）——前两个说的「累计/总」与第三个说的「最佳」不在同一个窗口里。这不是没人写过 100 这个数字：隐私页「保留最近…」那段已经把 100 轮交代给用户了，`privacy-endpoints.test.ts:277-291` 还把这段的数钉在 `REPLAY_HISTORY_KEEP` 上，所以「只数最近 100 轮」是本站自己承认的事实，只有 /replay 这一屏把它讲成「累计」。要一起定的是趋势线那 20 轮（R16.62 末尾）：同一张卡上三处窗口（20 画图 / 100 计数 / 全历史连击）。三条路各有代价：①标签改成「最近 100 轮」→ 最省，代价是「累计轮次」这个用户能感知的成就数字变小、且连击仍是全历史，一张屏三种口径；②让连击也随窗口重算 → 口径统一，代价是删掉一个真实的长期记录，且换设备/清本地后就再也算不回来；③把全历史的轮数与正确率另存两个累加量 → 标签不用改，代价是多两个要同步要合并的键，R9.5 那条离线写队列与 R16.59/R16.60 的待传提示都要跟着重算。**开工条件**：出现用户按「累计」理解并因此误判自己训练量的反馈，或回放统计要进分享卡（分享卡上的数字一旦被截出去就得当场说清是哪个窗口）时。
- [x] R16.65 打错币对被判成「币安 API 可能不可达」，而它明明答了一句 400 — 图表的自定义输入框只按形状放行（`src/lib/chart-symbols.ts:22` 的 `CHART_CUSTOM_SYMBOL = /^[A-Z0-9]+USDT$/`），能不能取到数据要等真实应答；实测（本轮 curl）`NOTAREALPAIR` 与只在合约市场有的 `1000PEPEUSDT` 都是 **HTTP 400 + `{"code":-1121,"msg":"Invalid symbol."}`**——币安活着、也答了，答的是「这个现货交易对不存在」。可 `fetchKlines`（`src/lib/binance.ts`）把任何非 2xx 都压成 `new Error("行情请求失败 (400)")`，`kline-chart.tsx:216` 的 catch 又把它统一判成 `status="error"`，屏幕上就是 `src/lib/i18n.ts:121` 那句「行情加载失败，币安 API 可能不可达」/ en `:509` "Binance API may be unreachable"，旁边一个「重试」。界面把原因说反了：唯一的补救（换个币对）没提，提的那两条（等网络、点重试）对 400 一定无效——重试重发的是一模一样的请求。这条一直没被发现，是因为**代码里早就写着正确答案**：`chart-symbols.ts:19` 的注释就点名「`1000PEPEUSDT` 只在其合约市场有，现货 -1121 Invalid symbol，输了会得到图表错误态」，FAQ（`src/app/[locale]/faq/page.tsx:48`）也承诺「可以输入任意以 USDT 计价的币安现货交易对」——两处都知道形状闸门挡不住不存在，只有那句错误文案不知道；用例侧则从来没有一条断言过失败态说什么（`kline-chart.test.tsx` 原先只在失败时断言「有重试按钮」，`binance.test.ts` 只测过 451）。改法：`binance.ts` 新增 `InvalidMarketSymbolError`，只在「400 且 body 的 `code` 恰好是 -1121」时抛它，其余照旧；组件多一个 `badSymbol` 状态与一条 `chart.badSymbol` 文案（zh/en），把上游的 `msg` 留在日志、不进界面（与 R16.54 同一条规矩）。注释按事实改写。验证：`binance.test.ts` 加 3 条（-1121 → 专用类型；400 且 code 是 -1120 → 仍按请求失败报状态码；400 的回答不是 JSON → 读不出码也按请求失败），`kline-chart.test.tsx` 加 1 条（屏幕上是没有这个交易对，且「行情加载失败」那句不得出现）。变异核对两组：把 code 判断摘掉（任何 400 都算币对不存在）→ 后两条红，打印 `expected … to throw /行情请求失败 \(400\)/ but got '没有这个交易对：BTCUSDT'`，证明「越权下结论」是这条用例在挡的；把组件的 `setStatus("badSymbol")` 改成 `setStatus("error")` → 该条红 `Unable to find an element with the text: 没有这个交易对`。`tsc --noEmit` 逼着三个字典装配点（`chart-embed.tsx` 的接口与字面量、课文页 `page.tsx:339`）各补一处，少一处都编译不过。**本轮没顺手改的**：形状闸门本身（`CHART_CUSTOM_SYMBOL.test(v)` 不通过时输入框静默不吃这个值，屏幕无任何提示）与失败态那个「重试」按钮（币对不存在时点它必然得到同一句）——前者是另一处「用户做了动作而界面不回应」，后者要说清的是「按钮在不在」与「点了有没有用」两件事，各自单开。 **⚠️ 2026-09-24 追加（这条台账当时就是不全的）**：上面那句「少一处都编译不过」之后，界面上并没有真的出现「没有这个交易对」——币安的 4xx 应答不带 CORS，浏览器读不到那个 400，判据在真浏览器里到不了；当时的取证是 curl 加桩掉的 `fetch`，缺的正是浏览器这一跑。改法与复验见 R16.72。
- [x] R16.66 首页行情卡把「24 小时涨跌」挂在「实时行情」标题下，屏幕上没人说这件事 — `src/components/market-ticker.tsx:62` 请求的是 `/api/v3/ticker/24hr`，`:80` 取的是 `priceChangePercent`——它比的是**二十四小时前那一刻**，而同一张卡里 `:182` 那个价格是本轮轮询刚拿到的快照，`:27` 的标题写着「实时行情」/ "Live market"，`:187` 把它渲染成 `▲ 1.23%`。两个数字并排、共用一个"实时"的标题，读的的人只会理解成"刚才那一笔涨了 1.23%"。价格这一侧本站没撒谎：轮询节奏由 `slow` 那行交代（"每 {n} 秒更新一次"）、拉不动时 `stale` 会标"上次数据"（`:168` 的注释就是 PR #139 之后补的），**只有百分比从来没被交代过窗口**。为什么一直没被发现：既有用例钉的是透传正确——`market-ticker.test.tsx:34` 断言屏上出现 `▲ 1.23%`，与 `priceChangePercent` 一致就算绿，没有任何一条问"界面有没有说清这是哪个窗口的数"；而这份字典是组件自己建的 `const DICT`（`:26`），既不在 `check:dead-copy` 的 `i18n*.ts` 口径里，也不在 `check:localized-labels` 能看见的语法位置上（那条门禁只看属性字面量与裸 JSX 文本，与 R16.63 同一族盲区），所以写错的窗口不会有任何门禁变红。改法：卡片底部补一行 `changeNote`（zh「箭头里的百分比是 24 小时内的涨跌，不是这一笔的变化。」/ en "The arrow shows the 24-hour change, not this tick."），走整宽的一行而不是每张币对卡的后缀——窄格加字会撞 320px 版面门禁。验证与口径同源：新用例**不写死 24**，而是从当场发出的请求 URL 里读 `/\/ticker\/(\d+)hr\b/` 抓出窗口数字，再断言屏幕上那行含同一个数——端点哪天换成不带窗口的 `/ticker/price`，用例先红并打印「请求的不是带窗口的端点」；英文那条另带一句「这行不许含中日韩文字」。变异三组逐条点名：删掉渲染那行 → 两条新用例同时红（`Unable to find an element with the text: /小时/`、`/24-hour/`）；把文案改成「1 小时」而端点不动 → 同源那条红（`expected '箭头里的百分比是 1 小时内的涨跌，不是这一笔的变化。' to contain '24'`）；只改 URL 里的窗口不改文案 → 同一条红（读出的数与屏上的数不等）。版面与体积实测：`npm run build` 后 `check:mobile` 14 个关键页面 320px 无溢出、`check:bundle` 全部 454 条路由在预算内（这一行加在首页卡片里，两处门禁正是为它跑的）；`market-ticker.test.tsx` 9/9 绿。**本轮没顺手改的**：标题「实时行情」四个字本身——价格是轮询快照，节奏与失效都另有交代，把它改成「轮询行情」属于措辞取向而非假话；以及 `TICKER_SYMBOLS` 三个币对要不要在卡上标出"以 USDT 计价"（清单本身在 `chart-symbols.ts:27`，FAQ 已按它生成文案）。
- [x] R16.67 「已回放 0/-24」：自定义结束时间落在标的上市之前时，分母是个负数，而界面什么都没有说 — 进度那条是 `src/components/replay-trainer.tsx:503` 的 `` `${Math.max(idx - context, 0)}/${klines.length - context}` ``：分子做了下限、**分母没有**。自定义模式的取数是 `:220` 的 `fetchKlines(symbol, interval_, { endTime: customEnd, limit: 300 })`，`customEnd` 由日期输入框换算（`:456-468`，本地日终，见 R16.38），于是把日期拨到该标的币安现货上市之前就是**一次成功的请求配一个空数组**——实测 `BTCUSDT` / `1d` / `endTime=1500000000000` 回 HTTP 200 + `[]`（0 根），`endTime=1503360000000` 回 6 根。context 是 50/30/15（`DIFFICULTIES`，`:30-34`），所以分母直接成了 `-50`、`-24`；同时 `setIdx(context)` 把起点放到长度之外，图面空着、价格条因 `klines[idx-1]` 不存在而隐藏，屏幕上只剩一句 `已回放 0/-50`。为什么没被发现：`fetchRandomHistoryWindow` 的注释早就写着「标的历史不够长时币安本就返回较少根数，由调用方自行处理」（`src/lib/binance.ts:91-93`），而随机模式抽的是距今 7~180 天的窗口、四个可选标的（`REPLAY_SYMBOLS`）历史都在数年之上，这条路径**在随机模式下真的到不了**——用例也就一直只在 300 根的完整窗口上打转。改法两处：分母取 `availableRounds = Math.max(klines.length - context, 0)`（`:167`，唯一出口，分子再夹进这个上限），并给这个状态一句真话——覆盖层 `dict.shortHistory`（zh `i18n.ts:267`、en `:655`）「这里只有 {n} 根 K 线，不够一轮（需要 {m} 根）。把结束时间往晚调试试。」，与"行情暂时不可用"分开：请求成功了，失败的是窗口。验证：`replay-trainer.test.tsx` 新增 4 条——两种语言的 `{n}`/`{m}` 占位符确实还在（防下面的数字断言退化成匹配静态字面量）、6 根时屏上是 `进度: 0/0` 且**没有任何 `/-数字/`**、0 根时说的是同一句话而不是 fetchError、300 根完整窗口时这句话不出现；数字用默认难度「进阶」（context 30 → 需要 31 根）与 `makeKlines(6)` 推出来。变异三组逐条点名：分母退回 `klines.length - context` → 该条红 `Unable to find an element with the text: /进度: 0\/0/`；撤掉覆盖层 → 两条红（`只有 6 根`、`只有 0 根` 都找不到）；把 `availableRounds` 改成不扣 context → 该文件 37 条里 17 条同时红（新增那条 + 16 条既有用例，它们断言的 `0/270` 就是这个数），说明这个出口确实是全场共用的那一个。
- [x] R16.68 R7.3 的「低端机只保留最近 N 根」是一条只在填图时成立的承诺，用例标题也在替它说谎 — 注释 `src/components/replay-trainer.tsx:290` 写「低端机只保留最近 `REPLAY_REDUCED_CANDLES` 根，降低 Canvas 负载」，可这条裁剪只长在 `fillSeriesTo()` 里（`klines.slice(0, to).slice(-N)`），而它的三个调用点是数据变化、「跳到回放末尾」与换轮重填；**逐根推进走的是 `stepForward()` 的 `series.update()`**（R16.61 特意维持了这个分工，否则每根重设整张图播放就做不成），`update()` 不回头裁。真实常量是 150（`src/lib/perf.ts:29`）、窗口是 300 根（`fetchRandomHistoryWindow` 默认 `count = 300`），所以低端机播放到后半程时序列一路长回 300——承诺的是"屏上永远只有 N 根"，做的是"填图那一步裁到 N 根"。用例 `replay-trainer.test.tsx:414` 的标题「帧率不达标时只渲染最近 REPLAY_REDUCED_CANDLES 根」抄的就是注释那句话，而它测的只有初始填图，于是这条绿色一直在给假话盖章（与 R16.48 同形）。改法按事实而不是按愿望：注释与标题都改成「填图时裁，推进不回头裁」，并补一条用例把这个边界钉住——推进一根之后 `setData` 的调用次数不变、最后一次填图仍是 N 根，即"屏幕在推进时不受这条上限约束"是**写明并测过**的行为，不是漏网。为什么不动手让承诺成立：要让逐根推进也封顶，就得每根都 `setData()` 重设整段，而那正是 R16.61 为了避免"播放做不成"才拆开的路径；这条上限的意义是降低 Canvas 负载，300 与 150 根在一台帧率已经不达标的机器上差不了一整轮的差距，为此牺牲播放路径是净亏。取舍写在这里，将来真要封顶就连带重设计推进路径。验证：`replay-trainer.test.tsx` 33 条绿（+1，本批收尾时该文件 37 条）；`typecheck`、`lint --max-warnings=0` 干净；时钟巡检台账因为该文件是 `uncontrolled-timer` 的命中文件（那条真实 `setTimeout` 的**行号**被记在 `docs/test-clock-hygiene.md`），随本批一起重算（307 → 308）。变异核对：把 `useEffect` 的依赖加上 `idx`（等于让每根推进都全量重设）→ 新增那条红，打印 `expected 2 to be 1`，其余 36 条仍绿——它测的正是"推进不重设"这件事本身。
- [x] R16.69 自定义模式点「新一轮」重发的是同一个请求，拿回的是同一段 K 线 — 按钮文案是 `dict.newRound`（「新一轮 ↻」，`src/lib/i18n.ts:237`），两处（工具栏 `src/components/replay-trainer.tsx:481`、本轮小结 `:551`）都只做 `setRound((r) => r + 1)`。取数那条 effect（`:211-235`）的依赖里确实有 `round`，它会重跑一次 fetch——可自定义模式下 fetch 的是 `fetchKlines(symbol, interval_, { endTime: customEnd, limit: 300 })`（`:220`），而 `customEnd` 一个字没变：同一个 `endTime` 问到的是同一段 300 根。于是用户点「新一轮」看到的是**刚才那段行情重播一遍**，进度被清零、计时重新开始，这一轮照样走 `saveReplayRecord`（`:200`）记进训练记录——「累计轮次」里就这么混进了同一段历史的若干份。为什么一直没被发现：盲盒模式下 `fetchRandomHistoryWindow` 每轮都抽新窗口，「新一轮」在那条路上名副其实，而唯一一条按这个按钮的用例（`replay-trainer.test.tsx:544` 「新一轮会清空上一轮反馈并重置进度」）跑的正是盲盒——按钮的"新"从来只在它成立的那半边被测过。改法分两层：先把取样口径抽成一个出口 `sampleHistoryWindowEndMs(notAfterMs?)`（`src/lib/binance.ts:97`，把原先内联在 `fetchRandomHistoryWindow` 里那段「往前 7 ~ 180 天」的抽样一字不差搬出来，盲盒路径行为不变——`fetchRandomHistoryWindow` 原有的两条取样用例照绿就是这件事的证据），自定义模式的「新一轮」以**当前锚点为上界**另抽一段（`:241` 的 `startNewRound`），并把「截止日期」输入框跟着挪到那一段真正结束的那天：那一格从此说的总是屏幕上这段 K 线的结束日，而不是用户上一次手输的值。两个取舍写在这里：①没有选择"锚点不动、只偷偷往前抽"——那样输入框当场变成假话（写着用户选的那天，画的是更早的一段），与 R16.65/R16.66 同一类毛病；②锚点因此**单调往前**（每次至多 180 天），连点会在历史里一路退到标的上市之前，那里由 R16.67 的「这里只有 {n} 根 K 线」覆盖层接手，而它那句「把结束时间往晚调试试」此刻才是可执行的——要往上调的正是跟着挪过来的这一格。7 天不贴现价的前置留白一并继承：抽样永不落在锚点前 7 天之内，「新一轮」不是偷看近况的后门。验证：`replay-trainer.test.tsx` 37 条（+4：另取一段且输入框跟着走、盲盒模式不受影响、切到自定义但还没选日期时不假装抽样、回到盲盒后的「新一轮」不许改写用户填过的日期）、`binance.test.ts` 11 条（+3：给定上界时两个端点各钉一次、上界在未来时按现在夹住、不给上界就是盲盒口径）。变异六组逐条点名：`startNewRound` 退回只 bump round → 该条红（第二次 fetch 的 `endTime` 仍是那个锚点哨兵值）；撤掉 `setEndDateInput(...)` → 红在 `expected '2024-01-15' not to be '2024-01-15'`；改成 `localDateStr()`（不传那个时刻）→ 红在「截止日期应由取样出来的结束时刻经本地日历 helper 得出」，证明第二条断言不是第一条的复读；守卫从 `customMode && customEnd` 放宽成只看 `customEnd` → 红在「回到盲盒之后不许改写用户填过的截止日期」；`sampleHistoryWindowEndMs` 去掉 `Math.min` 夹住 → 红在「上界在未来时按现在夹住」；把 7 天与 180 天对调 → 4 条红（新增 3 条 + 既有的「抽样确实是随机的」）。**本轮没顺手改的**：模式开关本身在取数依赖里，所以光是从盲盒切到自定义就会重发一次请求（换掉屏幕上正在看的那一段）——那是另一件事，且没有文案在承诺它。
- [x] R16.70 形状闸门把用户输入静默吞掉：框里留着他打的字，图上还是原来那个币对，屏幕上什么都没有 — R16.65 末尾点名「另一处用户做了动作而界面不回应」的就是这里：输入框 `onBlur`（`src/components/kline-chart.tsx:330`）原先只有 `if (v && v !== symbol && CHART_CUSTOM_SYMBOL.test(v)) setSymbol(v)` 一条分支，**没有 else**。于是打 `DOGE`（少 USDT 后缀）或 `USDT`（前缀为空）时，失焦什么也不发生：`key={symbol}` 因 `symbol` 没变而不重挂载，框里仍是用户打的那串，图还是上一个币对——这恰好把 R16.14 花力气堵掉的「框与图不符」在另一条路径上重新制造出来，而且比原来更糟：那次是按钮换币后框没跟上（至少图变了），这次是用户改了框而图不动，两者都没有解释。为什么没被发现：既有用例只断言**不切换**（`kline-chart.test.tsx` 「自定义交易对非法时不切换」断言 `fetchKlines` 仍调在 `BTCUSDT` 上），等于把静默丢弃当成正确行为写进绿色；形状本身由 `chart-symbols.ts:22` 与 `chart-symbols.test.ts:81` 守着，从来没人问过屏幕。改法不是清空输入框（那会把用户打的字抹掉，改都没法改），而是把「没接受」说出来：新增 `rejectedSymbol` 状态（`:77`）与一条 `chart.customSymbolRejected`（zh `src/lib/i18n.ts:122`、en `:511`：「没认出来：交易对要以 USDT 结尾，前面只能是字母或数字」），用 `<p role="status">`（`:386`）渲染在工具条与图之间；形状合法时提交并清提示，点快捷币对按钮也清提示（否则点完按钮提示还挂着，说的是一个已经不成立的错）。文案里不出现任何币种名——`chart-symbols.test.ts:119` 那条「文案不得枚举币种」的门禁扫的就是 `i18n.ts`，而用形状描述（以 USDT 结尾 + 前缀字母数字）本来比举例更准。验证：`kline-chart.test.tsx` 38 条（+2：原「非法时不切换」升级为「不切换 + 屏上有那句提示 + 框里留着用户打的字」，另加两条清除路径），`check:mobile` 320px 两种语言不溢出（提示是整行 `<p>`，与 R16.66 那行同形）。变异五组逐条点名：撤掉 `<p>` 渲染 → 三条新用例全红；`onBlur` 退回本次修复前那三行原文 → 同样三条全红；合法分支去掉 `setRejectedSymbol(null)` → 只红在「改对形状之后重新提交，提示随之消失」；快捷按钮去掉清除 → 只红在「点快捷币对按钮也能撤掉那条未接受的提示」；把提示文字改写死在 JSX 里 → `check:localized-labels` 当场判红（它扫 JSX 文本节点，与 R16.63 那个模板字符串盲区不同）。
- [x] R16.71 币对不存在时还挂着一个「重试」，而它重发的必然是同一个必定失败的请求 — R16.65 把这条记在「本轮没顺手改的」里：错误覆盖层（`src/components/kline-chart.tsx:410`）原先让 `error` 与 `badSymbol` 共用一段 JSX，`重试` 按钮照挂。两种状态的动作价值完全不同：`error` 是拿不到行情（网络、5xx、超时），重发有意义；`badSymbol` 是币安**已经答过** 400 + `-1121「没有这个交易对」`，点一次只是把同一个 `symbol` 再要一遍，回来还是同一句。留着它有两个代价：把「可点的补救」让给一个必定无效的动作，而真正那一条（换币对）写在上一句文案里；而且按钮的存在本身在暗示「再试一次有可能成」，那是一句没有说出口的假话。改法是一个条件：`displayStatus === "error"` 才渲染，理由写进旁边的注释。验证：`kline-chart.test.tsx` 那条 badSymbol 用例把三条断言并在一起——屏上是「没有这个交易对」、不是「行情加载失败」、**也没有「重试」**，且 `fetchKlines` 只被调过 1 次（多一次就是有人在替用户点那个无效按钮）；`timeout` 与 `error` 各自的重试用例照绿，证明没把该留的一起删掉。变异一组：把 `displayStatus === "error" &&` 换成 `true &&` → 只有该条红（`expected <button>重试</button> to be null`）。
- [x] R16.72 上一条修的那句「没有这个交易对」在浏览器里永远读不到——币安的非 2xx 应答不带 CORS，跨源的 400 被网络层整个挡掉 — 这是 R16.65 落地之后、用真浏览器（Chromium + 本地生产构建）跑出来的事实，不是推理：`api.binance.com` 只在 **2xx** 响应上带 `access-control-allow-origin: *`，实测 200 有、400 一个 CORS 头都没有；于是浏览器里 `fetch(klines)` 对不存在的币对**直接 reject**（TypeError: Failed to fetch），`res.status`、`res.json()`、那台 `-1121` 的判断统统执行不到，屏幕上还是那句「行情加载失败，币安 API 可能不可达」。同一条请求用 curl 发出去是 `HTTP/2 400` + `{"code":-1121,"msg":"Invalid symbol."}`——R16.65 的取证本来就是 curl 与桩掉的 fetch 两头做的，唯独没在浏览器里跑过一次，所以「用例绿、curl 绿、界面仍然说错」。改法不是在组件里猜状态码，而是换一条**读得到**的证据：`fetchKlines` 的 fetch 抛出后（且不是 abort），先打一次币安的 ping 端点（200 且带 CORS，浏览器读得到）；ping 答了而 K 线没答，失败就是这个标的特有的 → `InvalidMarketSymbolError` → 界面那句「没有这个交易对」现在真的会出现在屏幕上（R16.71 那个「不给无效重试」的判断也随之一并活了）；ping 也不答 → 原样把网络失败交回去，仍报「可能不可达」。取舍写清楚：这是**推断**不是读码，判据是「同一个主机此刻应答了这个轻端点」，所以文案口径保持「币安现货没有这个交易对」而不写成「币安回了 -1121」；ping 只在失败路径上多发一次，成功路径零成本。R16.65 那段台账不改写（它记的是当时的事实与验证），漂移在它末尾追加一句指向这里。验证：`binance.test.ts` 14 条（+3：K 线被网络层拒掉而 ping 答了 → 专用类型；ping 也不答 → 原样抛 TypeError 不越权下结论；abort 时不再发第二次请求）；真实浏览器复验两遍——修复前的构建上覆盖层印的是「行情加载失败，币安 API 可能不可达」+「重试」，修复后同一台 Chromium、同一个 `ZZZZUSDT` 打到同一份本地生产构建，请求序列是 klines(BTCUSDT) → klines(ZZZZUSDT) → ping，覆盖层是「币安现货没有这个交易对，换一个试试」，「重试」个数 0、形状提示个数 0、320px 横向溢出 0px。另有一处被门禁抓到：本仓隐私页那道门禁（`privacy-endpoints.test.ts`）扫的是**源码文本**里「引号/反引号紧接 `/api/…`」的形状，我在注释里写的 `` `/api/v3/ping` `` 当场被判成一个未披露的接口调用——不是误报，是这条门禁故意的宽松（新增调用没上隐私页就该红），改法是注释里不写那个形状，并把这条陷阱写进门禁自己的说明。 **2026-09-24 追扫（同类还有没有第二处）**：判据是「跨源请求 + 状态码走进了用户可见的话」。扫过 `src/` 全部客户端 `fetch`：`ai-chat.tsx:351/360`、`ai-quiz.tsx:57/61`、`term-explainer.tsx:100` 打的都是同源 `/api/ai/*`，状态码在浏览器里读得到，不在这类里；唯一一个同为跨源的是 `market-ticker.tsx:69` 那句 `throw new Error` 带状态码，但它当场被 `:88` 的 catch 吞掉、从没上过屏幕，界面上只有 `DICT.error` 的「行情暂时不可用 / Market data is temporarily unavailable」——那一句只对时效性做了承诺，对失败原因什么都没断，所以读不到状态码并不构成说错。**结论是不改，把扫过的范围记在这里，下一轮不必重扫**；哪天要动它，该动的是界面有没有哪一句在替失败编原因，而不是那行状态码本身。
- [x] R16.73 成就墙整面是写死的中文，英文访客看到的是「第一步 / 月度王者」，而「清空错题」那枚没人清过 — 徽章从 `src/lib/learn-stats.ts` 的 `BADGES` 数组直接渲染（`src/components/stats-client.tsx:854`、`:855` 与 `:864`、`:865` 各印一次 `b.name` 与 `b.desc`，解锁与未解锁两列都印），所以 R16.50 那道「写死单一语言的界面文案」门禁看不见它——它扫 JSX 属性与裸文本节点，中文住在 lib 的数据里就一路畅通。同一屏旁边的热力图与雷达图反倒有 `locale === "en" ? … : …`（`stats-client.tsx:831`、`:836`），只有成就墙漏了。第二处是文案自己说多：`wrongbook-empty` 的条件是 `readDocs > 0 && currentWrong === 0`，数据里没有任何「曾经错过」的历史，读得够多、一道没错的人同样满足，可它名字写「清空错题」、条件写「错题本清零」，把一个状态说成了一个动作。改法：`Badge.name` 与 `Badge.desc` 收成 `{ zh, en }` 两版，少写一边直接是编译错误而不靠巡检兜底；组件按 `locale` 取值；那枚改名「没错题 / Clean sheet」，条件改成「读过课文，且错题本此刻是空的 / You have read lessons and your wrongbook is empty right now」，说的就是 `check` 真正断言的事，判定逻辑一字未动（`readDocs>0` 这个边界早就有用例钉着）。验证：`src/lib/learn-stats.test.ts` 加 2 条（每枚两版齐全且英文版不含汉字；这枚两种语言都不许出现「清零 / 清空 / cleared」字样），`src/components/stats-client.test.tsx` 加 2 条（英文界面找得到 First step 且找不到第一步，中文界面反过来）；两个文件 49 条绿，`typecheck` 因为类型收紧逼着渲染点改到位。变异核对三组：`badgeLocale` 钉成 `"zh"` → 只红英文那条；往某个 `en` 字段塞汉字 → 只红「英文版里不留汉字」；把名字与条件改回「清空错题 / 错题本清零」→ 只红语义那条，而「两版齐全」仍绿，说明两条断言各管各的。同一处审计另外抓到两条，另立 R16.74（学习日历旁边的天数不是那张网格点得亮的天数）与 R16.75（掌握度雷达画的既不是最近五章、也没在测掌握度）。
- [x] R16.74 学习日历标题数的不是那张图画出来的日子，单位还写死英文 — 标题那一行是 `{activeCount} {activeCount <= 1 ? "day" : "days"}`（`src/components/activity-heatmap.tsx:49`），而 `activeCount = activeSet.size` 取的是 `readActivityDates()` 返回的**全部**记录；记录保留 365 天（`src/lib/activity-calendar.ts` 里 `dates.slice(-365)`），格子却只画 26 周 = 182 天（`WEEKS` 常量与那圈 `for (let week...)`）——半年之外的日子点不亮任何一格，却照样进标题那个数。同一行还把英文单位写死，中文界面印「学习日历 · 3 days」，与 R16.63 那批 tooltip 同一类。改法：标题改数 `inWindow`（图里真亮着的格子），窗口外的日子另给一句「另有 N 天早于这张图 / N earlier than this chart」，单位按 `locale` 走（中文「天」不分单复数，英文按数量走 day/days）；空态仍按「有没有任何记录」判，不改成按窗口判——那会把有旧记录的人说成没学过。验证：`activity-heatmap.test.tsx` 4 条新用例（窗口外记录不混进标题、图里有记录时也不重复计数、中文写「天」且屏上不该出现 days、英文单复数各一例），并且原来那条 `labels the grid with the recorded day count` 断言的正是这个 bug（两条窗口外的日期被数成 2），改写后它变成窗口口径的第一条证据。变异核对两组：`inWindow` 退回 `activeSet.size` → 只红两条窗口用例；`dayUnit` 钉成英文 → 红「中文界面写天」与那条 0 天的窗口用例。
- [x] R16.75 掌握度雷达既没在测掌握度、也没在画「最近 5 个」，而它的空态是死代码 — 旧实现把 `Object.keys(QUIZZES)`（27 章）整个映射成轴，没做过的章节记 `value: 0`，再 `.slice(0, 5)`——那是**题库源顺序里的前五章**，注释那句 `// 最近 5 个` 与文件头「5 个最新测验维度」都没有依据（作答日期在另一份账本 `tb-quiz-attempts`，组件从未读过）。形状因此把「没测过」画成「0 分掌握」，刻度点还按 `value >= 50` 判色，全部标成未达标。第三条更安静：`axes.length === 0` 那个分支因为轴恒为 5 而永远走不到，「完成测验后查看掌握度」是一句渲染不出来的死文案——`check:dead-copy` 看不见它，那套管字典键，不管组件内联串。改法：轴只收 `readQuizProgress(slug)?.done` 的章节；排序按 `readQuizAttemptLedger()` 里该章最近一次 `at`，账本没日期的排在后面（不给老数据编日期，与旁边 `quizTrendDesc` 同一条口径），上限仍是 5 根；不足 3 根围不出多边形，于是走空态，`RADAR_MIN_AXES` 导出给 `stats-client` 写提示用，空态文案随之改成「完成 3 章测验后看掌握度雷达 / Complete 3 chapter quizzes to see the radar」——数字只有一个主人，改阈值时文案跟着走。账本条目的字段类型是 `unknown`（`QuizAttemptEntry` 对 localStorage 一律放宽），组件里自己收窄，`tsc` 抓到过我第一版没收窄的写法。验证：`radar-chart.test.tsx` 重写为 8 条（不足三章给空态、没做过的不进轴也不画 0、按最近作答排序且无日期的不编日期、同分时按题库顺序落定、上限五根、编号前缀剥离、顶点半径、事件重读）。变异核对两组：让未做过的章节回到轴里 → 5 条红；去掉按日期排序 → 只红「轴按最近一次作答排前面」那一条。
- [x] R16.76 测验页那两句各自承诺一个数字，两个都没落地 — ①标题下那行是 `{dict.questionsUnit}`（`src/components/quiz.tsx:171`），中文词条本身是「道概念题 · 即时判分」式的量词开头（`src/lib/i18n.ts:94`，en `:483` "concept questions · instant grading"），组件却不把题数给它，于是屏幕上是一句以量词开头的残话；隔壁同一份字典的 `src/components/chapter-exam-card.tsx:64` 反倒写了 `{total} {dict.questionsUnit}`，说明不是口径设计而是这一处漏了。②答题时那行 `progressTpl` 中文是「第 {i} / {n} 题 · 已答对」、英文是 "Question {i} / {n} · Correct: "（`i18n.ts:98`、`:487`），渲染点只代入 `{i}` 与 `{n}`（`quiz.tsx:229`）——「已答对」后面什么都没有，英文那句以冒号收尾、冒号后面是空的，而那个数一直在组件状态里（`correct`，`quiz.tsx:61`，`pick()` 里加一）。改法：标题取 `quiz.questions.length`；`progressTpl` 加 `{c}` 占位符并由组件传 `correct`，英文顺带改成 "Question {i} / {n} · {c} correct" 不再以冒号收尾。验证：`quiz.test.tsx` 的字典夹具把 `progressTpl` 换成带 `{c}` 的形态（不然换词也测不出代入），新增 2 条（标题里是「3 题」而不是光一个量词；作答前 1/1 对 0、答对后 1/1 对 1），并把原来那条 `queryByText(/对|错/)` 收紧成整串匹配「对」「错」——进度行现在合法地含「对」字，用子串会把自己判成反馈。变异核对两组：去掉 `c: correct` → 该条红；去掉题数前缀 → 标题那条红。别指望产物门禁兜这两处：进度行只在点开测验、水合之后才存在，而 `e2e/placeholder-leak.spec.ts` 的水合清单 `HYDRATED_ROUTES` 只有 ai/stats/path/replay/glossary，且每条都断言 `isKnowledgePage(route)` 为 false（防止有人把界面页挪进知识库让严格口径静默退化），所以知识库路由的客户端文案从来不在它的覆盖面里；标题那处虽然进了产物（`zh/knowledge/getting-started.html` 可见文本 `3 道概念题 · 即时判分`），修的问题也不是「漏占位符」而是「少了个数」，泄漏门禁同样管不着。这两条只有单测钉得住。
- [x] R16.77 章节 AI 导读失败时整张卡片消失，而「生成失败，请重试」从来没有渲染点 — `src/components/chapter-summary-ai.tsx:82` 是 `if (failed && !summary) return null;`：读者点「生成摘要」，转一下，然后连按钮带标题一起没了，要再试只能刷新页面。字典里那句 `aiSummaryError`（`src/lib/i18n.ts:83`，en `:472`）由 `src/app/[locale]/knowledge/[chapter]/page.tsx:236` 装配进组件的 `Dict.error`（`chapter-summary-ai.tsx:11` 声明），**组件从头到尾没读过它**。这条不是新发现的口径要拍板：R3.6 当年记的决定就是「失败整个卡片隐藏，不展示错误文案」，还有一条用例钉着；但 R16.54 后来在 AI 出题那边换了同一种失败的口径——「生成失败后按钮也不再消失，可以直接重试」。也就是说这是那批修法漏掉的最后一张卡，跟新的口径走而不是另起一念。改法：失败且还没出摘要时保留卡片、按 `role="status"` 念出 `dict.error`，按钮因 `!summary` 仍在原地可点。验证：`chapter-summary-ai.test.tsx` 那条「失败降级：整个入口隐藏」按新期望改写（错误文案出现、按钮还在、再点真的发第二次请求），9 条绿；变异核对——把 `return null` 塞回去，只有这一条红。顺带记下这条为什么没被门禁抓到：见 R16.78。
- [ ] R16.78 组件字典接口里声明、页面装配好、组件自己从不读的字段，`check:dead-copy` 看不见 — R16.77 那句 `aiSummaryError` 就是活案例：死键巡检的口径是「字典里没有任何**非字典引用点**的词条」（`scripts/dead-copy-lib.mjs` 的 `collectUsedIdentifiers`），而装配点 `page.tsx:236` 的 `error: t.chapter.aiSummaryError` 就是一个非字典引用，于是它算「被使用」，可真正渲染的组件一次都没读 `dict.error`。这种键比裸死键更危险：下一个人改了字典会真心以为改到了界面。要加的规则：凡 `src/components/*.tsx` 里声明了「字段全是 string 的字典接口」，每个字段都必须在**同一个文件**里被 `dict.<字段>` 或解构读到，否则判死键；预算与 R16.21 一样取 0（R16.77 修完当前应无命中）。开工代价小：接口块解析 + 文件内引用扫描，但要处理把字典整个透传的组件（例如 `chart-embed.tsx` → `kline-chart.tsx` 的 `ChartDict`），这类得允许在下游文件里读。
