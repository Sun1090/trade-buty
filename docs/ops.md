# 运营手册（Content Ops）

> v0.6 内容运营手册：覆盖 R6（内容运营自动化）与 R10（内容扩产与双语覆盖）全部质量门禁。
> 所有命令在仓库根目录执行；`npm run check:*` 为内容/产物质量门禁，
> `npm run ops:*` / `npm run kb:*` 为运营工具。
> 下表覆盖 `.github/workflows/ci.yml` 的两个作业（`ci` / `db-tests`）的全部执行步骤，并按实际顺序排列；`db-tests` 作业的步骤以 `db-tests ·` 前缀标注。
> 覆盖与顺序由 `scripts/ci-workflow.test.mjs` 机检：每个 `npm run` / `node scripts` 门禁必须在表中登记（漏登记即失败），首列命令的相对顺序必须与工作流一致。

## 质量门禁（CI 自动运行，失败阻断合并）

| CI 步骤 | 检查什么 | 失败处理 |
|---|---|---|
| `actions/checkout` + `actions/setup-node` + `npm ci` | 递归检出知识库子模块；固定 Node.js 22，与根 `package.json` 的 `engines.node >=22` 对齐；按 lockfile 做干净依赖安装 | 检查子模块权限/指针；不要用 `npm install` 改写锁文件绕过 |
| `npm run check:lockfile-repro` | 用 `devEngines.packageManager` 钉住的 npm（10.9.4，对齐 lockfile 生成工具）重新生成 `package-lock.json`，逐条目比较；有差异即说明提交的 lockfile 不是 CI 的 npm 主版本生成的（npm 10 vs npm 11 漂移） | 用 CI 的 npm 主版本重新生成：`npx --yes npm@10.9.4 install --package-lock-only --registry=https://registry.npmjs.org`；详见 docs/deps.md |
| `npm run audit:prod` | 生产依赖高危及以上漏洞审计（npm 官方 registry） | 升级/替换受影响依赖；不得通过降低 audit level 掩盖 |
| `npm run audit:all` | 全量依赖（含开发工具链）高危及以上漏洞审计；当前 0 漏洞 | 升级/替换受影响依赖，优先用经验证的 overrides；不得用 `--omit=dev` 掩盖开发链回归 |
| `npm run check:secrets` | 扫描受版本控制与未忽略的新文本文件，阻断私钥、平台 token 和疑似硬编码密钥；输出不包含命中值。R16.83：`git ls-files` 列出的待扫文件数低于下限 700 即判失败（「已扫描 0 个」不是通过），通过时打印扫到多少个 | 吊销并移除泄露凭据，改用环境变量/密钥管理；测试夹具使用明确占位值；下限被踩到先查清单为什么变少，再改数 |
| `npm run ops:work-audit` | 工作保全审计（R14.4）：有没有提交既不在 `main` 也不在任何远端分支，以及有没有 PR 被关闭而工作去向从未确认。CI 用 `WORK_AUDIT_REQUIRE_GH=1` 把它当门禁：读不到 GitHub 也判失败，不允许静默变绿 | 需要的工作重放到新 topic 分支并提 PR；确认已无需保留的关闭 PR 在 `docs/work-audit-ack.json` 记下理由（每条必须写原因） |
| `npm run lint` | 全仓库 ESLint，**0 error / 0 warning** | 修复规则报告；定向例外必须附理由，脚本本身固定 `--max-warnings=0` |
| `npm run test:coverage` | Vitest 单元、组件、脚本契约与集成测试，并跑 V8 覆盖度地板门禁（语句 84 / 分支 77 / 函数 83 / 行 87） | 修复失败用例；覆盖度跌破地板时补测试，不得跳过/删除断言或下调阈值伪造通过 |
| `npm run typecheck` | Next.js 16 路由类型生成 + `tsc --noEmit` | 修复类型错误；不得用 `any`/忽略指令掩盖真实不匹配 |
| `npm run build` | prebuild 契约/资产/搜索索引/标题同步 + 生产构建 | 按构建错误修内容契约或代码；宽松渲染应 warn+skip，不能静默发布空站 |
| `npx playwright install --with-deps chromium` | 安装 E2E 所需的固定 Chromium 运行时 | 检查 CI runner 系统依赖与 Playwright 版本 |
| `npm run check:mobile` | ≥10 条核心路径 × 全部语言（`CORE_SUFFIXES` × `LOCALES` 生成）在 320px 下无横向溢出；清单里每条路径还必须真返回 200，防死路径冒充覆盖（含 R12.21 / R13.10） | 修正布局/滚动容器；不得只放宽测试阈值 |
| 构建耗时报警（CI 内联，R7.10） | lint→build 段超过 240 秒输出 warning | 检查大 chunk、缓存与依赖体积 |
| `npm run check:ai-copy` | en 字典无中文残留（R3.12） | 修正 i18n.ts en 值 |
| `npm run check:growth-event-privacy` | 增长事件只留在本机且不携带 URL/身份信息（R13.20） | 删除遥测外发或敏感字段；审计文档作废时重新评审 |
| `npm run check:error-report-privacy` | 错误上报载荷只含白名单元数据、服务端有界读取 + 未知字段拒绝、日志无原始内容、隐私页双语披露（R7.6） | 修正 `src/lib/error-report.ts` / 路由或隐私页；不得放宽白名单或日志脱敏 |
| `npm run check:request-body-bounds` | 站内每个解析 JSON 请求体的端点都经 `src/lib/request-body.ts` 有界读取，且上限是具名常量（R15.4①）。R16.83：`src/app/api` 读不到、或扫出的 route.ts 少于下限 11 个都判失败——「0 个端点全部合规」和一次没跑的扫描不再是同一句话；通过的那行会先报「N 个 route.ts 里的 M 个 POST 端点」 | 新端点改用 `readJsonBody(req, MAX_*_BODY_BYTES)`；不得把上限退回行内数字或恢复 `req.json()`；目录搬家要同步这里的扫描根 |
| `npm run check:env-docs` | `docs/env.md` 与代码对账：`process.env.*` 读到的运行时变量全部登记、文档无幽灵条目、服务端密钥不出现在 `"use client"` 模块 | 补写 `docs/env.md` 或清理死变量；密钥前缀/暴露面错误必须改代码而不是改文档 |
| `npm run check:dark-pattern-copy` | 增长表面均已登记，且无紧迫/恐吓/默认勾选等暗黑模式（R13.21–R13.22） | 修正 `growth-surfaces.json` 登记或用户文案 |
| `npm run check:db-assertion-counts` | 现行文档（`docs/database-testing.md`、`docs/roadmap.md`）引用的 pgTAP 断言数等于 `supabase/tests/*.sql` 的 `select plan(N)`，含「40+30+8 断言」这类聚合写法。R16.83：声明的 2 篇文档少读到任何一篇都判失败（`docs/roadmap.md` 改名不会让引用自动变对），pgTAP 目录整个不见了也报错而不是让 `readdirSync` 抛一句读不懂的话 | 改断言数后同步现行文档；`docs/progress.md` 是追加式历史记录，不参与对账也不得回改 |
| `npm run check:docs` | README/AGENTS/plan/About 的内容规模、技术栈、关键承诺与 `package.json` 版本号一致 | 修正漂移文档；发布时同步 bump `package.json` version，不得只改门禁快照 |
| `npm run check:changelog` | `CHANGELOG.md` 与单一来源 `src/data/release-notes.json`（站点 `/changelog` 页同源）一致：版本/日期格式、新旧排序与双语条目 | 跑 `npm run changelog:generate` 重新生成并提交；不得手工编辑 `CHANGELOG.md` |
| `npm run check:release-tag` | 发布 tag 核对（R14.3）：除最新发布版本外，每条发布记录都必须有同名 `vX.Y.Z` tag；最新发布版本允许暂缺（rebase 合并改写 SHA，tag 只能在合并后打到 `main`），此时打印待办不判失败 | 在合并后的 `main` 上 `git tag -a vX.Y.Z origin/main -m "..." && git push origin vX.Y.Z`；0.4.0–0.7.0 属门禁上线前的遗留豁免（见 `scripts/release-tag-lib.mjs`），有意不回填以免把过期提交推成生产部署 |
| `npm run check:constitution` | 内容宪法：导流/荐股黑话、收益承诺表述（R6.11） | 默认报告式（教育语境豁免）；内容整改后可在 CI 加 `--strict` 升级阻断 |
| `npm run check:frontmatter` | 每篇课程 title/description 齐全且 description ≥15 字符（R6.5）。R16.83：知识库根目录 `content/kline-buty/docs/knowledge` 不存在时当场报错（子模块没 init 过去是打印一句通过），md 文件数低于下限 400 判失败，通过时先报扫到多少个文件 | 补齐 frontmatter；章节 README 按契约豁免；数量掉得离谱先 `git submodule update --init`，别直接调下限 |
| `npm run check:image-alt` | 知识库图片 alt 文本（R6.6，R10.12 增强） | 为对应图片补描述 |
| `npm run check:glossary` | 术语表双语一致性：term/en/def/defEn 齐全、zh/en 主词唯一（R10.13） | 修正 `src/lib/glossary-data.json` |
| `npm run check:slug-conflicts` | 中英 slug 冲突：slug 小写连字符、跨 locale 不撞身份（R10.14） | 改 slug 或拒绝冲突路径 |
| `npm run check:description-dupes` | 课程摘要与 SEO description 去重（同 locale 内不得相同，R10.15） | 改写重复 description |
| `npm run check:kb-pointer` | 上游版本指针一致：gitlink = 工作区 submodule = kb-manifest 快照（R10.18） | 跑 `npm run kb:update` 并同 commit 提交指针 + `scripts/kb-manifest.json` |
| `npm run check:kb-changelog` | `kb-manifest.json` 中每篇 sha256 与当前子模块内容逐文件一致；只读、有新增/修改/删除即失败（R10.7） | 跑 `npm run kb:update` 刷新快照与 changelog，同 commit 提交；不得手改 hash 或让 CI 写快照 |
| `npm run check:translation-history` | 翻译历史快照为最新：当前 KB 覆盖与 docs/translation-history.json 最近快照一致（R10.19） | `npm run kb:translation-status` 重生成并连同两个产物提交 |
| `npm run check:kb-parity-budget` | 关键章节英文 parity ≥ 预算（docs/kb-parity-budget.json，默认 1.0，R10.20） | 补齐关键章节 en 译文，或先下调预算并说明理由 |
| `npm run check:kb-en-content` | 英文树内容实测：en 的每个 markdown 非空、CJK 字占比 ≤ 2%、正文长度 ≥ 同名中文的 30%（R16.13）。R16.83：en 与 zh 两棵树各自低于下限 200 个 md 就判失败——`en/` 整棵不见了过去打印的是「0 个文件、0 处越界」的绿 | 到 kline-buty 补英文正文；本仓不得就地改子模块内容 |
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
| `npm run check:structured-data` | 全站 JSON-LD 结构化数据回归：实体类型/`@id` 唯一性、绝对 URL、`inLanguage` 与真正印出来的文字一致（报 `en` 却含中文即报错；只有中文一份的随堂测按题库语言报，豁免「跟随页面语言」那条）、博客/课程/FAQ 页面身份（R13.16，需先 build） | 修正 `src/lib/jsonld.ts` 或页面装配；不得为通过直接放宽断言 |
| 生成内容质量报告（R10.1–R10.6 / R10.17） | 在当前提交上按序重跑 `kb:inventory`、`kb:gap-priority`、`kb:accept`、`kb:translation-status`、`check:title-terminology`、`check:description-quality`、`check:risk-warning` 七份内容报告 | 按脚本报告修复内容或契约；报告式命令不会用人工旧快照替代当前结果。入库的纯重算型报告（R14.5）只在内容真的变化时重写，因此报告头的日期读作「内容最后一次变化」，内容未变时不随机器重跑而刷新；按日追加的历史快照（`kb:translation-status`、`kb:diff`）不受此约束。`check:risk-warning` 另需先 `npm run build`：它要把上游状态逐页对着构建产物里的风险提示兜底块核对，缺产物即失败而不是静默跳过 |
| 内容质量报告归档（CI artifact，R10.17） | 上述当前提交报告及 docs/*.json 随 CI 归档 7 天 | 下载 artifact 分派人工整改；不得只更新 artifact 而不提交内容源修复 |
| `npm run check:test-clock-hygiene` | 测试时钟卫生巡检（R14.6）：`expect(...)` 里直接读 `Date.now()`/`performance.now()` 的断言**即失败**（该口径无已知误报）；使用真实 `setTimeout`/`setInterval` 且同文件从不使用受控时钟的测试只列报告 `docs/test-clock-hygiene.md` | 前者改为注入时钟或 `vi.useFakeTimers()` + `setSystemTime()`，不接受重跑；后者逐条人工判断，确需保留的在评审里写明理由。出现偶发 flaky 时先查这张表 |
| `npm run check:dead-copy` | 字典死键巡检，两路口径（R16.21 + R16.78）。① `src/lib/i18n*.ts` 词条若在 `src/`（字典文件自身除外）、`e2e/`、`scripts/` 的非测试代码里没有任何引用点即失败。② 组件自己声明的字典接口（名字带 `Dict`、字段全是 `string`/`string[]` 的那种）若某字段在**声明它的本文件**里从头到尾没出现过即失败——第一目对这类是瞎的：词条在页面有装配点（`error: t.chapter.aiSummaryError`）就算「被使用」，可接住它的组件一次都没读过它，改字典的人看着装配点真心以为改到了界面（R16.77 的 `error` 是第一例）。第二路保守到「字段名以任意形态出现在声明块之外都算读过」，因为 `replay-trainer.tsx` 用 `{ labelKey: "difficultyNew" }` + `dict[d.labelKey]` 间接读；判定逐文件，别处读过不算。四路都从同一个 `scripts/dead-copy-budget.json` 取数：两项上限（死键 `budget`、未读字段 `dictFieldBudget`，当前均为 **0**）与两项下限（`minDictionaryKeys` / `minDictInterfaces`，钉在当前实测的词条数与接口数附近）。缺一键即判失败——拿到 `undefined` 的比较会永远通过；下限不是装饰：R16.81 里扫描器被接口内的一行块注释缴械、当场少扫一张接口，而下限悬在 10 这样的远低于实际的常数上，红绿一点没变，所以下限必须跟着实测量走（**少扫**东西要失败，多扫到不需要） | 直接删掉没人读的词条（连同假字典里的引用）；组件字段要么读掉，要么把接口字段和页面装配点一起删。确需保留的在 PR 里写明理由并上调预算，不得为了变绿而加 `// eslint-disable` 式的豁免 |
| `npm run check:localized-labels` | 写死单一语言的界面文案巡检（R16.50 + R16.51 + R16.91）：`src/**/*.tsx`（测试文件除外）里查三类——`title` / `aria-label` / `alt` / `placeholder` / `label` 的字面量值、`>…<` 之间的裸 JSX 文本节点，以及**属性表达式里的字符串字面量**（`label={{ enter: "全屏", exit: "退出" }}`：值既不是引号属性也不是裸文字，前两类套不上，英文页的全屏按钮因此一路是中文）；含中日韩文字即失败。第三类认内容不认变量名：一条中文字面量只有在 `?` / `:` 紧邻处摆着另一种说法时才放行，所以 `title={en ? "Calendar" : "日历"}` 不管别名怎么写都不误伤，而 `{ share: "Share", preview: "预览卡面" }` 这种一半一半的会报出中文那条；表达式按花括号配平取，配不平就整段放过不猜。前者会被屏幕阅读器和提示气泡念出来（`read-aloud` 的 `title="语速"` 是第一例），后者是眼睛直接看到的按钮字（复习页一次有七条界面字没问语言，其中五处是裸 JSX 文本、另两条藏在表达式里，是第二例）。走表达式的按语言写法 `{locale === "en" ? "Back" : "返回"}` 两种语言并排在同一段里，同样不误伤。豁免三处：根级 `not-found.tsx` / `error.tsx`（整页在 `[locale]` 之外，语言无从判定，归 R16.41）与分享卡的降级图（payload 解码失败时访客语言无从判定，正常的三张卡和课程页 OG 卡都已按 locale 出文案，这一张要不要中英并列归 R16.52）；豁免清单由用例钉住当前条数，往里加一条就等于放弃一处检查 | 改成 `{locale === "en" ? … : …}` 或走 `src/lib/i18n.ts` 字典，并在用例里按语言断言；把英文写死在同一处它认不出来（判据是 CJK 字符），那半边靠按 locale 的断言补（`kline-chart.test.tsx` 那条读屏名字就是） |
| `npm run check:report-freshness` | 重算型报告新鲜度核对（R16.26）：报告清单由「谁调用了幂等写入器 `writeReport`」推导（当前 17 份，见 `scripts/report-freshness-lib.mjs`）。**本脚本不重算**，它比对工作区与 HEAD——只有在报告 producers 都跑过之后（CI 里它排在全部巡检步骤之后）这句话才等于「入库版本 == 当场重算结果」；单独跑它只能证明没人碰过这些文件。推导数为 0 判失败而不是「无报告可核对」的假绿。按日追加的历史快照（`kb:translation-status`、`kb:diff`）不走幂等写入器，天然不在范围内 | 排在 CI 所有报告步骤之后；命中就把重算结果一起提交（`npm run check:<对应门禁>` 后 `git add docs/…`）。若某份报告确实该每天变，说明它不该走 `writeReport`，把它挪进历史快照通道 |
| `npm run e2e` | 全站、320px 移动端、PWA 离线、根级元数据路由、根级静态表面/软 404 契约与分享落地页、扩展核心闭环（R13.24） | 修复可访问性、响应式或交互回归；不得只重跑忽略 flaky |
| `npm run lhci` | 关键 URL 的性能/可访问性/最佳实践/SEO 断言 | 修复真实退化；阈值调整必须附测量证据 |
| `db-tests` · `docker pull supabase/postgres:17.6.1.155` | 拉取与线上一致的 Supabase Postgres 17 镜像，供迁移/RLS/同步门禁使用（Q2.8 / Q5.4） | 核对镜像 tag 是否仍在；不要改用本地随意镜像绕过 |
| `db-tests` · `node scripts/db-test.mjs` | 在真实 Postgres 镜像里应用全部迁移、跑 RLS 越权与双设备同步 pgTAP 测试，并执行 `0008` 回滚 → 重放演练（Q2.8） | 修正迁移/策略/回滚脚本；不得跳过 pgTAP 断言或改用内存库伪造通过 |
| `db-tests` · `npm run backup:drill` | 备份恢复演练：`pg_dump` 源库 → 全新实例恢复 → 数据/schema/RLS 指纹对比 → 恢复库重跑 pgTAP（Q5.4） | 按 `scripts/backup-drill.mjs` 报错修备份/恢复路径或表覆盖；不得缩小 `DATA_TABLES` 覆盖面 |

> 执行顺序注记：E2E 与 Lighthouse 排在所有产物校验之后（E2E 运行时向 `.next` 写 fallback 页，避免污染其后的 check 产物；顺序由 ci.yml 保证）。
> 供应链注记：官方 actions（`checkout` ≥ v5 / `setup-node` ≥ v5 / `cache` ≥ v5 / `upload-artifact` ≥ v6）必须固定到 40 位 commit SHA 并保留 `# vN` 注释，既避免 Node.js 20 弃用回退，也避免可变 tag 被重写；Dependabot 每周跟踪 npm 与 GitHub Actions，`scripts/ci-workflow.test.mjs` 会拦截未固定 action 和配置漂移。
> 工作流结构注记：每个工作流都显式声明 `permissions: contents: read`（不继承仓库默认值），每个 job 都有 (0, 60] 区间的数值型 `timeout-minutes`；`scripts/ci-workflow.test.mjs` 遍历 `.github/workflows/*.{yml,yaml}` 拦截权限放开、缺少超时上界、action 运行时回退、`setup-node` 配置漂移与 npm 脚本/`scripts/*.mjs` 引用失配。
> 根级静态表面注记：`e2e/static-surface.spec.ts` 钉住 `src/proxy.ts` matcher 的两侧契约——(1) 不存在的根级路径必须落到真 404，不得被 `/[locale]` 渲染成 200 首页外壳；(2) `/share/{kind}/{payload}` 是根级真实路由，**不得**被补语言前缀（载荷里自带 locale，补前缀后全站分享链接 404）。`src/proxy.test.ts` 另有一条守卫枚举 `public/` 下全部文件，新增静态文件忘记加进 matcher 会失败。
> E2E 套件注记：`npm run e2e` 用**显式 spec 清单**驱动 Playwright（不是 `playwright test e2e/`），保证 CI 跑的是确定清单；代价是新增 `e2e/*.spec.ts` 若忘记登记就会静默不进 CI。`scripts/e2e-suite.test.mjs` 要求 `e2e/` 下每个 spec 都被某个 `e2e*` 脚本登记，并固定视觉基线 spec 只走 `npm run e2e:visual`（R7.8，不进 CI）。
> 并发注记：`ci.yml` 用 `concurrency` 收敛同一 PR 的连续 push（`cancel-in-progress` 只在 `pull_request` 事件为真，被取代的运行自动取消）；main 的 push 以 `github.run_id` 分组，保证每次提交都有独立的完整门禁结果。

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


