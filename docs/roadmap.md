# Roadmap v0.3「运营与硬化」（下一版本 · 36 项）

> 前版本状态（已核验）：P0 骨架、P1 边学边练、双语 UI、回放训练、测验/错题本地版、
> 云端同步（sync-layer + RLS + auth 全链路已在树内）、AI 功能（/api/ai）、PWA manifest、
> sitemap/robots、阅读工具链 —— 235 单测全绿。
>
> v0.3 不做大功能，只做三件事：内容运营自动化、质量门禁、增长收尾。
> 每项标注验证方式；`[手动]` 需账号或人工操作。

## Q1 内容运营自动化（Q1.1–Q1.8）

- [x] Q1.1 `kb:update` 一条龙（拉取 + 契约校验 + 索引/资产同步 + 构建回归）
- [x] Q1.2 en 中英 parity 跟踪脚本（`npm run kb:parity`，--strict 可做门禁；当前 27/27 全齐）
- [x] Q1.3 死链检查脚本（`npm run check:links`，436 页/8052 链接零死链，CI 阻断；2 处 en 锚点告警已定位为上游翻译遗留）
- [x] Q1.4 搜索索引对账（`npm run check:search-index`，400/400 对账通过，CI 阻断）
- [ ] Q1.5 frontmatter 质量门禁已在 prebuild（缺 title/description 报警）——确认 CI 日志可见
- [ ] Q1.6 KB 更新演练月度化：每月跑一次 kb:update 并记录变更（docs 下 changelog 片段）
- [ ] Q1.7 新章节上线清单（索引/sitemap/测验挂载点/路径分组四项核对）
- [x] Q1.8 kline-buty 侧 en 翻译收官（27 章全齐，已上线）

## Q2 质量门禁（Q2.1–Q2.8）

- [x] Q2.1 i18n 深层 parity 测试（全字典递归比对，CI 常驻）
- [x] Q2.2 Bundle 体积预算（`npm run check:bundle`，内容页 280KB/chart 360KB，CI 阻断；基线 217KB 为框架固定成本）
- [x] Q2.3 Lighthouse CI（三页门禁：a11y/bp/seo≥90 error，性能≥70 warn；实测首页87/课程95/图表65）
- [ ] Q2.4 a11y 抽查：键盘全程可操作（测验答题、回放控制、灯箱 ESC）、焦点可见、表单 label
- [x] Q2.5 320px 回归（`npm run check:mobile`，12 关键页，CI 阻断；修掉 path/knowledge-graph 两处 grid truncate 溢出）
- [ ] Q2.6 错误边界覆盖率：图表/搜索/AI 三个外部依赖入口都有降级 UI
- [ ] Q2.7 [手动] Sentry（或同类）错误监控接入 + 告警通道
- [ ] Q2.8 [手动] RLS/越权/双设备同步线上联调（需 Supabase keys）

## Q3 增长收尾（Q3.1–Q3.6）

- [ ] Q3.1 [手动] Google Search Console 提交 sitemap + 请求编入索引
- [ ] Q3.2 [手动] Bing Webmaster（可从 GSC 导入）
- [ ] Q3.3 [手动] Vercel Analytics 开启（免费档）
- [ ] Q3.4 [手动] PostHog 事件埋点评审（P4 按流量决定是否接入）
- [ ] Q3.5 分享链路走查：OG 卡片在微信/X/Telegram 的实际渲染抽查
- [ ] Q3.6 [手动] 冷启动内容分发（知乎/B站/雪球，见 docs/growth-checklist.md）

## Q4 体验 backlog（按需认领，非阻塞）

- [x] Q4.1 回放自定义窗口（盲盒/自定义切换 + 截止日期选择，币种周期复用）
- [x] Q4.3 搜索建议词（标题优先 Top 6 联想 + 方向键/回车/ESC，键盘可达）
- [ ] Q4.4 课程页「预计阅读时长」多语言文案复核
- [x] Q4.5 三主题对比度复核（muted/faint/accent 全面 AA，全站截图回归无破损）
- [x] Q4.6 TOC 移动端抽屉（原生 details 折叠，xl 以下显示）

