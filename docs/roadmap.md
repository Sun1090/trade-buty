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
- [ ] R16.11 统计导出把「测验平均分」装在名为 `bestPct` 的字段里 — 需要一次 schema 决策：`src/lib/learning-overview.ts:85` 用 `safePct(input.avgQuizScore)` 填 `quizzes.bestPct`（`avgQuizScore` 是各章最高分再取平均，`src/lib/learn-stats.ts:97`），而 `src/lib/stats-export.ts:18` 声明、`:62` 原样透传进导出文件的 `quizzes.bestPct`。站内的标签是中性的「测验记录 / Quiz record」（`src/lib/i18n-stats.ts:40`），所以屏幕上没有假话；假话在机器可读的那份产物里：拿到 JSON 的程序会把它当成历史最高分。同类还有 `engagement.totalStudySeconds`——它其实是 90 天窗口（`src/lib/study-time.ts:18`），界面文案写明了窗口，字段名没有。该文件自己的契约写着「字段命名稳定：新增字段只追加，不改名、不改语义」（`src/lib/stats-export.ts:8`），所以三条路各自都有代价：①加 `avgPct` 新字段并让 `bestPct` 名副其实（要真的算各章最高百分比的最大值），旧字段保留一个版本再废弃；②`STATS_EXPORT_VERSION` 1→2 并改名，同时给导入工具写版本分支；③维持现状，只在导出文件的 README/注释里声明这两个键的口径。未选定前不动数据，避免又造出第四套测验口径（对照 R16.10）。

- [ ] R16.12 低带宽是否应该真的把 K 线根数降到精简模式 — **需产品决策，不擅自选边**：`src/components/kline-chart.tsx` 里 `density` 只看视口（`getChartDensityFromViewport(isNarrowViewport, forceFull && !lowBandwidth)`），低带宽只做到两件事——`useNetworkQuality()!=="online"` 时不建 WebSocket、隐藏「显示完整」的入口。桌面宽度慢网下 `dataLimit` 仍是 `FULL_CHART_CANDLES`（500 根）。原来那句提示写的是「已切换为 180 根 K 线精简模式」，在桌面端是假话，已按「只说代码真做了的事」订正（`slowNetwork` 现在只说暂停实时推送）。剩下两个方向要选：①让低带宽真的把根数降到 `COMPACT_CHART_CANDLES`（省流量，但桌面用户会突然看不到长历史）；②保持现状，即低带宽只关推送（当前实现）。选①要同时决定窄屏是否还允许手动「显示完整」。

- [ ] R16.13 英文翻译状态的两句文案可能已经过期 — **需上游核实，不在站内改口径**：`content/kline-buty/docs/knowledge/en/` 现在有 27 个章节目录（与 zh 同数），于是 `/[locale]/path` 的 `translationNote` 渲染出来是「🚧 English translation in progress — 27/27 chapters available so far」，FAQ 也还写着「英文内容正在翻译中，部分章节可能仍是中文」。目录数不等于翻译完成度：`check:kb-parity-budget` 盯的是结构对齐，句子通不通、有没有整段仍是中文要在 kline-buty 侧逐章确认（本仓不得就地改 submodule 内容）。确认完成后统一改这两处文案；确认之前保持现状，避免把「目录齐了」当成「翻完了」写进界面。

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

- [x] R16.27 CONTRIBUTING 让贡献者 `cp .env.example .env.local`，可这个文件从来没入库 — `.gitignore` 第 34 行是 Next 模板原样的 `.env*`（注释还写着「can opt-in for committing if needed」），**没有** `!.env.example` 例外，`git ls-files` 里也没有这个文件；而 `CONTRIBUTING.md:29` 第一步就是 `cp .env.example .env.local`，`docs/v0.6-release-review.md:117` 更写着「受版本控制的只有 `.env.example`」。三处说法里只有 CONTRIBUTING 是要人执行的动作，所以新贡献者照做会 `No such file or directory`——`docs/env.md` 那份权威说明读得到，但没人会先想到要照着手抄 13 个变量。修法取「让说法变成事实」而不是改历史记录：`.gitignore` 补 `!.env.example` 并入库该文件（值全是占位符：`https://your-project.supabase.co`、`your_anon_key`、`gpt-4o-mini`、`text-embedding-3-small`，逐个核对过不等于本地 `.env.local` 的真实值，`check:secrets` 现在扫得到它且 0 findings）。只入库还不够——**没有门禁保证它不腐烂**，下一个新增变量的 PR 就会让它重新变成假话，所以把 `check:env-docs` 从「代码 ↔ docs/env.md」两方扩成三方：`extractExampleVars` 收 `.env.example` 的键（`# KEY=` 这种注释掉的可选变量同样算登记），代码读取的每个运行时变量必须在示例里出现，示例里的每个键必须真的被代码读取；`run()` 额外要求文件存在，缺席即 `exit 1`（正是今天的状态）。两侧今天恰好一一对应（13 ↔ 13），门禁即刻通过，并以 `extractExampleVars(...).size === required.length` 作为防空转。`docs/env.md` 开头那句「本文件是唯一受版本控制的环境变量说明，`.env*` 全被 gitignore」同批改掉——它描述的正是那个让 CONTRIBUTING 落空的规则。测试 +4 条（缺键、幽灵键、注释行算登记、CLI 分支含「文件不存在」），变异三组各自转红：删掉示例里的 `AI_MODEL` 行 → 「.env.example 未列出 AI_MODEL（代码在读取它，见 src/lib/ai/client.ts）」；加一行 `AI_RETIRED_KEY` → 幽灵条目；把 `.env.example` 改名 → CLI 分支报「不存在」而不是静默通过