## 英文树内容实测（R16.13）

```bash
npm run check:kb-en-content
```

上面两道盯的是文件名对不对得上，这条盯内容本身：`content/kline-buty/docs/knowledge/en/` 里每个 markdown（含 27 个章节 `README.md`，它们在站上会渲染成章首页）去掉 frontmatter 之后必须①非空、②CJK 字占比不超过 2%、③不小于同名中文正文的 30%。第③条的下界故意放得极松（英文同内容通常长 1.7–2.6 倍），抓的是「只翻了开头」这种量级。口径与阈值集中在 `scripts/en-content-lib.mjs`，CI 每次推送跑。

2026-09-24 实测：en 与 zh 各 209 个文件、按「章节/文件名」1:1 对齐、0 个找不到同名中文；最高 CJK 占比 0.52%（`reading-list/quant-psychology-books.md`）、最短正文也有同名中文的 1.70 倍（`quant-practice/data-acquisition.md`）、空正文 0 个。这条给界面上「English and Chinese cover the same 27 chapters」那句提供内容层面的下界；译文读起来地不地道仍是 kline-buty 侧的事，站上没有任何一句对地道性做承诺。


## 站内搜索同义词（R10.21）

词典 `src/lib/search-synonyms.ts`：交易术语中英别名归组（止损/stop loss、定投/DCA、均线/MA 等 25 组）。检索时把查询扩展为同组全部词条再取最高分——双语内容互相可达；词典自检（重复/空组/单字组）由单测锁定，R10.22 的「无结果诊断」复用同组匹配。