## Q5 工程卫生（Q5.1–Q5.4）

- [ ] Q5.1 docs 与实现一致性走查（plan/research/p2-research 过时段落更新）
- [ ] Q5.2 AGENTS.md 契约段复核（KB 结构若再变，同步更新）
- [ ] Q5.3 依赖月度审计（npm outdated + 安全通告）
- [ ] Q5.4 [手动] 备份演练：Supabase 数据导出 + 仓库镜像确认

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
- [ ] R2.2 难度档（入门/进阶）影响出题深度与选项迷惑度
- [x] R2.3 生成题去重（bigram Jaccard 与固定题库及同批新题互去重，阈值 0.6，3 单测）
- [x] R2.4 解析质量写入章节出题 prompt（须引用章节概念、禁止空话、无依据不编造）
- [x] R2.5 出题失败降级（服务端 AI 失败回退本章固定题带 fallback 标识；前端错误文案兜底不白屏；2 单测）
- [x] R2.6 AI 变体题与错题本打通（答错刷新来源错题条目、答对移出；4 组件单测含错题本读写）
- [x] R2.7 AI 题标注来源（🤖 AI 生成徽标 + fallback 标识 + 卡片底部免责一行；5 组件单测）
- [x] R2.8 review 页 AI 题幂等（作答一次锁定、recordWrong 同 key 覆盖不重复、举报去重；单测覆盖）
- [x] R2.9 出题语言跟随 locale（buildChapterQuizPrompt 双语指令，en 出英文题；2 单测）
- [x] R2.10 成本控制（maxTokens 3000 + 同章/语言/难度 24h 内存缓存；edge 实例级，跨实例去重靠 R2.3）
- [x] R2.11 题目举报入口（review 变体题与章节 AI 题均有一键举报 → /api/ai/feedback unhelpful，单次去重）
- [x] R2.12 覆盖率看板（scripts/quiz-coverage.mjs：27/27 可 AI 出题、固定题 2/27、en 元数据 27/27；npm run quiz:coverage）

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
- [x] R4 温和过期提醒（「过期 N 天——今天补上就好」，旧数据不标红）
- [x] R5.5 状态机（new→stage0→…→mastered 状态图写入 srs.ts 注释；wrongbook.applySrsResult 落地，ai-quiz/review 接入）
- [x] R5.6 旧数据回填（无 srsDue 的条目按 at+1 天推算，effectiveSrs 统一入口；单测覆盖）
- [x] R5.7 云端同步（迁移 0006 wrongbook+srs_stage/srs_due；syncWrongbookWrite 带字段、hydrate 合并不覆盖本地计划）
- [x] R5.8 复习计入每日目标（每题 addStudyTime("quiz",60)，与台账 quiz 源合并去重）
- [x] R5.9 SRS 开关（tb-srs-mode，关闭=入库倒序纯列表、隐藏到期徽章；单测覆盖）
- [x] R5.10 孤儿清理（pruneOrphanWrong 在 review 渲染时执行并同步删云端；单测覆盖）
- [x] R5.11 单手操作（掌握了/还没掌握双大按钮 px-6 py-3、间距加开）
- [x] R5.12 空日鼓励（「🌙 今天没有到期的复习——下一轮时间已排好」；单测覆盖）

## R6 内容运营自动化（R6.1–R6.13）

