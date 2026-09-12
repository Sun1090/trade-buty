# 运营手册（Content Ops）

> v0.6 内容运营手册：覆盖 R6（内容运营自动化）与 R10（内容扩产与双语覆盖）全部质量门禁。
> 所有命令在仓库根目录执行；`npm run check:*` 为内容/产物质量门禁，
> `npm run ops:*` / `npm run kb:*` 为运营工具。
> 下表覆盖 `.github/workflows/ci.yml` 的全部执行步骤，并按实际顺序排列。

## 质量门禁（CI 自动运行，失败阻断合并）

| CI 步骤 | 检查什么 | 失败处理 |
|---|---|---|
| `actions/checkout` + `actions/setup-node` + `npm ci` | 递归检出知识库子模块；固定 Node.js 22；按 lockfile 做干净依赖安装 | 检查子模块权限/指针；不要用 `npm install` 改写锁文件绕过 |
| `npm run audit:prod` | 生产依赖高危及以上漏洞审计（npm 官方 registry） | 升级/替换受影响依赖；不得通过降低 audit level 掩盖 |
| `npm run lint` | 全仓库 ESLint，**0 error / 0 warning** | 修复规则报告；定向例外必须附理由，脚本本身固定 `--max-warnings=0` |
| `npm test` | Vitest 单元、组件、脚本契约与集成测试 | 修复失败用例；不得跳过或删除断言来伪造通过 |
| `npm run typecheck` | Next.js 16 路由类型生成 + `tsc --noEmit` | 修复类型错误；不得用 `any`/忽略指令掩盖真实不匹配 |
| `npm run build` | prebuild 契约/资产/搜索索引/标题同步 + 生产构建 | 按构建错误修内容契约或代码；宽松渲染应 warn+skip，不能静默发布空站 |
| `npm run check:mobile` | 14 个关键 zh/en 页面在 320px 下无横向溢出（含 R12.21 / R13.10） | 修正布局/滚动容器；不得只放宽测试阈值 |
| 构建耗时报警（CI 内联，R7.10） | lint→build 段超过 240 秒输出 warning | 检查大 chunk、缓存与依赖体积 |
| `npm run check:ai-copy` | en 字典无中文残留（R3.12） | 修正 i18n.ts en 值 |
| `npm run check:growth-event-privacy` | 增长事件只留在本机且不携带 URL/身份信息（R13.20） | 删除遥测外发或敏感字段；审计文档作废时重新评审 |
| `npm run check:dark-pattern-copy` | 增长表面均已登记，且无紧迫/恐吓/默认勾选等暗黑模式（R13.21–R13.22） | 修正 `growth-surfaces.json` 登记或用户文案 |
| `npm run check:docs` | README/AGENTS/plan/About 的内容规模、技术栈与关键承诺一致 | 修正漂移文档；不得只改门禁快照 |
| `npm run check:constitution` | 内容宪法：导流/荐股黑话、收益承诺表述（R6.11） | 默认报告式（教育语境豁免）；内容整改后可在 CI 加 `--strict` 升级阻断 |
| `npm run check:frontmatter` | 每篇课程 title/description 齐全且 description ≥15 字符（R6.5） | 补齐 frontmatter；章节 README 按契约豁免 |
| `npm run check:image-alt` | 知识库图片 alt 文本（R6.6，R10.12 增强） | 为对应图片补描述 |
| `npm run check:glossary` | 术语表双语一致性：term/en/def/defEn 齐全、zh/en 主词唯一（R10.13） | 修正 `src/lib/glossary-data.json` |
| `npm run check:slug-conflicts` | 中英 slug 冲突：slug 小写连字符、跨 locale 不撞身份（R10.14） | 改 slug 或拒绝冲突路径 |
| `npm run check:description-dupes` | 课程摘要与 SEO description 去重（同 locale 内不得相同，R10.15） | 改写重复 description |
| `npm run check:kb-pointer` | 上游版本指针一致：gitlink = 工作区 submodule = kb-manifest 快照（R10.18） | 跑 `npm run kb:update` 并同 commit 提交指针 + `scripts/kb-manifest.json` |
| `npm run check:translation-history` | 翻译历史快照为最新：当前 KB 覆盖与 docs/translation-history.json 最近快照一致（R10.19） | `npm run kb:translation-status` 重生成并连同两个产物提交 |
| `npm run check:kb-parity-budget` | 关键章节英文 parity ≥ 预算（docs/kb-parity-budget.json，默认 1.0，R10.20） | 补齐关键章节 en 译文，或先下调预算并说明理由 |
| 新章节 dry-run 冒烟（CI 内联，R10.16 / Q1.7） | `node scripts/dry-run-new-chapter.mjs --draft` 预检契约，并输出索引/sitemap/测验挂载/路径分组四项上线核对 | 按脚本报错补结构；按 checklist 决策固定题和 STAGES 分组 |
| `npm run check:quiz-mounts` | AST 核验 quizzes.ts 全部挂载的 chapter/docSlug 与最少题数（R6.3） | 修正 chapterNum、docSlug、重复键或题量 |
| `npm run check:quiz-coverage` | 固定题库覆盖率：27 章 × 每章至少 3 道（R6.4） | 补固定题库或 kb-titles 缺失元数据 |
| `npm run check:links` | 死链：扫描构建产物 HTML 与构建输出交叉验证（需先 build） | 修正站内错误链接 |
| `npm run check:sitemap` | 构建产物 sitemap 收录全部 zh 课程（R6.2，需先 build） | 检查 lib/content 宽松渲染是否误跳过 |
| `npm run check:seo-surface` | 可索引表面发布复核：sitemap / robots.txt / 页面 robots meta 三者一致（R13.17，需先 build） | 修正 `src/lib/seo-surface.json` 声明或页面 metadata；详见 `docs/seo-surface.md` |
| `npm run check:search-index` | 搜索索引与构建产物一致：新文档必须进索引（R10.9，需先 build） | 检查 generate-search-index 是否漏同步 |
| `npm run check:nav-chain` | 章节导航与上一篇/下一篇链路三条不变量（R10.10） | 修正 kb-order/content 导航语义 |
| `npm run check:relative-links` | 相对链接跨语言解析：目标在当前 locale 真实存在（R10.11） | 修正 md 内相对链接/资产引用 |
| `npm run check:bundle` | 全部 zh/en 路由的 JS/CSS/HTML/total gzip 预算（R13.15）+ AI chunk 隔离（R7.1，需先 build） | 调整 `scripts/bundle-budgets.json` 或拆分/按需加载超预算 chunk（不得为掩盖回归直接放宽） |
| `npm run check:structured-data` | 全站 JSON-LD 结构化数据回归：实体类型/`@id` 唯一性、绝对 URL、语言、博客/课程/FAQ 页面身份（R13.16，需先 build） | 修正 `src/lib/jsonld.ts` 或页面注入；不得为通过直接放宽断言 |
| 生成内容质量报告（R10.1–R10.6 / R10.17） | 在当前提交上重跑 inventory、gap priority、新增课程验收、翻译状态、标题术语、描述质量与风险提示报告 | 按脚本报告修复内容或契约；报告式命令不会用人工旧快照替代当前结果 |
| 内容质量报告归档（CI artifact，R10.17） | 上述当前提交报告及 docs/*.json 随 CI 归档 7 天 | 下载 artifact 分派人工整改；不得只更新 artifact 而不提交内容源修复 |
| `npx playwright install --with-deps chromium` | 安装 E2E 所需的固定 Chromium 运行时 | 检查 CI runner 系统依赖与 Playwright 版本 |
| `npm run e2e` | 全站、320px 移动端、PWA 离线与扩展核心闭环（R13.24） | 修复可访问性、响应式或交互回归；不得只重跑忽略 flaky |
| `npm run lhci` | 关键 URL 的性能/可访问性/最佳实践/SEO 断言 | 修复真实退化；阈值调整必须附测量证据 |

> 执行顺序注记：E2E 与 Lighthouse 排在所有产物校验之后（E2E 运行时向 `.next` 写 fallback 页，避免污染其后的 check 产物；顺序由 ci.yml 保证）。

## 知识库更新流水线（`npm run kb:update` 自动执行）

1. 拉取 submodule 最新内容（开头打印更新前版本）
2. **kb diff 摘要 + changelog 草稿**（R6.1/R6.10）：输出新增/删除课程清单，草稿写入 `docs/kb-changelog-draft.md`，人工审后并入正式更新日志
3. 契约校验、资产与搜索索引同步、构建回归
4. 快照 `scripts/kb-manifest.json` 随本次更新刷新（下次 diff 的基线；R10.18 起额外记录上游 `pointer`）
5. **上游版本变更提示（R10.18）**：结尾打印 仓库记录指针 旧→新；指针落后时提示必须把 `content/kline-buty` 指针与 `scripts/kb-manifest.json` 同一 commit 提交，并给出提交前门禁清单

> 指针纪律（R10.18）：仓库记录指针、工作区子模块 HEAD、`kb-manifest.json` 的 `pointer` 三者必须一致。CI 每次推送跑 `npm run check:kb-pointer` 核对——指针动了但快照没刷新（或反之）会直接失败。本地检出漂移（跑了 `update --remote` 没提交指针）也由同一命令拦截。

## 关键章节英文 parity 预算（R10.20）

```bash
npm run check:kb-parity-budget
```

关键章节清单维护在 `docs/kb-parity-budget.json`（人工维护，含预算比例与理由）。CI 每次推送核对：关键章节新增 zh 课程未同步 en 译文即失败（比 R10.19 的「快照过期」更强——后者只要求报告最新，不约束内容本身）。


## 站内搜索同义词（R10.21）

词典 `src/lib/search-synonyms.ts`：交易术语中英别名归组（止损/stop loss、定投/DCA、均线/MA 等 25 组）。检索时把查询扩展为同组全部词条再取最高分——双语内容互相可达；词典自检（重复/空组/单字组）由单测锁定，R10.22 的「无结果诊断」复用同组匹配。

## 站内搜索无结果诊断（R10.22）

零结果空态按三档给出诊断（纯函数 `src/lib/search-diagnostics.ts`，复用 R10.21 同义词组匹配 + R8.11 编辑距离）：

- **typo**：查询疑似常见词拼写/用词偏差 → 按编辑距离推荐最接近的候选词（「你是不是想找」chips，点击即重搜）
- **coverage-gap**：查询命中同义词组但组内所有说法在站内都无命中 → 如实提示「已按同义说法搜索：…」并说明该主题可能尚未收录——同时是内容缺口信号（词典词条超出正文词汇时运营可据此补课）
- **no-match / 过短**：维持通用空态（热门词兜底）

按篇章筛选后零命中不再是无出口：给出「{n} 条相关结果在其他篇章」+ 一键清除筛选（此前筛选器随结果隐藏后无法复位）。

> 候选池 = 同义词组词条 + 索引标题/篇章；空查询与单字符查询不触发同义扩展/模糊匹配。

## 内容页 canonical/hreflang（R10.23）

内容页（章节页 + 课程页）的 `generateMetadata` 经 `buildPageMetadata` 声明双语 SEO：

- **canonical 不交叉**：zh/en 是两份翻译正文，各 canonical 到自己 URL（此前注释误以为「双语切换走前端 LanguageToggle」——实际切换是 `/[locale]` URL 变更，需 hreflang 声明配对）。
- **hreflang 配对**：`alternates.languages` 输出 `<link rel="alternate" hreflang="zh|en">`，`x-default` 固定取 en（站内默认语言），en 缺失回退 zh。
- **语料按 locale 取**：章节/doc metadata 此前硬编码 `"zh"`，en 页 `<title>`/description 是中文——R10.23 修复为按当前 locale 取正文。
- **翻译缺口**：对侧不存在时只声明本页单条（测试锁定，知识库 en 补齐后自动升级为双语对）。

验证方式：build 后检查 `.next/server/app/{zh,en}/knowledge/...html` 中的 `link[rel=alternate][hreflang]` 输出。

## 内容更新后的缓存（R10.24）

知识库内容更新 → `npm run kb:update` 同步 → git push → Vercel 全量重建发布（无定时刷新）。
发布后 name-stable 内容产物（`public/search-index.json`、`public/knowledge-assets/**`）按
`Cache-Control: public, max-age=0, must-revalidate` 每次回源验证，内容立即可见；策略显式声明在
`next.config.ts`（`CONTENT_CACHE_POLICIES`，单测锁定），完整失效矩阵见 [`docs/caching.md`](caching.md) §4。

## 翻译进度（R6.7 / R10.19）

```bash
npm run kb:translation-status
```

生成 `docs/translation-status.md`（27 章的 zh/en 章节版本与课程覆盖对照表 + 翻译缺口清单）并写入历史快照 `docs/translation-history.json`（按日期追加、保留最近 365 条、同日幂等）——翻译趋势追踪的数据源。

> CI 每次推送跑 `npm run check:translation-history`：当前 KB 覆盖与最近快照不一致即失败（KB 有 zh/en 增删后忘记重生成报告）。

## 术语交叉覆盖（R6.8）

```bash
npm run check:glossary
```

生成 `docs/glossary-coverage.md`：glossary 词条在知识库正文的命中情况；「孤儿术语」（正文零出现）列为内容补充候选。

## FAQ 候选（R6.9）

```bash
npm run ops:faq-candidates
```

从 `ai_feedback` 表近 30 天 unhelpful 反馈聚类高频问题，生成 `docs/faq-candidates.md`。
需要 `SUPABASE_SERVICE_ROLE_KEY`（读 .env.local）；未配置时友好跳过。

## 外链巡检（R6.12）

```bash
npm run ops:link-patrol
```

HEAD（失败降级 GET）+ 10s 超时 + 一次重试；失效外链 exit 1。
CI 里是**每月定时任务**（`.github/workflows/link-patrol.yml`，每月 1 日 03:00 UTC），也支持手动 workflow_dispatch 触发。

## Supabase 迁移清单（按文件名顺序执行）

| 迁移 | 内容 |
|---|---|
| `0001_init.sql` | 学习进度、错题本、测验成绩、回放历史与最佳连击（P2） |
| `0002_ai.sql` | pgvector / `kb_embeddings` / 对话历史 / AI 反馈（P3） |
| `0003_vector_1024.sql` | 向量维度与检索函数切换到 1024 维 |
| `0003b_fix_overload.sql` | 清除 `match_kb_embeddings` 历史重载 |
| `0004_ai_citation_clicks.sql` | 引用点击统计表（R1.13） |
| `0005_user_settings.sql` | 用户设置与每日目标档位（R4.7） |
| `0006_wrongbook_srs.sql` | 错题本 SRS 字段（R5.7） |
| `0007_weekly_goal_min.sql` | 每周目标档位（R12.19） |
| `0008_goal_tier_constraints.sql` | 归一化并约束日/周目标合法档位 |

迁移由 `src/lib/supabase/schema.test.ts` 做静态契约核对：Drizzle 镜像与迁移表/列一致，
每张公开表必须开启 RLS 且具备显式策略。目标档位的回滚 SQL 位于
[`supabase/rollback/`](../supabase/rollback/README.md)；回滚只逆迁移结构，不恢复被归一化的历史业务值。