> 本手册转述的巡检参数（词典组数、FAQ 窗口与门槛、外链超时与重试次数）由 `scripts/ops-patrol-claims.test.mjs` 逐条钉回代码常量：文档里的数字与常量不等会红，把句子改成不含数字的措辞同样会红（核对不能靠句式还在不在）。

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

## 知识库 hash 基线与 changelog（R10.7）
```bash
npm run kb:changelog
```

对比 `scripts/kb-manifest.json` 的上次 sha256 快照与当前知识库内容；有新增、内容修改或移除时生成 `docs/kb-changelog-YYYY-MM-DD.md`，供人工复核后入库。CI 使用只读的 `npm run check:kb-changelog`：有漂移即失败且不写文件；缺少 hash 基线也不允许放行，必须走 `npm run kb:update` 完整同步。

> 与 `check:kb-pointer` 的分工：指针门禁只核对 gitlink / 工作区 / manifest `pointer` 是否同一 commit；本门禁进一步核对 manifest 里的逐文件 hash 是否真的对应该内容。

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
**输出会提交进公开仓库**，所以聚类带 k-匿名门槛：只有出现 ≥3 次（`K_MIN_COUNT`）的问题才进表，
单人独条的用户原话（可能带仓位、资金、平台名）不写入，且每条截到 80 字符。
门槛与截断由 `scripts/faq-candidates.test.mjs` 钉住；改门槛请一并复核这段说明。
需要 `SUPABASE_SERVICE_ROLE_KEY`（读 .env.local）；未配置时友好跳过。