- [ ] R6.1 kb:update 产物 diff 摘要（新增/删除课程列表输出）
- [ ] R6.2 新课程自动进 sitemap 回归断言（已有对账，补新增冒烟）
- [ ] R6.3 测验挂载点自动校验（每章 quiz.docSlug 必须存在，CI 阻断）
- [ ] R6.4 题库覆盖率脚本（27 章 × 最少题数检查）
- [ ] R6.5 frontmatter 描述长度检查（过短影响 SEO 报警）
- [ ] R6.6 图片 alt 缺失检查（知识库图片批量扫描）
- [ ] R6.7 中英标题对照表生成（翻译进度可视化数据源）
- [x] R6.8 术语交叉覆盖（check:glossary：20 术语/孤儿 0 个 → docs/glossary-coverage.md）
- [x] R6.9 FAQ 候选（ops:faq-candidates：近 30 天 unhelpful 聚类 → docs/faq-candidates.md；无 key 友好跳过）
- [ ] R6.10 changelog 自动片段（kb:update 产物变更写入 changelog 草稿）
- [ ] R6.11 内容宪法扫描（“保证收益/稳赚”等违禁表述正则巡检）
- [x] R6.12 外链巡检（ops:link-patrol：HEAD 降级 GET + 超时重试；.github/workflows/link-patrol.yml 每月定时 + 手动触发）
- [x] R6.13 运营手册（docs/ops.md：门禁/流水线/运营工具/迁移清单全覆盖）

## R7 性能与质量门禁（R7.1–R7.12）

- [x] R7.1 预算细分（check:bundle 新增 zh/ai 310KB 预算 + AI chunk 隔离断言；Markdown 渲染链按需加载使 AI 页 347→254KB）
- [x] R7.2 懒加载审计（markdown img renderer 已带 loading=lazy，补测试锁定）
- [x] R7.3 低端机降级（perf.ts rAF 采样 1.5s，<24fps 只保留最近 150 根 K 线；3 单测）
- [x] R7.4 虚拟化评审（docs/perf-notes.md：数据规模天然有界 ≤81 条，暂不引入；设重评触发条件）
- [x] R7.5 上游超时重试（http.ts：30s AbortController + 429/5xx 重试 1 次；chat/streamChat/embed 全部接入；6 单测）
-[x] PLACEHOLDER
- [x] R7.7 E2E 冒烟（Playwright 7 用例：首页/路线/测验闭环/复习/回放/AI 页/软 404，进 CI；无 Supabase env 时降级本地模式）
- [x] R7.8 视觉基线（5 页 toHaveScreenshot 基线入库，npm run e2e:visual 人工复核流程；不进 CI 因字体平台差异）
- [x] R7.9 依赖评审（docs/deps.md：14 个运行时依赖逐个理由 + 明确不引入清单 + 审查流程）
- [x] R7.10 构建时间监控（CI 计时步骤，>4 分钟 warning 注解）
- [x] R7.11 缓存文档（docs/caching.md：页面层/localStorage/edge 内存三层 + 云端合并规则）
- [x] R7.12 安全头（next.config：CSP（Supabase connect/wss 白名单）/nosniff/DENY/Referrer-Policy/Permissions-Policy）

## R8 增长与分享（R8.1–R8.12）

- [x] R8.1 成绩分享卡（测验 S/A 评级生成 OG 图，纯前端 canvas）
- [x] R8.2 回放战绩分享卡（连胜/正确率卡片）
- [x] R8.3 连续学习分享卡（streak 天数卡）
- [ ] R8.4 分享落地页（带卡片参数的轻量页，SEO 可收录）
- [ ] R8.5 邀请参数透传（?ref= 落地后 localStorage 记录 30 天）
- [ ] R8.6 新手引导 tour（首次访问三步指向：路线/练习/复习，可跳过）
- [ ] R8.7 空状态行动召唤复核（全站空页都有下一步按钮）
- [ ] R8.8 邮件订阅占位（无后端前先收集意向，localStorage + 导出）
- [x] R8.9 社交元标签全页复核（twitter:title/description 无缺失）
- [x] R8.10 结构化数据扩展（Course + Quiz 的 JSON-LD）
- [x] R8.11 404 页推荐位（按 URL 猜测最接近课程，编辑距离实现）
- [ ] R8.12 关于页/捐赠页文案双语复核（donate 图片 alt 与说明）

## v0.4 关账标准

1. R1–R5 功能项完成且 Playwright 冒烟通过
2. R6–R7 门禁类全部进 CI 并连续三次通过
3. R8 至少完成分享卡 + 新手引导 + 结构化数据
4. 测试用例单独补充（不占本表名额），覆盖率不下降