## 外链巡检（R6.12）

```bash
npm run ops:link-patrol
```

HEAD（失败降级 GET）+ 10s 超时 + 网络错误重试一次；失效外链 exit 1。
默认 **fail closed**：知识库目录缺失、目录内没有 Markdown、或扫描结果为 0 个外链时 exit 1，避免空集被误报成“全部健康”。确知知识库当前确实没有外链时，可人工确认后显式放行：

```bash
LINK_PATROL_ALLOW_EMPTY=1 npm run ops:link-patrol
```

CI 里是**每月定时任务**（`.github/workflows/link-patrol.yml`，每月 1 日 03:00 UTC），也支持手动 workflow_dispatch 触发；CI 不设置空集豁免，零外链会保持可见失败。

## 生产冒烟（发布检查单第 5 步）

```bash
npm run ops:smoke-prod                                    # 默认打生产域名
SMOKE_BASE_URL=http://localhost:3111 npm run ops:smoke-prod   # 打本地生产构建（会先核对响应里是不是当前 .next 那次构建）
```

对**已部署的域名**跑 10 条只读断言，逐条打印后汇总；任一失败 exit 1。断言不是随手挑的，每一条都对应
历史上真出过问题的入口：

| 断言 | 为什么在清单上 |
|---|---|
| `/zh`、`/en`、章节页、课文页 200 且 HTML 含 `⚠️` | 内容红线（风险提示块）与双语路由 |
| `/sitemap.xml` 是 `<urlset>`、`/robots.txt` 指向 sitemap | 抓取入口退化时页面本身看不出来 |
| `/zh/changelog` 含最新发布版本号 | 「合并 ≠ 上线」：Vercel 配额限流会让生产停在旧构建（0.7.2 就停过一次） |
| `/share/streak/<合法载荷>` 200 且含 `⚠️` | R14.7：分享落地页曾经漏掉风险行 |
| `GET /api/auth/session` 匿名 → `200 {"user":null}` | PR #107：游客被判 500 的回归 |
| `POST /api/ai/chat` 游客：护栏路径 200 且模型路径不 5xx | 游客 AI 问答可用性；429 视为通过（限流生效即端点活着）。拆成两段是因为一句「AI 502」分不清站内还是站外：护栏在调用上游**之前**就返回，它 200 且带 `X-Refused` 就证明函数活着、部署没落后、内容红线还在，此时模型路径 502 只可能是上游配置或出口 |

预览域受 Vercel Deployment Protection 保护（未授权请求 302 到 SSO，R14.9），所以默认指向生产域名；
要覆盖预览需要账号级 protection-bypass 密钥。脚本本身由 `scripts/prod-smoke.test.mjs` 用假站点逐条验证：
每种退化都必须被抓出来，读不到发布版本号也算失败而不是跳过。
只有**传输层**失败（`fetch failed`、socket 挂断、超时）会重试到第 3 次，并在结论里写明是第几次才连上——
Vercel 边缘偶发一次 `fetch failed` 会把「部署没跟上」和「网络抖了一下」混成同一条红。断言不满足走的是返回值
而不是异常，所以重试不会把真实的站内回归刷成通过；非传输层异常一次定性。

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
