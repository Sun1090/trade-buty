# Progress

## API 路由输入校验与内部错误收敛（R7.12 / R9）

- 状态：DONE（本地实现与全量验证完成；远端发布待授权）
- 工作分支：`codex/zero-eslint-warnings`
- PR：none
- PR 状态：none
- Base：`origin/main@53f7e01`
- 远端 Head：none（`LOCAL_ONLY`，未推送）
- 本地提交：`1af8a41`、`c475b25`
- 目标：把 11 个 Route Handler 从「几乎全部 `await req.json() as X`、零运行时校验、多处回传 `error.message`」收紧为有界校验 + 通用错误文案 + 全量单测覆盖。
- 已完成：
  - 新增可复用纯函数：`parseJsonLoose`（去 ```json 围栏、取最外层括号片段、容忍尾逗号，返回 null 不抛）、`extractJsonBlock`、`BoundedMap`（FIFO 淘汰 + 写刷新 + 非法容量抛错）、`sweepExpired`。
  - `POST /api/ai/chat`：限流提前到 body 解析之前（畸形请求也计入配额）；仅允许 `user`/`assistant` 角色，阻断客户端注入 `system` 覆盖；≤40 轮、单轮 ≤8000 字、`continueFrom` ≤16000 字、章节 slug 白名单正则；上游错误不再回传，改通用中文 502；缓存改 `BoundedMap`（ipHits 10k / answerCache 500）。
  - `POST /api/ai/plan`、`/summary`、`/quiz`：新增各自解析器（slug 数组 ≤64 项、每项 ≤64 字；quiz 仅收 `^\d{1,3}$` 与非负 `questionIdx`、≤5 项）；LLM 返回改宽松解析并回退到文本；`summary` 补 `body.chapter` 过滤，修掉跨章节内容泄漏进摘要的真实缺陷；quiz 缓存改 `BoundedMap`（500）。
  - `POST /api/ai/conversations`：校验顺序改为先解析 body 再鉴权；`userMessage` ≤8000、`assistantMessage` ≤20000、`sources` ≤20 项且 slug ≤100；GET/POST 均改通用错误文案。
  - `POST /api/ai/feedback`、`/feedback/export`、`/citation-click`：加长度上限（问题 ≤2000 / 回答 ≤8000）、`try/catch` 包裹 Supabase 调用、服务端 `console.error` 记录、客户端只拿通用文案；export 的 `ADMIN_TOKEN` 鉴权路径补测。
  - `GET /api/auth/session`、`POST /api/auth/signout`：异常日志化，响应改 `user:null` / `"session error"` / `"signout error"`，不再回传 `e.message`。
  - 测试：新增/扩充 `chat`、`plan`、`summary`、`quiz`、`conversations`、`feedback`、`feedback/export`、`citation-click`、`session`、`signout` 路由的单测；此时 11 个 Route Handler **全部**有对应 `route.test.ts`（此前仅 4 个）。
- 验证命令与结果：
  - `npm test` → 188 文件 / 1428 用例全部通过；`npm run lint` exit 0（0 warning）；`npm run typecheck` exit 0；`npm run build` exit 0（473 静态页）。
  - 内容/SEO 门禁全绿：`check:mobile`、`check:docs`、`check:constitution`、`check:frontmatter`、`check:image-alt`、`check:glossary`、`check:slug-conflicts`、`check:description-dupes`、`check:kb-pointer`、`check:translation-history`、`check:kb-parity-budget`、`check:quiz-mounts`、`check:quiz-coverage`、`check:links`、`check:sitemap`（418 知识页）、`check:seo-surface`（430 sitemap / 454 页面）、`check:search-index`、`check:nav-chain`、`check:relative-links`、`check:bundle`（454 路由）、`check:structured-data`（454 页 / 5656 实体）全部 exit 0。
  - 数据与安全：`npm run db:test` exit 0（迁移 9/9、RLS 38、同步 26、`0008_*` 回滚→重放）；`npm run backup:drill` exit 0（30963 bytes，恢复库重跑 pgTAP 38+26 通过）；`npm run check:secrets` exit 0（587 文件无凭据）；`npm run audit:prod`、`npm run audit:all` → 0 vulnerabilities。
  - E2E 与性能：`npm run e2e` → 58 passed；`npm run lhci` exit 0（3 URL × 2 次，断言全过；无 GitHub token，跳过 status check）。
- 变更文件（关键）：`src/lib/ai/json-extract.ts`、`src/lib/bounded-map.ts`、`src/lib/ai/chat-input.ts`、`src/app/api/ai/*`、`src/app/api/auth/{session,signout}` 及各自 `route.test.ts`。
- 上游依赖：无（纯站内 API 层）。
- 未验证项：远端 CI / Vercel 部署（`LOCAL_ONLY`，未推送、未部署）；`db-tests` 作业（含备份恢复步骤）从未在 GitHub Actions 上运行过。
- 风险与回滚：改动集中在请求校验与错误文案，行为向后兼容（合法请求路径不变）；若上游依赖非 JSON 返回，已用宽松解析 + 文本回退兜底。回滚可分别撤销 `1af8a41`、`c475b25`。
- 下一步：roadmap 剩余项均为外部依赖（Sentry、Supabase 云联调、GSC/Bing、Vercel Analytics、PostHog、OG 卡片人工渲染、冷启动分发、云备份）。本地可继续的工作已清零。
- 最后更新：2026-09-13

## 备份恢复演练上线（Q5.4 本地半边 / R7 可恢复性）

- 状态：DONE（本地实现与全量验证完成；远端发布待授权）
- 工作分支：`codex/zero-eslint-warnings`
- PR：none
- PR 状态：none
- Base：`origin/main@53f7e01`
- 远端 Head：none（`LOCAL_ONLY`，未推送）
- 本地提交：`f19d47d`
- 目标：把「备份演练」从人工口头承诺变成可重复执行的自动化门禁，真实证明「实例整体丢失后能从 `pg_dump` 恢复出数据、schema、RLS 与约束」。
- 已完成：
  - 新增 `scripts/backup-drill.mjs`：干净 `supabase/postgres:17.6.1.155` 源容器 → 应用全部 9 个迁移 → 写入覆盖全部 10 张业务表的夹具数据 → `pg_dump -Fc --schema=public --no-owner --no-acl` → **销毁源容器模拟实例丢失** → 全新目标容器（先补 `auth.users` 外键行）→ `pg_restore --single-transaction --exit-on-error`。
  - 恢复后做三维指纹比对：逐表数据 md5、schema 指纹（表/列/RLS/策略/约束/索引/触发器/函数/扩展）、`authenticated` 权限；再在恢复库上重跑两个 pgTAP 文件。
  - 新增 `npm run backup:drill`，并追加到 `.github/workflows/ci.yml` 的 `db-tests` 作业（与主 `ci` 作业并行、失败即阻断）。
  - 演练过程中暴露并修掉两处 pgTAP 夹具脆弱点（真实 bug）：`rls_isolation.sql` 的 `kb_embeddings` 夹具改用独立 `chapter='rls-fixture'` 并按夹具计数，`sync_and_constraints.sql` 的每用户唯一性断言改为只统计两个测试用户，避免在非空库/恢复库上误判。
  - `docs/database-testing.md` 补第 4 节，写明演练流程与边界（仅 public schema 与业务数据；云 auth/Storage/项目配置、定时备份与仓库镜像确认仍属外部人工）。
- 验证命令与结果：
  - `npm run backup:drill` → exit 0：`备份 30963 bytes`；9 个迁移、10 张业务表、`rls_isolation.sql` 38 断言、`sync_and_constraints.sql` 26 断言在恢复库上全部通过。
  - `npm run db:test` → exit 0（迁移 9/9、RLS 38、同步 26、`0008_*` 回滚 → 重放通过）。
  - `npm run check:docs` → 通过（27 章 / 182 篇，zh/en 对齐）；`git diff --check` 干净；无遗留容器（`docker ps -a` 已确认）。
- 风险与回滚：演练只操作临时容器与临时 dump，不触碰线上数据；如需回滚，撤销 `f19d47d` 并从 `package.json` / `ci.yml` 移除 `backup:drill` 步骤即可。
- 未验证项：远端 CI —— `db-tests` 作业（含新增的备份恢复步骤）此前从未在 GitHub Actions 上运行过，本地绿灯不等于远端绿灯；Supabase 云导出、定时备份、仓库镜像确认（`BLOCKED_EXTERNAL`，见 roadmap Q5.4）。
- 最后更新：2026-09-13

## 错题 SRS 排期跨设备丢失修复（R5 / R9.9）

- 状态：DONE（本地实现与全量验证完成；远端发布待授权）
- 工作分支：`codex/zero-eslint-warnings`
- PR：none
- PR 状态：none
- Base：`origin/main@53f7e01`
- 远端 Head：none（`LOCAL_ONLY`，未推送）
- 本地提交：`6734824`、`0ee7103`
- 目标：修掉一个真实的跨设备数据缺陷——新答错的题目写进本机错题本后，SRS 排期没有随同步上行，换设备会静默退回按日期回填的近似排期。
- 已完成：
  - 根因：`recordWrong()` 只写 `chapterNum/questionIdx/picked/at`，却调用 `syncWrongbookWrite(chapter, idx, picked)` 省略 SRS 参数 → `sync-layer.ts` 显式 upsert `srs_stage: null, srs_due: null`；另一端 `mergeWrongbook` 把 null 当作「不覆盖」，于是条目退化成 `backfillSrs(entry.at)`，真实排期丢失。
  - 修复：`recordWrong()` 现在用 `srsOnAnswer(null, false)` 计算 `{ stage: 0, due: 今天+1 }`，本地落盘 `srsStage`/`srsDue` 并把两者一并传给 `syncWrongbookWrite`；重复答错同一题按状态机重置回 stage 0（行为正确）。
  - 补测：`wrongbook.test.ts` 用假时钟断言 `srsStage:0` / `srsDue:"2026-09-14"`，并 mock 校验 `syncWrongbookWrite("spot",2,3,0,"2026-09-14")`，另加一条重答重置用例。
  - 隐私导出随之变化：`srsStages` 由 `{ none: 2 }` 变为 `{ s0: 2 }`，`privacy-export.test.ts` 同步更新并新增「历史无 srs 字段条目仍归入 none」的用例，锁定前后兼容。
- 验证命令与结果：
  - `npx vitest run src/lib/wrongbook.test.ts src/lib/sync-layer-hydrate.test.ts src/lib/sync-layer.test.ts src/lib/srs.test.ts` → 4 文件 / 51 用例通过。
  - `npx vitest run src/lib/privacy-export.test.ts` → 1 文件 / 13 用例通过。
  - `npm test` → 178 文件 / 1359 用例通过；`npm run lint` exit 0（0 warning）；`npm run typecheck` exit 0；`npm run build` exit 0。
- 风险与回滚：改动只影响本地写入与上行的 SRS 字段；老数据读取路径未变（缺省仍按 `at` 回填）。如需回滚，撤销 `6734824`、`0ee7103` 两个提交。
- 未验证项：远端 CI、真实双设备跨端同步联调（`BLOCKED_EXTERNAL`，需 Supabase keys，见 roadmap Q2.8）；PR 与 Vercel 部署（`LOCAL_ONLY`，尚未推送/未部署）。
- 最后更新：2026-09-13

## 真实 Postgres 上的 RLS / 同步 / 回滚门禁（Q2.8 本地半边）

- 状态：DONE（本地实现与全量验证完成；远端发布待授权）
- 工作分支：`codex/zero-eslint-warnings`
- PR：none
- PR 状态：none
- Base：`origin/main@53f7e01`
- 远端 Head：none（`LOCAL_ONLY`，未推送）
- 本地提交：`f194963`
- 目标：把「RLS 越权防护」与「双设备同步约束」从 SQL 文本评审升级为在真实 Supabase Postgres 镜像上跑的可阻断门禁。
- 已完成：
  - 新增 `scripts/db-test.mjs`：拉起干净 `supabase/postgres:17.6.1.155` 容器、应用全部 9 个迁移、执行 pgTAP、跑 `0008_*` 回滚 → 重放演练、最后清理容器。
  - 新增两个 pgTAP 文件：`supabase/tests/rls_isolation.sql`（`SET ROLE authenticated/anon` 验证跨用户读写隔离，38 断言）与 `supabase/tests/sync_and_constraints.sql`（每用户唯一性、外键、目标档位约束等，26 断言）。
  - 新增 `npm run db:test` 与 `.github/workflows/ci.yml` 的 `db-tests` 并行作业；`docs/database-testing.md` 记录运行方式与设计取舍（`postgres` 角色绕过 RLS，故测试必须切角色）。
- 验证命令与结果：`npm run db:test` → exit 0（迁移 9/9、RLS 38 断言、同步/约束 26 断言、回滚 → 重放通过）。
- 风险与回滚：测试只操作一次性容器，不影响线上；如需回滚，撤销 `f194963` 并从 `package.json` / `ci.yml` 移除 `db:test`。
- 未验证项：远端 CI `db-tests` 作业从未在 GitHub Actions 上运行过；Supabase 云项目线上联调与真实双设备验证（`BLOCKED_EXTERNAL`，需 keys）。
- 最后更新：2026-09-13

## 测验选项键盘可达与回放回归去抖动（R13.9 / R13.5）

- 状态：DONE（本地实现与全量验证完成；远端发布待授权）
- 工作分支：`codex/zero-eslint-warnings`
- PR：none
- PR 状态：none
- Base：`origin/main@53f7e01`
- 远端 Head：none（`LOCAL_ONLY`，未推送）
- 本地提交：`b65a733`、`4bc9575`、`7e72d11`
- 目标：清掉三处测验界面上“只支持鼠标点击”的真实无障碍缺陷，并修掉一条会随机挂 CI 的回放回归测试竞态。
- 已完成：
  - 发现 `AiQuiz`、`AiChapterQuizCard`、错题本重答三处答案选项都是 `<li onClick>`，键盘用户无法聚焦、无法用 Enter/Space 作答，屏幕阅读器也拿不到可操作语义。
  - 三处均改为真正的 `<button>`，带 `aria-label="A. <选项>"`、`disabled={已作答}`、`focus-visible` 焦点环与 `w-full text-left` 布局；字母徽标 `aria-hidden` 以避免与 `aria-label` 重复播报。作答后禁用，防止二次提交。
  - 复用 `src/components/quiz.tsx` 已有的按钮化写法，保持四处测验交互一致。
  - 修复 `replay-trainer.test.tsx` 难度切换回归的真实竞态：`setData` 在被动态 `useEffect` 中执行，`waitFor` 可能在 DOM 文本已更新、effect 尚未刷新时返回，导致偶发读到旧的 30 根。将该断言包进 `waitFor` 等待 effect 刷新，杜绝随机失败。
- 已完成（续）：
  - 为错题本重答补真实浏览器回归 `e2e/full-site.spec.ts`「错题本重答选项可用键盘作答（R13.9）」：植入本机错题 → 随机抽题重答 → 聚焦选项 A → Enter 作答 → 断言 A/B 均禁用且出现正误反馈，锁死按钮语义在浏览器中的真实行为（此前仅单测覆盖）。
- 验证命令与结果：
  - `npx vitest run src/components/ai-quiz.test.tsx src/components/ai-chapter-quiz.test.tsx src/components/review-client.test.tsx` → 3 文件 / 16 用例通过（新增 3 条按钮可聚焦 + 作答后禁用用例）。
  - `npm test` → 178 文件 / 1356 用例通过。
  - `npm run lint` → exit 0（0 error / 0 warning）。
  - `npm run typecheck` → exit 0。
  - `npm run build` → exit 0。
  - `npm run e2e` → 58 passed（含新增错题本键盘重答用例）。
  - `npm run check:mobile` → 14 个关键页面 320px 无溢出。
  - `npm run check:docs` → 通过（27 章 / 182 篇，zh/en 对齐）。
  - CI 全量门禁本地复核全部 exit 0：`check:secrets`、`check:ai-copy`、`check:growth-event-privacy`、`check:dark-pattern-copy`、`check:constitution`、`check:frontmatter`、`check:image-alt`、`check:glossary`、`check:slug-conflicts`、`check:description-dupes`、`check:kb-pointer`、`check:translation-history`、`check:kb-parity-budget`、`check:quiz-mounts`、`check:quiz-coverage`、`check:links`、`check:sitemap`、`check:seo-surface`、`check:structured-data`、`check:nav-chain`、`check:relative-links`、`check:search-index`、`check:bundle`、`check:title-terminology`、`check:description-quality`、`check:risk-warning`、`kb:parity`、`audit:all`、`audit:prod`。
  - Lighthouse 13 本地复核（`npx lhci collect --collect.numberOfRuns=1` + `npx lhci assert`，Playwright Chrome for Testing 作 CHROME_PATH，未上传）：`/zh` a11y=100/perf=79/bp=96/seo=100，课程页 a11y=100/perf=82/bp=100/seo=100，`/chart` a11y=100/perf=83/bp=100/seo=100，assert exit 0。
- 风险与回滚：选项由 `<li>` 改为 `<button>` 只改变可交互语义与焦点行为，视觉类名保持不变；如需回滚，撤销 `b65a733` 即可。回放测试仅调整断言时机，不改生产代码。
- 未验证项：远端 CI、PR 与 Vercel 部署（`LOCAL_ONLY`，尚未推送/未部署）。
- 最后更新：2026-09-13

## 搜索键盘导航修复（Q2.4 / Q4.3 / R13.9）

- 状态：DONE（本地实现与全量验证完成；远端发布待授权）
- 工作分支：`codex/zero-eslint-warnings`
- PR：none
- PR 状态：none
- Base：`origin/main@53f7e01`
- 远端 Head：none（`LOCAL_ONLY`，未推送）
- 本地提交：`9da8438`、`48630e2`、`710d38c`
- 目标：修掉搜索结果键盘路径上的真实缺陷——未高亮任何结果时按回车无任何反应，并让高亮态与筛选、输入变化保持一致、可见。
- 已完成：
  - 修复 Enter 判定：原条件 `!focusIdx` 在 `focusIdx === -1` 时为 `false`，导致输入后直接回车不打开任何结果；改为 `filtered[focusIdx] ?? filtered[0]`，未高亮时打开第一条。
  - 方向键越界范围从全局 `results` 改为筛选后的 `filtered`，避免切到篇章筛选后高亮索引落到列表外。
  - 输入变化、Escape、篇章筛选切换都会重置 `focusIdx`，杜绝陈旧高亮指向错误结果。
  - 结果链接新增 `data-search-result-index`，高亮行使用 `border-accent ring-2 ring-[var(--accent-dim)]`，键盘用户能看到当前选中项。
  - 导航由 `window.location.href` 改为 `useRouter().push`，避免整页硬跳转、保持客户端路由语义。
  - 搜索联想补 WAI-ARIA 语义：输入框加 `aria-autocomplete="list"`、`aria-controls`、`aria-activedescendant`，联想面板 `<ul>` 变为 `role="listbox"`，每一项 `role="option"` 且带 `aria-selected`；Escape 同时清空 `suggestIdx`，避免指向已卸载的 option。
- 验证命令与结果：
  - `npx vitest run src/components/search-client.test.tsx` → 8/8 通过（新增 Enter 首条命中、ArrowDown 高亮与查询变化重置两条用例）。
  - `npm test` → 178 文件 / 1352 用例通过。
  - `npm run lint` → exit 0（0 error / 0 warning）；`npm run typecheck` → exit 0。
  - `npm run build` → 通过；`npm run check:mobile` → 14 个关键页面 320px 无溢出。
  - `npx playwright test e2e/full-site.spec.ts -g "键盘可高亮结果"` → 1 passed（真实浏览器中 Escape→ArrowDown 高亮、Enter 用 router 跳转到首条结果）。
  - 全量回归：`npm test` 178 文件 / 1353 用例通过；`npm run lint` exit 0；`npm run build` 通过；`npm run e2e` 57 passed；`npm run check:mobile` 14 页 320px 无溢出。
  - jest-axe/jsx-a11y：`npm run lint` 的 `jsx-a11y/role-supports-aria-props` 确认新增 ARIA 属性与 searchbox role 合法（不引入 aria-expanded，避免非法组合）。
- 风险与回滚：高亮只作用于搜索结果列表，不影响鼠标点击与联想下拉；若需回滚，撤销 `9da8438`、`48630e2` 两个提交即可恢复到旧的 Enter 行为。
- 未验证项：远端 CI、PR 与 Vercel 部署（`LOCAL_ONLY`，尚未推送/未部署）。
- 最后更新：2026-09-13

## Lighthouse 无障碍全绿与零容忍门禁（Q2.4 / R13.25）

- 状态：DONE（本地实现与全量验证完成；远端发布待授权）
- 工作分支：`codex/zero-eslint-warnings`
- PR：none
- PR 状态：none
- Base：`origin/main@53f7e01`
- 远端 Head：none（`LOCAL_ONLY`，未推送）
- 本地提交：`446900c`
- 目标：清理 Lighthouse 13 真实采样暴露的核心无障碍缺陷，并把代表性页面的 a11y 从「90 分通过」收紧为 100 分与具体审计零失败的 CI 门禁。
- 已完成：
  - 修复窄屏首页品牌链接和未登录账户链接无可辨识名称的问题，为两者补本地化 `aria-label`。
  - 定义暗色/亮色/护眼主题的 `--accent-on` 前景令牌，修复引导 CTA 在 `#34d399` 背景上仅 1.63:1 的对比度；当前暗色 8.23:1、亮色/护眼 5.48:1。
  - 代码块语言标签与复制按钮从半透明白色改为主题 `text-muted`，同时修复亮色/护眼代码块上的可读性，默认暗色对比度由 2.65:1 提升到 7.13:1。
  - 字号调节的 `aria-label` 纳入可见文本 `A-` / `A+`，并补齐本地化行距增减名称，满足 WCAG 2.5.3 标签名称一致要求。
  - `.lighthouserc.json` 将 accessibility 从 `minScore 0.9` 收紧为 `1`，并把 `color-contrast`、`link-name`、`label-content-name-mismatch` 设为 error；新增/扩展单测锁定可访问名称、语言标签颜色和字号控件语义。
- 验证命令与结果：
  - `npm run lint` → exit 0（0 error / 0 warning）；`npm run typecheck` → exit 0。
  - `npm test` → 178 文件 / 1350 用例通过；`npm run build` → 通过（473 静态页，搜索索引 418）。
  - `npx lhci autorun --upload.target=filesystem --upload.outputDir=.lighthouseci-a11y-gate` → 3 URL × 2 次采样，6/6 通过；三页 accessibility 均为 100，指定三项审计零失败。
  - 最新 6 次采样性能为 `/zh` 88、课程页 87、`/chart` 87；best-practices 为 96 / 100 / 100，SEO 全部 100。
- 风险与回滚：a11y 分数 100 表示当前 Lighthouse 审计集通过，不替代真实屏幕阅读器与跨浏览器人工抽查；若新页面引入未覆盖组件，CI 仍只检查当前三个代表 URL，后续应扩充采样面。
- 未验证项：远端 CI、PR 与 Vercel 部署（`LOCAL_ONLY`，尚未推送/未部署）。
- 最后更新：2026-09-12

## 凭据扫描与依赖漏洞清零（Q5.3 / R13.25）

- 状态：DONE（本地实现与全量验证完成；远端发布待授权）
- 工作分支：`codex/zero-eslint-warnings`
- PR：none
- PR 状态：none
- Base：`origin/main@53f7e01`
- 远端 Head：none（`LOCAL_ONLY`，未推送）
- 本地提交：`cd8c3c2`、`bc24769`
- 目标：把密钥泄漏和依赖漏洞从人工抽查升级为 CI 阻断门禁，并清零当前全量依赖审计告警。
- 已完成：
  - 新增 `npm run check:secrets`：扫描受版本控制及未忽略的新文本文件，覆盖私钥、AWS/GitHub/OpenAI/Stripe/Google/Slack token、JWT 与硬编码密钥赋值；命中日志只输出文件、行列和规则名，不回显疑似值，测试值与环境变量占位符有明确豁免。
  - CI 在 `npm ci` 后执行 `audit:prod`、新增的 `audit:all` 与 `check:secrets`；workflow 契约测试锁定三个安全步骤，避免后续 YAML 改动静默漏跑。
  - 新增 secret-scan 单元测试与 CLI 负向测试：临时 Git 仓库写入伪造密钥时退出码为 1，且 stdout/stderr 均不包含命中值。
  - 通过 npm `overrides` 将 Lighthouse/Puppeteer 工具链修复到 `lighthouse@13.4.1`、`tmp@0.2.7`、`uuid@11.1.1`、`qs@6.16.0`；完整依赖审计由 13 项（2 low / 4 moderate / 7 high）降为 0。
- 变更文件：`.github/workflows/ci.yml`、`package.json`、`package-lock.json`、`scripts/check-secrets.mjs`、`scripts/secret-scan-lib.mjs`、`scripts/secret-scan.test.mjs`、`scripts/ci-workflow.test.mjs`、`docs/ops.md`、`docs/deps.md`。
- 验证命令与结果：
  - `npm ci` → exit 0；`npm run audit:all` → found 0 vulnerabilities；`npm run audit:prod` → found 0 vulnerabilities。
  - `npm run check:secrets` → 扫描 569 个文本文件、跳过 10 个非文本项、0 findings；CLI 负向测试确认退出码和脱敏输出。
  - `npm run lint` → exit 0（0 error / 0 warning）；`npm run typecheck` → exit 0。
  - `npm test` → 178 文件 / 1348 用例通过；`npm run build` → 通过（Next.js 16.3.5，473 静态页，搜索索引 418）。
  - `npx lhci autorun --upload.target=filesystem --upload.outputDir=.lighthouseci` → 3 URL × 2 次采样，6/6 断言通过；证明 Lighthouse 13 override 与现有 LHCI 命令兼容。
  - `git diff --check` → 通过。
- 风险与回滚：Lighthouse override 跨越 `@lhci/cli` 声明的版本范围；已用 clean install、build、全量单测和真实 LHCI 采样验证。上游发布兼容版后应移除 override 并再次审计；密钥扫描命中任何值都应先吊销再修代码/历史。
- 未验证项：远端 CI、PR 与 Vercel 部署（`LOCAL_ONLY`，尚未推送/未部署）。
- 最后更新：2026-09-12

## 零警告 CI、数据契约与本地全量验收（Q2.5 / R13.25）

- 状态：DONE（本地实现与全量验证完成；远端发布待授权）
- 工作分支：`codex/zero-eslint-warnings`
- PR：none
- PR 状态：none
- Base：`origin/main@53f7e01`
- 远端 Head：none（`LOCAL_ONLY`，未推送）
- 本地提交：`dc5ecb6`、`5f90dd2`、`b55019d`、`6d220ab`、`a32e2c0`、`90de579`、`dc22107`、`0dbd75d`、`49b8204`、`2081717`、`8fe3759`、`f7b8992`、`516ec26`、`ef26c23`
- 目标：清零全仓库 ESLint 警告，把「零警告」与 320px 溢出变成 CI 阻断门禁，并修复门禁复核暴露的 UI、内容回退、AI 持久化、数据库约束和 PWA E2E 稳定性问题。
- 已完成：
  - `npm run lint` 固定为 `eslint --max-warnings=0`，59 条既有 warning 清零；CI 在生产构建后执行 `check:mobile`，覆盖 14 个关键 zh/en 页面的 320px 横向溢出回归。
  - 修复 K 线 MA 关闭后残留 series、回放切换难度/上下文不重载历史、搜索最近记录保存非 debounce 词三个真实状态缺陷，并补回归测试。
  - 章节页对上游缺失/不合规风险提示的 README 注入本地化兜底提示；不改 `content/kline-buty` 子模块原文，也不掩盖 `check:risk-warning` 的上游缺口统计。
  - AI 对话保存接口新增请求体校验，`sources` 直接写为 JSONB；新增路由测试，避免 JSON 字符串与查询模型不一致。
  - 新增 `0008_goal_tier_constraints.sql` 归一化并约束日/周目标档位，提供匹配回滚脚本；扩展 Drizzle schema 镜像与静态契约测试，覆盖表列、RLS、策略及约束。
  - Playwright 使用独立端口避免复用陈旧本地服务；离线 E2E 先在线导航预热 service worker，再切换 CDP offline，消除冷启动竞态。
  - 修复 CI 工作流中 heredoc 顶层 `---` 形成第二份 YAML document、导致 dry-run 之后质量门禁被静默跳过的问题；新增 workflow 契约测试锁定单文档和完整步骤，并让 CI 在当前提交重生成内容质量报告后再归档。
  - 按 Next.js 16.3.5 官方弃用说明移除 8 个 AI 路由的 Edge Runtime，统一使用默认 Node.js runtime；新增运行时契约测试，缓存文档同步更新，生产构建不再输出弃用警告。
  - 将 Vitest 配置迁移为 `vitest.config.mts`，用 `import.meta.dirname` 替代 CommonJS `__dirname`，消除 Vite 原生配置加载提示。
- 变更文件：`.github/workflows/ci.yml`、`package.json`、`playwright.config.ts`、`vitest.config.mts`、`scripts/**`、`src/components/**`、`src/lib/**`、`src/app/api/ai/**`、`supabase/migrations/0008_goal_tier_constraints.sql`、`supabase/rollback/**`、`e2e/pwa-offline.spec.ts`、`docs/**`。
- 验证命令与结果：
  - `npm run lint` → exit 0（0 error / 0 warning）。
  - `npm test` → 177 文件 / 1339 用例通过；`npx vitest run scripts/ci-workflow.test.mjs` → 2/2 通过。
  - `npm run typecheck` → 通过；`npm run build` → 通过（Next.js 16.3.5，473 静态页，搜索索引 418；SEO 可索引页面口径为 454）。
  - `npm run e2e` → 56/56 通过；`npm run lhci` → 3 URL × 2 次采样，6/6 断言通过。
  - `npm run check:mobile` → 14 个关键页面 320px 无溢出。
  - 内容与产物门禁全部通过：docs、frontmatter、image-alt、glossary、slug-conflicts、description-dupes、kb-pointer（`a57d510`）、translation-history、kb-parity-budget、quiz-mounts、quiz-coverage、links、sitemap（418）、seo-surface（430/454）、search-index（418/418）、nav-chain、relative-links、bundle（454 路由）、structured-data（454 页 / 5656 实体）、ai-copy、growth-event-privacy、dark-pattern-copy。E2E 会为 fallback 请求在 `.next` 留下运行时路由；按检查器约定执行干净 `npm run build` 后，结构化数据、SEO、sitemap、搜索索引与 bundle 门禁全部复验通过。
  - `npm run check:risk-warning` → 课程正文 364/364，通过；章节 README 40/54（12 review / 2 gap，上游缺口，见 `docs/risk-warning-coverage.md`）。
  - `npm run audit:prod` → 0 漏洞；`git diff --check` → 通过。
- 上游依赖：知识库指针 `a57d510`，zh/en 各 27 章 / 182 篇；README 风险提示剩余缺口需在 kline-buty 仓库修复。
- 未验证项：远端 CI、PR 与 Vercel 部署（`LOCAL_ONLY`，尚未推送/未部署）。
- 风险与回滚：`--max-warnings=0` 会让新增 warning 直接阻断 CI，属预期收紧；代码可按提交分别 revert。`0008` 回滚仅移除约束，不恢复被归一化的历史业务值，详见 `supabase/rollback/README.md`。
- 下一步：获得 `PR_UPDATE` / `PR_CREATE` 授权后推送本分支并复核远端 CI；继续处理 roadmap 的外部阻塞与上游内容缺口。
- 最后更新：2026-09-12

## 文档契约、内容报告与完整本地验收（Q5.1 / Q5.2 / R2.2）

- 状态：DONE
- 工作分支：`codex/r13-e2e-expansion`
- PR：none
- PR 状态：none
- Base：`origin/main@abe8106`
- 远端 Head：none（LOCAL_ONLY，未推送）
- 本地提交：`ff0013b`、`76174c2`、`34635c3`
- 目标：清除 README/AGENTS/plan/research/p2-research 中与当前实现不一致的契约，加入可回归的文档一致性门禁，并刷新真实内容报告。
- 已完成：
  - 新增 `check:docs`：核对双语 README 的 27 章 / 182 篇、AGENTS 的 `{zh,en}` 与 English-slug 契约、plan 当前技术栈，以及 README 与 About 页“不接受广告/捐赠”的同一承诺；CI 已阻断。
  - 修正历史文档口径：移除 README 赞助入口与二维码；将 Clerk、Pagefind、Claude API、shadcn/lucide 明示为历史/已作废选型；补充 Supabase Auth、构建时 JSON 索引、OpenAI 兼容端点和当前内容规模。
  - 按现有脚本重生成 `content-inventory` 与 `new-course-acceptance`：182/182 双语覆盖；364 项验收全部 ok，旧存量的 6 个必过失败已清除。
  - 更新 roadmap 中已有真实验证的 Q1.3–Q1.6、Q5.1–Q5.3、R2.2、R6.1–R6.2、R6.5、R6.7、R6.10–R6.11 状态与证据。
- 变更文件：`AGENTS.md`、双 README、`.github/workflows/ci.yml`、`package.json`、`scripts/*docs-consistency*`、`docs/{plan,research,p2-research,roadmap,growth-checklist,growth-copy-policy}.md`、`docs/{content-inventory,new-course-acceptance}.{json,md}`、`src/lib/ai/prompt.ts`、两枚捐赠二维码。
- 验证命令与结果：
  - `npx vitest run scripts/docs-consistency-lib.test.mjs scripts/sitemap-lib.test.mjs scripts/content-changelog-lib.test.mjs` → 3 文件 / 14 用例通过。
  - CI 等价全门禁 → `lint` 0 error，170 文件 / 1315 用例通过，`typecheck` 通过。
  - 干净生产构建 → 465 静态页；死链 454 页 / 8958 链接 0；sitemap 418；搜索索引 418/418；结构化数据 454 页 / 5656 实体；全部 bundle 预算通过。
  - `npm run e2e` → 56/56 通过；`npm run lhci` → 3 URL × 2 次采样断言通过。
  - `npm run audit:prod` → 0 漏洞；`git diff --check` → 通过。
- 上游依赖：无新增；知识库保持本地提交 `1ebbaef`，双语均 182 篇。
- 未验证项：远端 CI、PR 状态与部署（LOCAL_ONLY；当前远端不存在该 head 的 PR，且未推送）。
- 风险与回滚：`check:docs` 会故意锁住少数稳定文案，若页面承诺变化需同步 About 与 checker；回滚可按三个提交分别 revert，不涉及远端或数据迁移。
- 下一步：执行可回滚的补丁/minor 依赖升级并重跑全门禁；其余 roadmap 未勾选项均需外部账号、人工发布或真实用户证据。
- 最后更新：2026-09-12

## 图片资产审计真实验证（R6.6 / R10.12）

- 状态：DONE
- 工作分支：`codex/r13-e2e-expansion`
- Base：`origin/main@abe8106`
- 远端状态：未推送（LOCAL_ONLY）
- 目标：修复 `check:image-alt` 宣称检查孤儿资产、实际只检查 zh/en 集合镜像的静默失真。
- 已完成：
  - 新增 `scripts/image-audit-lib.mjs`，把磁盘资产与 Markdown 实际引用分离，逐项报告孤儿资产和镜像漂移。
  - `scripts/check-image-alt.mjs` 记录全部 `_assets` 引用后再调用审计函数；空 alt、引用不存在、孤儿资产、镜像漂移四类问题均以非零退出阻断。
  - 新增 `scripts/image-audit-lib.test.mjs`，覆盖正常引用、双 locale 孤儿、单侧镜像漂移。
- 变更文件：`scripts/check-image-alt.mjs`、`scripts/image-audit-lib.mjs`、`scripts/image-audit-lib.test.mjs`、`docs/roadmap.md`、`docs/progress.md`。
- 验证命令与结果：
  - `npx vitest run scripts/image-audit-lib.test.mjs` → 1 文件 / 3 用例通过。
  - `npm run check:image-alt` → exit 0（102 处图片、102 个资产引用、无孤儿/镜像漂移）。
  - `node --check` 三个脚本与 `git diff --check` → 通过。
- 未验证项：远端 CI 与部署（LOCAL_ONLY，未推送）。
- 最后更新：2026-09-12

## 新章节上线四项核对（Q1.7）

- 状态：DONE
- 工作分支：codex/r13-e2e-expansion
- Base：origin/main@abe8106
- 远端状态：未推送（LOCAL_ONLY）
- 目标：把新章节上线清单从人工记忆变成 dry-run 可执行输出，覆盖索引、sitemap、固定题挂载点和 /path 阶段分组。
- 已完成：
  - 新增 `buildReleaseChecklist()`：固定输出搜索索引、sitemap、测验挂载点、路径分组四项，分别标记 ready / action / block，并给出真实验证命令。
  - 新增 `parseStageSlugs()`：用 TypeScript AST 读取 `src/lib/path.ts` 的 STAGES，避免只检查 CHAPTER_ORDER 却漏掉 `/path` 与知识图谱展示。
  - `kb:dry-run` 会读取真实 `quizzes.ts` 挂载：固定题的 docSlug 不在草稿课程内时阻断；未挂固定题时明确提示 AI 回退，不误报为已配置。
  - 新增 `docs/new-chapter-release-checklist.md`，记录四项检查、合入顺序与发布门禁。
  - 扩展 `src/lib/new-chapter.test.ts` 至 11 个用例，含真实 path.ts 的 27 章解析、四项就绪、坏挂载阻断和未分组提示。
- 变更文件：`scripts/new-chapter-lib.mjs`、`scripts/dry-run-new-chapter.mjs`、`src/lib/new-chapter.test.ts`、`docs/new-chapter-release-checklist.md`、`docs/ops.md`、`docs/roadmap.md`。
- 验证命令与结果：
  - `npx vitest run src/lib/new-chapter.test.ts` → 1 文件 / 11 用例通过。
  - CI 等价 dry-run 冒烟 → exit 0；输出四项核对，未挂固定题和未分组分别显示可执行的 ⚠️，而非静默通过。
  - `node --check scripts/new-chapter-lib.mjs`、`node --check scripts/dry-run-new-chapter.mjs` → 通过。
- 未验证项：远端 CI 与部署（LOCAL_ONLY，未推送）。
- 最后更新：2026-09-12

## 测验挂载点与题库覆盖率门禁修复（R6.3 / R6.4）

- 状态：DONE
- 工作分支：codex/r13-e2e-expansion
- Base：origin/main@abe8106
- 远端状态：未推送（LOCAL_ONLY）
- 目标：修复内容门禁“命令成功但实际只检查少数题库”的静默失真，确保 CI 对全部 27 章验真。
- 缺陷与修复：
  - 原 `check-quiz-mounts` 用跨对象正则解析 `quizzes.ts`，生产文件实际只有 2/27 个对象能命中，却仍以 0 退出；其余 25 个 `QUIZZES["chapter"] = {...}` 挂载没有被真实验证。
  - 原 `check-quiz-coverage` 同样只按旧对象字面量结构识别，固定题库被低报为 2/27。
  - 新增 `scripts/quiz-source-lib.mjs`，使用仓库已安装的 TypeScript Compiler API 解析对象字面量与索引赋值两种挂载形式，不再依赖跨块正则。
  - `check-quiz-mounts` 现在校验全部挂载的 `chapterNum`、`docSlug`、真实课程文件和每题至少 3 道固定题；同时拒绝重复键。
  - `check-quiz-coverage` 现在按真实 `questions` 数组长度统计，缺章、题目非数组或少于 3 道都会阻断。
- 变更文件：`scripts/quiz-source-lib.mjs`、`scripts/quiz-source-lib.test.mjs`、`scripts/check-quiz-mounts.mjs`、`scripts/check-quiz-coverage.mjs`、`docs/roadmap.md`、`docs/ops.md`。
- 验证命令与结果：
  - `npx vitest run scripts/quiz-source-lib.test.mjs` → 1 文件 / 3 用例通过，含生产源 27 挂载与 81 道题断言。
  - `npm run check:quiz-mounts` → exit 0（27 章挂载，chapter/doc 均存在）。
  - `npm run check:quiz-coverage` → exit 0（27/27 章，共 81 道固定题）。
  - `npm test` → 165 文件 / 1289 用例通过。
  - `npm run lint` → exit 0（0 error / 59 warning）。
  - `npm run typecheck` → exit 0。
- 未验证项：远端 CI 与部署（LOCAL_ONLY，未推送）。
- 最后更新：2026-09-12

## 核心交互无障碍（Q2.4）

- 状态：DONE
- 工作分支：codex/r13-e2e-expansion
- Base：origin/main@abe8106
- 远端状态：未推送（LOCAL_ONLY）
- 目标：抽查核心学习路径能否只用键盘完成；焦点必须可见，表单/筛选控件必须有稳定可访问名称。
- 已完成：
  - 课程图片在交互模式下增加 `role="button"`、`tabIndex=0`、`aria-haspopup="dialog"`；Enter/Space 打开灯箱，Escape 关闭并把焦点归还图片。
  - 随堂测选项覆盖 Enter/Space 键盘答题全路径；回放的速度、难度、盲盒/自定义、暂停与跳转控件补齐 `aria-pressed`、本地化名称和分组语义。
  - 行情图的交易对/周期控件、自定义交易对输入、搜索篇章筛选和邮件订阅输入补齐可访问名称。
  - 移除 6 个组件中会压制全局焦点环的 `outline-none` 类；测验选项、回放周期、图表自定义输入、订阅邮箱由 Playwright 断言 `:focus-visible` 的 2px solid ring。
  - 新增 `docs/accessibility-audit.md`，记录检查范围、交互契约、证据和未覆盖的人工审计边界。
- 变更文件：`src/components/{markdown,image-lightbox,replay-trainer,kline-chart,chart-embed,search-client,newsletter-signup}.tsx`、`src/app/[locale]/knowledge/[chapter]/[doc]/page.tsx`、`src/app/[locale]/search/page.tsx`、`src/lib/i18n.ts`；对应单测与 `e2e/full-site.spec.ts`。
- 验证命令与结果：
  - `npx vitest run src/components/markdown.test.tsx src/components/image-lightbox.test.tsx src/components/newsletter-signup.test.tsx src/components/search-client.test.tsx src/lib/i18n.test.ts` → 5 文件 / 32 用例通过。
  - `npm test` → 164 文件 / 1286 用例通过。
  - `npm run lint` → exit 0（0 error / 59 warning）。
  - `npm run typecheck` → exit 0。
  - `npm run build` → exit 0（Next.js 16.3.5，465 静态页）。
  - `npx playwright test e2e/full-site.spec.ts -g 'Q2.4'` → 3/3 通过。
  - `npm run e2e` → 56/56 通过。
- 未验证项：NVDA / VoiceOver 真机屏幕阅读器、Safari/Firefox 人工焦点走查、远端 CI 与部署（LOCAL_ONLY）。
- 最后更新：2026-09-12

## 课程预计阅读时长（Q4.4）

- 状态：DONE
- 目标：课程页同时展示正文预计阅读时长与当前设备已读累计，避免把停留时长误当作篇幅估算；中英文文案均使用准确量纲。
- 已完成：
  - 新增 `estimateReadingMinutes()` 纯函数：中英混合正文按中文 300 字/分钟、英文 200 词/分钟合并后向上取整。
  - 估算排除 frontmatter、围栏/行内代码、HTML 标签和链接 URL，同时保留链接/图片的可见文字。
  - 课程页展示 zh「约 N 分钟阅读」/ en「~N min read」，并保留原有「已读/read」本地累计显示。
  - 新增 7 个纯函数单测与 1 条课程页 Playwright 回归断言。
- 验证命令与结果：
  - `npx vitest run src/lib/estimated-reading-time.test.ts src/lib/i18n.test.ts` → 2 文件 / 16 用例通过。
  - `npm test` → 164 文件 / 1281 用例通过。
  - `npm run lint` → exit 0（0 error / 59 warning）。
  - `npm run typecheck` → exit 0。
  - `npm run build` → exit 0。
  - `npx playwright test e2e/smoke.spec.ts --grep '章节页'` → 1/1 通过，真实课程页标签可见。
- 未验证项：远端 CI 与部署（LOCAL_ONLY，未推送）。
- 最后更新：2026-09-12

## 搜索索引错误边界（Q2.6）

- 状态：DONE
- 目标：外部搜索索引加载失败时，不能再把失败伪装成“无结果”；图表、搜索、AI 三个入口都要有可恢复降级 UI。
- 已完成：
  - `SearchClient` 的裸 `fetch("/search-index.json")` 改为受保护加载：校验 HTTP 状态与数组载荷，失败显示 `role="alert"` 错误态和重试按钮。
  - 错误态与无结果态互斥，重试成功后恢复搜索；补齐 zh/en 文案。
  - 新增 2 个组件回归测试：首次失败不显示误导性空结果 CTA；重试成功恢复并只请求两次。
- 验证命令与结果：
  - `npx vitest run src/components/search-client.test.tsx` → 3/3 通过。
  - `npm test` → 163 文件 / 1274 用例通过。
  - `npm run lint` → exit 0（0 error / 59 warning）。
  - `npm run typecheck` → exit 0。
  - `npm run build` → exit 0（Next.js 16.3.5）。
- 未验证项：远端 CI 与部署（LOCAL_ONLY，未推送）。
- 最后更新：2026-09-12

## v0.6 关账与发布复盘（R13.25）

- 状态：DONE（R13.23 作为同一里程碑的独立项为 BLOCKED_EXTERNAL，不随本项关账）
- 工作分支：codex/r13-e2e-expansion
- PR：none（无关联 PR；gh pr list 为空）
- PR 状态：none
- Base：origin/main@abe8106
- 远端 Head：未推送（LOCAL_ONLY）
- 本地提交：30d180e（kb 同步）、4c867fa（描述评分修复）、47d8628（术语子串修复）、d65b2ec（本关账）
- 目标：按 roadmap v0.6 关账标准复核 R10–R13，产出发布复盘文档，并如实分类未完成/阻塞项。
- 已完成：
  - 新增 `docs/v0.6-release-review.md`：关账标准对照、交付范围、全量门禁证据、安全与依赖、部署回滚、未完成与阻塞、已知告警。
  - roadmap R13.25 标记完成；R13.23 保持未勾选并显式标注 `BLOCKED_EXTERNAL`。
  - 关账期暴露并修复三处真实缺陷（见下）。
- 变更文件：docs/v0.6-release-review.md、docs/roadmap.md；缺陷修复见下两条。
- 验证命令与结果：
  - `npm run lint` → exit 0（0 error / 59 warning）
  - `npm test` → exit 0（163 文件 / 1272 用例）
  - `npm run typecheck` → exit 0
  - `npm run build` → exit 0（Next.js 16.3.5，465 静态页，搜索索引 418）
  - `npm run e2e` → exit 0（Playwright 53/53）
  - `npm run lhci` → exit 0（3 URL × 2 采样，6/6 断言；本地仅写文件系统，未上传公共存储）
  - `npm run audit:prod` → `found 0 vulnerabilities`
  - 内容门禁全绿：frontmatter / slug-conflicts / description-dupes / glossary / image-alt / quiz-mounts / quiz-coverage / kb-pointer（a57d510）/ translation-history / kb-parity-budget / links / sitemap（418）/ seo-surface（430/454）/ search-index / nav-chain / relative-links / bundle（454 路由）/ structured-data（5656 实体）/ ai-copy / growth-event-privacy / dark-pattern-copy / constitution（报告式）
- 上游依赖：
  - 章节 README 风险提示缺口（40/54）属 kline-buty 内容，本仓库禁止就地编辑 → `BLOCKED_UPSTREAM`。
  - 未完成项 R13.23（评论/排行榜用户研究）需真实目标用户证据 → `BLOCKED_EXTERNAL`。
- 未验证项：远端 CI 与部署（LOCAL_ONLY 未推送/未部署）。
- 风险与回滚：见 docs/v0.6-release-review.md §4/§6；无 schema 迁移，回滚 = revert 上一发布提交后重部署。
- 下一步：授权后推送 codex/r13-e2e-expansion 复核远端 CI；推进 R13.23 用户研究与上游风险提示补齐。
- 最后更新：2026-09-12

## 内容报告缺陷修复（R10.3 / R10.4 复查）

- 状态：DONE
- 目标：关账复核发现两处评分/匹配缺陷并修复，避免运营报告产生假告警。
- 已完成：
  - `4c867fa`：`scripts/description-quality-lib.mjs` 的 `titleWords()` 未剥离契约的 `NN ·` 序号前缀，把 `01` 当标题词压低相关性；改为复用 `stripTitleOrder`，补回归测试（带/不带前缀评分一致、原 title 保留），report pass 286→294、review 78→70。
  - `47d8628`：`scripts/title-terminology-lib.mjs` 的 `findTitleTerms()` 未抑制被更长术语包含的短术语（「交易」⊂「交易所」），产生 2 处假 gap；修复后 gap 2→0、pass 60→62。
- 验证命令与结果：`npx vitest run src/lib/description-quality.test.ts src/lib/title-terminology.test.ts`（11 用例通过）；`npm run check:description-quality`、`npm run check:title-terminology` 重生成报告；`npx eslint` 改动文件 0 error。
- 未验证项：无。
- 最后更新：2026-09-12

## 知识库版本同步（kline-buty@a57d510）

- 状态：DONE
- 已完成：`30d180e` 按 `npm run kb:update` 同步上游 1ebbaef→a57d510（5 提交，内容零变更，仅子模块指针与 kb-manifest 快照）。
- 验证命令与结果：`check:kb-pointer` 通过（仓库记录 = 工作区 = 快照 = a57d510）；构建仍 465 页。
- 未验证项：无。
- 最后更新：2026-09-12


## 2026-09-12 — 生产依赖安全修复

在 v0.6 发布关账审计中发现并在发布前修复 critical 生产漏洞：

- `next@16.3.1` 命中 GHSA-p293-qw3h-jr36 / GHSA-2xp9-vwfh-vxw4，升级到 `16.3.5`；`eslint-config-next` 同步到 `16.3.5`，Next 自带 `sharp` 更新到 `0.35.4`。
- `gray-matter` 的 `js-yaml@3.15.1` 与 ESLint 配置链的 `js-yaml@4.3.1` 通过 npm `overrides` 固定到修复版本 `3.15.2` / `4.3.2`。
- 新增 `npm run audit:prod`，只用 `--omit=dev --audit-level=high` 阻断实际部署依赖的 high / critical 漏洞，并加入 CI 的 `npm ci` 后。
- 完整开发依赖审计剩余 13 项来自 `@lhci/cli@0.15.1` 的 Lighthouse / Puppeteer 工具链；截至审计无可用修复版且不进入生产产物，已记录在 `docs/deps.md`。生产依赖审计为 0。
- 后续 `bc24769` 已通过经过验证的 overrides 将该全量审计告警清零；当前状态以文首「凭据扫描与依赖漏洞清零」为准。

Verification recorded:

- `npm run audit:prod`：`found 0 vulnerabilities`。
- 全量 Vitest：163 文件 / 1270 用例通过；lint 0 error（59 条既有 warning）；typecheck 通过。
- 干净构建：Next.js 16.3.5，465 静态页，搜索索引 418 条。
- 全量 Playwright：53/53 通过；Lighthouse CI 三页各 2 次、共 6 次采样全部通过断言。

## 2026-09-12 — R13.24 v0.6 全站 E2E 冒烟扩展

把 v0.6 已有的单点回归串成可重复执行的双语全站用户闭环，并修复浏览器回归暴露出的真实语言语义缺陷：

- 新增 `e2e/full-site.spec.ts`，11 条 Playwright 用例覆盖中英文核心路由、搜索到课程跳转、收藏写入与回访、错题掌握与移除、无登录统计、本机来源标识、双语术语表、完整隐私 JSON 导出、行情图真实请求参数与周期切换、回放品种 / 周期重载，以及三题满分和历史最佳落盘。
- 图表与回放断言使用确定性的 Binance 响应，验证真实请求参数和切换后的重新拉取；不依赖外部行情可用性。
- Playwright 回归发现 `/zh/*` 页面原先输出 `<html lang="en">`。根布局初始化脚本现在根据首段路径设置 `en` / `zh-CN`，新增 `LocaleHtmlLang` 在客户端 locale 导航后继续同步，并通过 E2E 对每个核心路由钉住运行时语言属性。
- 新增三题满分组件回归，证明完成第三题后持久化 `best: 3`，不通过修改计分逻辑迎合测试。
- `npm run e2e` 已纳入新 spec，后续 CI 会持续覆盖这些用户路径。

Verification recorded:

- 聚焦 Playwright：`npx playwright test e2e/full-site.spec.ts` 11/11 通过；单独复跑 PWA 离线导航用例 1/1 通过。
- 全量 Vitest：163 文件 / 1270 用例通过。
- `npm run lint` 0 error（59 条既有 warning）；`npm run typecheck` 通过。
- 干净生产构建 465 静态页；搜索索引 418 条、KB 契约通过。重构后完整 Playwright：53/53 通过。
- Lighthouse CI 对 `/zh`、知识课程页和 `/chart` 的 6 次采样全部通过断言。

未验证项：LOCAL_ONLY 权限下未推送、未创建或更新 PR、未部署，因此远端 CI 与本轮本地结果尚待授权后同步验证。

## 2026-09-12 — R13.22 社交功能轻量化设计评审

完成 v0.6 社交边界评审，并交付其中唯一通过的最小社交链路：用户主动发起的学习里程碑分享。排行榜、评论、私信、关注和关系链明确不在本期引入，避免把匿名学习变成公开对抗或承担尚未建立的审核运营成本。

- 新增 `src/lib/milestone-share.ts`：七级里程碑阶梯、最高已达成项选择、受白名单约束的文案填充，以及不带进度参数的公开学习路线链接。
- 新增 `src/components/milestone-share-button.tsx`：无里程碑时完全不渲染；优先 Web Share；用户取消不报错、不复制、不发失败事件；不可用或非取消失败时降级到剪贴板；剪贴板失败才显示可访问错误。
- 在 `/[locale]/stats` 接入分享入口，补齐中英文文案，并把 `milestone-share` 登记进增长表面唯一事实来源。
- 扩展增长事件契约到 8 类：`milestone_share` 只允许 `locale`、`channel`、`outcome` 白名单字段，仍只写本机开发者控制台，不发网络、不持久化分享正文或 URL。
- 新增 `docs/social-features-review.md`，记录三层社交范围、已交付实现、拒绝方案、隐私边界和重评审条件。

Verification recorded:

- 聚焦 Vitest：里程碑模型 10 用例、组件 5 用例、stats 集成 27 用例、增长事件契约及隐私测试通过。
- 全量 Vitest：163 文件 / 1269 用例通过；`npm run lint` 0 error（59 条既有 warning）；`npm run typecheck` 通过。
- 干净生产构建 465 静态页；22 项内容与产物门禁退出码全 0，包括 454 页 / 8958 链接、sitemap 418 页、搜索索引 418/418、454 路由 bundle 预算、结构化数据 454 页 / 5656 实体和 KB 指针 `1ebbaef`。
- Playwright 42/42 通过；新增两条真实浏览器回归，验证有进度时显示主动分享入口、零进度时保持静默。
- Lighthouse CI 对 `/zh`、知识课程页和 `/chart` 的 6 次采样全部通过断言。

## 2026-09-12 — R13.21 增长文案暗黑模式门禁

把「不靠焦虑和套路拉新」从口头原则变成可回归的门禁，并把增长表面登记为唯一事实来源：

- 新增 `src/lib/growth-surfaces.json`：登记 6 个增长表面（PWA 安装提示、邀请 banner、召回提示、邮件订阅占位、分享卡、分享落地页 CTA），逐项声明组件路径、文案来源、是否必须可关闭、是否允许拦截正文、是否必须用户主动触发。
- 新增 `scripts/check-dark-pattern-copy.mjs`：扫描上述表面的中英双语文案，拒绝虚假紧迫、虚假稀缺、愧疚式挽留、伪造社会认同四类话术；同时用组件静态检查拒绝倒计时 `setInterval`、`autoFocus` 抢焦点、`defaultChecked` 默认勾选、以及 `blocking:false` 表面上的 `role="dialog"` / `aria-modal`。
- 关闭权是本门禁的一等公民：`requiresDismiss` 表面必须给出双语中性关闭文案，且组件里确实存在可点关闭控件；名字像增长组件却没登记、也没写豁免原因的新文件会让 CI 失败，防止绕过登记表。
- 新增 `scripts/check-dark-pattern-copy.test.mjs`：14 个用例覆盖黑名单命中、双语漂移、关闭文案缺失、阻断弹窗、倒计时 / 抢焦点 / 默认勾选、未登记组件，以及真实仓库回归。
- 新增 `docs/growth-copy-policy.md`：记录规则表、表面登记表、关闭与选择权约定、允许的表达与变更流程。
- 新门禁 `npm run check:dark-pattern-copy` 已接入 CI，在 `check:ai-copy` 之后执行。

Verification recorded:

- `npm run check:dark-pattern-copy`：通过，6 个登记表面、双语、可关闭 / 非阻断。
- 聚焦 Vitest：`scripts/check-dark-pattern-copy.test.mjs` 14 用例通过（含真实仓库 inventory 回归）。

## 2026-09-12 — R13.20 增长事件隐私审计

对 R13.19 的事件链路做了代码、数据、出口和文档四层审计，并用 CI 门禁锁定 console-only 边界：

- 新增 `docs/growth-event-privacy-audit.md`：记录数据流、字段分类、0 秒应用层保留、无跨境 / 无供应商结论、威胁模型、变更触发条件和验收证据。
- 中英文隐私政策补充本机开发者控制台披露：分享 / 邀请 / AI 入口可能打印少量白名单 debug 事件；事件不发送给站点，也不含原始邀请码、邮箱、章节标题、完整 URL 或自由文本。
- 新增 `scripts/growth-event-privacy.mjs` 与测试：静态拒绝 `fetch`、`sendBeacon`、`XMLHttpRequest`、localStorage / sessionStorage / IndexedDB、cookie、剪贴板出口；同时要求唯一 `console.info` 只接收 normalize 后的 `safe` 事件、事件目录完整、双语隐私披露存在。
- 新门禁 `npm run check:growth-event-privacy` 已接入 CI。任何远端分析 SDK、持久化、字段扩张或供应商接入都会失败并要求重新审计。

Verification recorded:

- `npm run check:growth-event-privacy`：通过，7 类事件、console-only、无网络 / 持久化 API。
- 聚焦 Vitest：审计器 5 用例 + 事件层 6 用例通过。
- 全量 Vitest：160 文件 / 1236 用例通过。
- `npm run lint` 0 error（59 条既有 warning）、`npm run typecheck` 通过。
- 干净生产构建 465 静态页；21 项内容与产物门禁退出码全 0，包括新增增长事件隐私门禁、454 页 / 8958 链接无死链、sitemap 418 个知识库页面、SEO 表面 430 条、搜索索引 418/418、结构化数据 454 页 / 5656 实体、全部 454 路由 bundle 预算和 KB 指针 `1ebbaef`。
- Playwright `npm run e2e` 40/40 通过。
## 2026-09-12 — R13.19 分享 / 邀请转化事件设计

实现本地、无网络、无持久化副作用的分享与邀请事件层，先把漏斗口径、隐私边界和测试契约固定下来：

- 新增判别联合 + 运行时白名单事件出口，覆盖分享下载（started/succeeded/failed）、预览打开、链接复制、落地页 CTA，以及邀请 banner 展示 / 关闭 / 清除，共 7 类事件。
- 日志出口只有 `console.info("[growth-event]", name, payload)`；不请求网络、不写 cookie/localStorage、不读取账号、邮箱或邀请 `ref`，额外字段在落日志前统一剥离。
- `CopyLinkButton` 增加可选结果回调，复制成功/失败均可观测，但埋点异常被隔离且不影响复制主流程。三张分享卡、分享落地页下载与邀请 banner 均接入真实触发路径。
- 新增 `docs/growth-events.md`，记录事件目录、枚举、分享/邀请漏斗口径和禁止字段；明确这不是分析 SDK，接入任何远端收集器前必须先完成 R13.20 隐私审计。

Verification recorded:

- 聚焦 Vitest：8 文件 / 39 用例通过。
- 全量 Vitest：159 文件 / 1231 用例通过；`npm run typecheck` 通过。
- `npm run lint` 0 error、59 条既有 warning。
- 干净生产构建 465 静态页；20 项内容与产物门禁退出码全 0，包括 454 页 / 8958 链接无死链、sitemap 418 个知识库页面、搜索索引 418/418、结构化数据 454 页 / 5656 实体、全部 454 路由 bundle 预算和 KB 指针 `1ebbaef`。
- Playwright `npm run e2e` 40/40 通过；Lighthouse CI 对 `/zh`、课程页、`/chart` 的 6 次运行全部通过断言。

## 2026-09-12 — R13.18 搜索引擎无结果页面 CTA

把搜索引擎带来的失效链接、拼写错误和搜索零结果从“死路”收敛成统一的恢复路径：

- 新增共享 `KnowledgeMiss` 组件，未知章节与未知课程保留原有的就近推荐，同时固定提供当前 locale 下的搜索页和学习路线两条主 CTA；章节推荐保持 `ul`、课程推荐保持 `ol`，原有测试标识兼容不变。
- 根级 404 的 Search / Home / Learning Path / Popular starters 全部接入中英文词典；该路由没有 locale 上下文，明确保持默认英文，不伪造语言判断。
- 搜索零结果从行内小链接升级为主按钮，进入 `/{locale}/path`；搜索诊断和建议仍按原逻辑展示。
- 新增单测覆盖中英文软 404、无推荐时 CTA 仍保留、搜索零结果 CTA；Playwright 覆盖根级 404、未知章节点击搜索、未知课程点击学习路线、搜索零结果点击路线，共 4 条。

Verification recorded:

- 聚焦 Vitest：2 文件 / 4 用例通过。全量：156 文件 / 1213 用例通过；`npm run lint` 0 error（59 条既有 warning）；`npm run typecheck` 通过。
- 干净生产构建 465 静态页；20 项内容与产物门禁退出码全 0，包括 454 页 / 8958 链接无死链、sitemap 418 个知识库页面、搜索索引 418/418、SEO 表面 430 条 sitemap URL、结构化数据 454 页 / 5656 实体、全部 454 路由 bundle 预算和 KB 指针 `1ebbaef`。
- Playwright 40/40 通过；Lighthouse CI 对 `/zh`、课程页、`/chart` 的 6 次运行全部通过断言。

## 2026-09-12 — R13.17 sitemap / robots 发布复核

把 sitemap、robots.txt、页面 robots meta 收敛到同一份声明，并修掉复核中发现的四处真实矛盾：

- 新增 `src/lib/seo-surface.json` 作为可索引表面唯一事实来源：`indexable`（6 条静态入口，带 changefreq/priority）、`noindex`（12 条静态路径）、`robotsDisallow`。应用侧经 `src/lib/seo-surface.ts` 读取，脚本侧经 `scripts/seo-surface-lib.mjs` 读取同一份 JSON。
- **修软 404 可被收录**：未知章节 slug / 未知课程 slug 会渲染 404 文案但状态码是 200，此前既没有 canonical 也没有 noindex，会被搜索引擎当真实页面收录。新增 `buildSoftNotFoundMetadata()` 输出 `noindex, follow` 且不产出 canonical，两个知识库路由都已接入。
- **修 `/stats` 未声明**：学习仪表盘全部数据来自本地存储，爬虫只能看到空壳，此前既在 sitemap 外又没有 noindex。现归入 `noindex`。
- **修 robots 与 noindex 打架**：`/zh/ai`、`/en/ai` 原本既被 `Disallow: /*/ai` 挡住又声明 noindex，爬虫读不到 noindex 反而可能以「无描述」形式进索引。Disallow 收敛为 `/api/`、`/*/auth`、`/offline.html` 三类（auth 是唯一按设计挡爬虫的路径，因为回调带一次性凭据）。
- **修 sitemap lastmod 失真**：此前所有页面都标构建时间，等于告诉搜索引擎全站天天在变。新增 `src/lib/kb-freshness.ts`，知识库页面的 lastmod 取子模块 HEAD 提交时间（内容不动就不变），拿不到 git 信息时退回构建时间；非知识库入口页不再声明 lastmod。
- 新增构建产物门禁 `npm run check:seo-surface`：robots Sitemap 指令与 Disallow 清单、sitemap 绝对 URL/去重/lastmod 合法且不在未来、sitemap 与 Disallow 不互相打架、声明可索引的页面在 sitemap 内且无 noindex 且 canonical 指向自身、声明 noindex 的页面不在 sitemap 且确实带 noindex、知识库页面全部可索引且在 sitemap、产物里不允许出现未声明页面（新增页面必须显式声明收录策略）。
- 新增 `docs/seo-surface.md`（发布复核结论 + 收录策略 + 新增页面 checklist），并把门禁接入 CI、`docs/ops.md` 与两份 README。

Verification recorded:

- 聚焦单测：`scripts/seo-surface-lib.test.mjs` 29 用例 + `src/lib/seo-surface.test.ts` / `src/lib/kb-freshness.test.ts` / `src/lib/metadata.test.ts` 通过。
- 全量：154 文件 / 1209 用例通过；`npm run lint` 0 error（59 条既有 warning）；`npm run typecheck` 通过。
- 干净生产构建 465 静态页；`npm run check:seo-surface` 通过（sitemap 430 条 · 页面 454 个 · 知识库 418 个 · 未声明 0 个），知识库 lastmod = 子模块提交 `1ebbaef` 时间 `2026-09-11T16:02:43.000Z`。
- 其余产物与内容门禁全绿：check:sitemap 418 双向一致、结构化数据 454 页/5656 实体、bundle 预算 454 路由 + AI chunk 隔离、死链 0（454 页/8958 链接）、搜索索引 418/418、nav chain、relative links、KB 指针、翻译历史、parity、quiz、frontmatter、image alt、glossary、description 去重、slug 冲突、ai-copy、constitution。
- Playwright 36/36 通过（新增 5 条 SEO 表面用例）；Lighthouse CI 对 `/zh`、课程页、`/chart` 通过。

## 2026-09-12 — R13.16 SEO structured-data regression

Consolidated every JSON-LD emitter into one auditable module and added a build-time gate that verifies the schema on all 454 generated pages:

- Rewrote `src/lib/jsonld.ts` into typed builders (`siteGraph`, `breadcrumbList`, `course`, `quiz`, `article`, `webPage`, `faqPage`) with stable `@id`s, absolute URLs, locale-correct `inLanguage`, and shared Organization/WebSite references. Course lessons are emitted as `LearningResource` parts, `isAccessibleForFree` is explicit, and the site graph carries a `SearchAction` matching the real `/{locale}/search?q=` route.
- Wired the graph once in the locale layout so nested pages reference the same Organization/WebSite by `@id`; chapter pages emit Course + Quiz, lesson pages emit Article, FAQ emits FAQPage built strictly from the on-page Q/A, and share landings emit WebPage.
- Added `scripts/structured-data-lib.mjs` (pure validators + route-role expectations), `scripts/structured-data-lib.test.mjs`, and `scripts/check-structured-data.mjs`, which scans every static locale/share HTML route for valid JSON-LD, absolute link fields, required entity types, page identity, breadcrumb ordering, and non-empty FAQ pairs.
- Added 24 focused Vitest cases for the builders and validators, and documented the gate in `docs/ops.md` and both READMEs.

Verification recorded:

- Focused Vitest: 2 files / 24 tests passed. Full suite: 151 files / 1167 tests passed; `npm run lint` 0 errors (59 pre-existing warnings); `npm run typecheck` passed.
- Clean production build: 465 static pages.
- `npm run check:structured-data`: 454 pages / 5656 entities, all roles satisfied (home 2 · chapter 54 · lesson 364 · faq 2 · other 32).
- Build-derived and content gates passed: bundle budgets (454 routes + AI chunk isolation), sitemap 418 pages, search index 418/418, 454 pages / 8958 links with no dead links, KB pointer `1ebbaef`, translation history, parity budgets, quiz coverage/mounts, frontmatter, image alt, glossary, description dedupe, slug conflicts, AI copy, nav chain, relative links, and constitution audit.
- Playwright: 31/31 passed. Lighthouse CI passed for `/zh`, a knowledge lesson, and `/chart`.

## 2026-09-12 — R13.15 route-level first-load budgets

Replaced the eight hardcoded bundle samples with an auditable, route-group budget contract:

- Added `scripts/bundle-budgets.json` with 15 route groups covering home, path, chapter index, lesson, search, review, bookmarks, stats, AI, chart, replay, privacy, glossary, static-info, and auth. Every static `/zh` or `/en` HTML route must match exactly one group; unknown or overlapping matches fail the gate.
- Added `scripts/bundle-budget.mjs` with manifest validation, route matching, Next static asset extraction, gzip measurement, and over-budget helpers.
- Rewrote `scripts/check-bundle.mjs` to measure external JS gzip + external CSS gzip + HTML gzip + total for all 454 locale routes, not a sample. A failing route now prints each failed metric and the ten largest referenced assets.
- Expanded AI chunk isolation from four content samples to all 452 non-AI routes.
- Added 23 focused Vitest cases for manifest shape, representative routing, unknown-route failure, malformed metadata, deduplicated asset extraction, measurement arithmetic, and metric failure detection.
- Documented the metrics, groups, baselines, and gate operation in `docs/perf-notes.md`, `docs/ops.md`, and both READMEs.

Verification recorded:

- Focused bundle-budget tests: 1 file / 23 tests passed.
- Full suite: 150 files / 1147 tests passed; `npm run lint` 0 errors (59 pre-existing warnings); `npm run typecheck` passed.
- Clean production build: 465 static pages.
- `npm run check:bundle`: 454/454 locale routes passed; largest totals by group were home 339.2/360KB, lesson 386.8/400KB, stats 351.8/370KB, chart 361.0/390KB, replay 368.4/400KB; all 452 non-AI routes passed AI chunk isolation.
- Build-derived gates passed: sitemap 418 pages, search index 418/418, 454 pages / 8958 links with no dead links, navigation and relative-link checks, KB pointer `1ebbaef`, translation history, parity budgets, quiz coverage/mounts, frontmatter, image alt, glossary, description dedupe, slug conflicts, AI copy, and constitution audit.
- Playwright: 31/31 passed. Lighthouse CI passed for `/zh`, a knowledge lesson, and `/chart`.


## 2026-09-12 — R13.14 PWA install prompt and dismissal state

Implemented a browser-native install prompt with a persistent, non-coercive dismissal contract:

- Added `install-prompt.ts` as the shared state boundary for the `beforeinstallprompt` event, the `tb-install-prompt-dismissed` key, storage failure fallback, `display-mode: standalone` / iOS `navigator.standalone` detection, and the single show/hide predicate.
- Added a client-only install notice that appears only after Chromium provides `beforeinstallprompt`, suppresses the browser mini-infobar only while offering its own neutral action, calls the native `prompt()` from the user click, and persists the result of either native choice.
- The notice has a text-only “Not now / 暂不” path, uses no countdown or forced modal, makes no offline or profit claims, and sends no analytics. Unsupported browsers, dismissed users, and standalone launches render nothing.
- Added zh/en copy and wired the notice into the locale layout without changing the manifest, service-worker scope, or offline caching boundary.

Verification recorded:

- Focused Vitest: 2 files / 13 tests passed, covering persistence, storage failures, standalone detection, malformed events, explicit dismissal, native prompt invocation, and listener cleanup.
- Full suite: 149 files / 1124 tests passed; `npm run lint` 0 errors (59 pre-existing warnings); `npm run typecheck` passed.
- Clean production build: passed with 465 static pages after removing E2E fallback pollution from `.next`.
- Playwright: 31/31 passed, including synthetic `beforeinstallprompt`, native prompt invocation, reload-persistent dismissal, standalone suppression, and unsupported-browser silence.
- Content/release gates passed: KB pointer `1ebbaef`, 418 sitemap pages, 418/418 search-index entries, 454 pages / 8958 links with no dead links, quiz coverage, relative links, image alt, frontmatter, glossary, constitution audit, bundle budgets, and dry-run chapter contract.
- Lighthouse CI passed performance/accessibility/best-practices/SEO assertions across `/zh`, a knowledge page, and `/chart`.

## 2026-09-12 — R13.13 PWA offline fallback review

Implemented a deliberately minimal PWA offline fallback and audited the install/manifest surface:

- Added a bilingual static `public/offline.html` with no external assets, a retry action, and automatic reload when connectivity returns; it is `noindex` and states that local learning data remains while online-only features pause.
- Added `public/sw.js`: install precaches only `/offline.html`; navigation requests fall back to that shell when the network fails; non-navigation requests, APIs, search index, and knowledge assets are never intercepted or cached. The worker clears old caches, claims clients, and has a last-resort 503 response.
- Added production-only registration after `window load`; unsupported or failed registration degrades silently without affecting the site.
- Hardened the web manifest with stable `id`, explicit `/` scope, Chinese locale/direction, education/finance categories, and corrected `start_url` to `/zh`. Added a `no-cache` policy for `/sw.js`, revalidation for `/offline.html`, and excluded the shell from robots.
- Added VM-driven behavior tests for install/activate/fetch boundaries and the offline-page hash guard, manifest/robots/cache tests, registrar tests, and browser E2E for the fallback plus the no-content-cache boundary. Set Playwright to one worker because Chromium's offline emulation can stop an idle Service Worker and race with other workers sharing the origin.

Verification recorded:

- Focused Vitest: 4 files / 26 tests passed.
- Full suite: 147 files / 1111 tests passed; `npm run lint` 0 errors (59 pre-existing warnings); typecheck passed.
- Production build passed with 465 static pages; bundle budgets passed (largest checked route 334KB/360KB).
- Playwright full suite: 27/27 passed with the offline suite repeated 3× serial (9/9), including real offline navigation, retry recovery, and cache-boundary assertions.
- Content gates passed: sitemap 418 pages, search index 418/418, 455 pages / 8975 links with no dead links, KB pointer `1ebbaef`, quiz coverage, relative links, image alt, frontmatter, glossary, and constitution audits.
- Lighthouse CI passed performance/accessibility/best-practices/SEO assertions across `/zh`, a knowledge page, and `/chart`.

## 2026-09-12 — R13.12 slow-network and offline loading experience

Implemented a shared, SSR-safe network-quality contract for data-heavy mobile flows:

- Added `network-quality.ts`: normalized `online | slow | offline` state from `navigator.onLine`, Network Information `effectiveType`, and `saveData`; slow-mode and offline polling policies are pure and unit tested. Unknown/unsupported browser metadata fails open to online.
- Added `use-network-quality.ts` using `useSyncExternalStore`, so chart and ticker UI react to `online`/`offline` and connection-change events without polling.
- `KlineChart` now uses 180 candles and the compact renderer on slow/offline links, suppresses the full-view opt-in and WebSocket live stream, aborts requests after 12s (20s on slow links), and shows explicit slow/offline/timeout states. Offline mode sends no Binance request and retries automatically when connectivity returns. The retry action now uses a real state nonce instead of setting the same interval value (the old no-op path is fixed).
- `MarketTicker` now shows loading/error states instead of disappearing, polls at 5s online and 60s on slow links, pauses entirely offline, preserves the last successful values with a stale label, and aborts in-flight work on cleanup.
- `fetchKlines` accepts an `AbortSignal`, and zh/en chart copy documents compact, offline, and timeout behavior.

Verification recorded:

- Focused Vitest: network-quality + chart-density 2 files / 8 tests passed.
- Full suite: `npm test` passed with 144 test files and 1088 tests.
- `npm run lint`: 0 errors (59 existing warnings); `npm run typecheck`: passed.
- Production build: passed with 465 static pages.
- `npm run e2e`: 24/24 passed, including real-browser 2G emulation proving one `limit=180` request, no full-view toggle/live stream, market-ticker 60s mode, and offline mode proving zero kline requests with auto-retry copy.

Next queue: R13.13 offline PWA review, R13.14 install prompt/dismissal state, then R13.15–R13.18 performance/SEO.

## 2026-09-12 — R13.11 mobile chart degradation + Binance CSP repair

Shipped the mobile chart density contract and fixed a production-blocking CSP gap found by the browser regression:

- Added `chart-density.ts`: 640px breakpoint, compact = 180 candles, full = 500 candles, with pure selection/limit helpers and boundary tests.
- `KlineChart` now uses `useSyncExternalStore` for viewport density. The server snapshot defers loading until hydration, avoiding a duplicate 500-candle request before switching to the 180-candle mobile view.
- Compact mode renders at 300px with 10px axis text, hidden grid lines, and a narrower price scale while retaining candlesticks, volume, live updates, symbol/interval controls, and all chart functionality. Narrow-screen users can explicitly switch to the full 500-candle view.
- `LazyChartEmbed` skeleton height follows the compact/full split; zh/en copy explains both modes.
- Found and fixed the real reason `/chart` showed "行情加载失败": the global CSP `connect-src` blocked `https://api.binance.com` and `wss://stream.binance.com:9443` before requests left the browser. The policy now allows exactly those market origins, with a config regression test.
- Stabilized the AiChat streaming unit test by stubbing only the `next/dynamic` chunk boundary; lazy loading remains covered by the production build and E2E, while the unit test deterministically observes stream state.
- Added a Playwright interception assertion proving the initial mobile request is `limit=180` and the explicit toggle requests `limit=500`.

Verification recorded:

- Focused Vitest: chart density 3 tests and next config 3 tests passed.
- `npm run lint`: 0 errors (59 existing warnings); `npm run typecheck`: passed.
- Full suite: `npm test` passed with 143 test files and 1082 tests.
- Production build: passed with 465 static pages.
- `npm run e2e`: 22/22 passed, including the real-browser compact/full request-limit assertion and the existing 320px/touch/focus/block-scroll checks.

Next queue: R13.12 slow-network loading experience, R13.13 offline PWA review, R13.14 install prompt/dismissal state, then R13.15–R13.18 performance/SEO.


## 2026-09-12 — R13.7–R13.10 mobile regression, touch targets, focus, and block scrolling

Completed the mobile quality batch with real browser coverage and a shared dialog focus contract:

- Added `use-modal-focus.ts`: focus moves to the first focusable control when a modal opens (or to the dialog when empty), Tab/Shift+Tab stay trapped, Escape closes, and focus returns to the trigger after close.
- Wired the hook into mobile navigation, image lightbox, and mobile table-of-contents dialogs. The dialogs now expose valid `role="dialog"`, `aria-modal`, labels, `aria-expanded`/`aria-controls`, and a programmatic focus target; the lightbox's duplicate Escape listener was removed.
- Hardened the mobile Playwright suite: onboarding waits for hydration before interacting; quiz navigation accounts for the two-step expand/start flow; touch targets use semantic button locators; R13.10 now requires visible real table/code blocks, verifies computed `overflow-x: auto`, proves at least one block actually overflows internally, and still asserts the page stays within 320px.
- Regenerated the tracked risk-warning coverage after `kline-buty@1ebbaef`: 364/364 lessons now pass, zh/en each 182.

Verification recorded:

- Targeted Vitest: 4 files / 14 tests passed.
- `npm run lint`: 0 errors (59 existing warnings); `npm run typecheck`: passed.
- Full suite: `npm test` passed with 142 test files and 1079 tests.
- Production build: passed with 465 static pages.
- `npm run e2e`: 21/21 passed, including the 320px R13.7/R13.10 and R13.8/R13.9 browser checks.
- Build-derived gates: sitemap 418 pages, search index 418/418, bundle budgets, KB pointer `1ebbaef`, translation parity 27/27 chapters and 182/182 en lessons.

Next queue: R13.11 mobile chart degradation, R13.12 slow-network UX, R13.13/R13.14 PWA install/offline review, then the R13.15–R13.18 performance and SEO batch.

## 2026-09-12 — Knowledge base sync to kline-buty@1ebbaef (+18 docs) and CI repair batch

Follow-up after the first push of the R13 batch: the upstream knowledge submodule had its history repointed (`main` moved to `e24ba2d`), so the PR merge ref failed the R10.18 pointer gate (recorded aa0297d vs snapshot). Synced to the current upstream tip `1ebbaef` via the sanctioned `npm run kb:update` flow: +18 new course files ( sentiment indicators, DCA methodology, adjusted-price/dividends, advanced indicators, multi-timeframe, orderbook depth, replay training, alert discipline, paper-to-live, event-driven, on-chain data trading, swing-trend practice, risk management, compounding returns — zh+en mirrors), sitemap now 418 pages.

Also fixed in this batch: `react-hooks/error-boundaries` CI lint failure in the share OG route (JSX must not be constructed inside try/catch; data-only try/catch kept).

Verification recorded:

- Pointer gate `node scripts/check-kb-pointer.mjs`: recorded = workspace = snapshot = 1ebbaef.
- Knowledge gates green: slug-conflicts / nav-chain / frontmatter / description-dupes / image-alt / glossary / quiz-coverage / quiz-mounts / relative-links / ai-copy / translation-status (182/182 en parity).
- Full suite: `npm test` passed with 141 test files and 1073 tests.
- Build + build-derived gates green: sitemap (418), links, bundle budgets, search-index parity.

Next queue:

1. Confirm PR #1 CI goes green end-to-end.
2. Continue R13: R13.9 mobile keyboard/focus, R13.11 chart degradation, R13.12 slow-network UX, R13.13/R13.14 PWA, R13.15–R13.18 perf/SEO batch.

## 2026-09-11 — R13.5 Share OG image with error degradation + R13.6 Download failure feedback

## 2026-09-11 — R13.5 Share OG image with error degradation + R13.6 Download failure feedback

- Added `src/app/share/[kind]/[path]/opengraph-image.tsx`: a 1200×630 social card per share kind (quiz/replay/streak) rendered from whitelisted decoded payloads via `next/og` — every failure path (unknown kind, garbage/base64-broken path, zero-total payloads, any render exception) degrades to a branded fallback card instead of a 500 for crawlers. Tests cover the degrade matrix and the happy path (200 + image/png).
- All three share card components now surface download failures: `draw`/`toBlob`/download errors set `downloadFailed` and render an `role="alert"` message (in-site labels `downloadFailed` added to quiz, replay-trainer, stats-streak dicts in both locales; fabricate-success is never allowed). Preview path recovered state clears the message.
- Quiz test suites gained a failure-path spec (toBlob → null renders the alert).

Verification recorded:

- Targeted Vitest suites: share OG image (3 tests), all share component tests incl. the new failure spec passed.
- Full suite: `npm test` passed with 141 test files and 1073 tests.
- Lint gate: `npm run lint -- --quiet` passed; typecheck gate passed; `npm run check:ai-copy` passed.

Next queue:

1. GitHub auth may need reconnecting again (push failed once more); keep batching locally otherwise.
2. Continue R13: R13.7 320px core-path regression expansion, R13.8 touch-target audit, R13.9 mobile keyboard/focus, R13.10 table/code horizontal scroll, R13.11 chart degradation, R13.12 slow-network UX, R13.13 PWA offline review, R13.14 install prompt close state.

## 2026-09-11 — R13.3 Share param whitelist + R13.4 Share landing privacy

## 2026-09-11 — R13.3 Share param whitelist + R13.4 Share landing privacy

Hardened the share pipeline against self-attested URL payloads:

- `share-decode.ts` decoders now return objects containing ONLY whitelisted keys (previously any extra JSON keys passed the type guards and flowed into the SSR landing page + OG metadata). Text fields are control-character stripped and length-capped (chapterTitle 60, symbol 16, interval 8), numbers are clamped to display-safe ranges, and locale stays a two-value whitelist.
- R13.4 audit of the landing page (`src/app/share/[kind]/[path]/page.tsx`): renders only self-reported game stats — no dates, no device identifiers, no account fields — with React-escaped text nodes; the whitelist change turns that invariant into enforced code (future personal fields cannot leak through share URLs).
- Tests: foreign keys (`email`, `deviceId`, `utm_source`) provably stripped; control bytes removed; counters clamped; valid round trips preserved.
- Incident during implementation: a control-regex literal was saved as raw bytes making the file binary; repaired to escaped `\u0000` form and verified via typecheck + tests.

Verification recorded:

- Targeted Vitest suite: `src/lib/share-decode.test.ts` (26 tests) passed.
- Full suite: `npm test` passed with 140 test files and 1069 tests.
- Lint gate: `npm run lint -- --quiet` passed; typecheck gate passed.

Next queue:

1. Watch PR #1 CI after this push.
2. Continue R13: R13.5 OG image error degradation, R13.6 share download failure feedback, then R13.7–R13.14 mobile batch.

## 2026-09-11 — R13.1 Unified share-card template + R13.2 Shared fonts and accessible alt text

## 2026-09-11 — R13.1 Unified share-card template + R13.2 Shared fonts and accessible alt text

Started the R13 share/mobile/growth suite with the two card-system foundations:

- `src/lib/share-card.ts` gains the template skeleton: exported `CARD_LAYOUT` layout constants (heading/meta/hero/metric-line/footer anchors) plus `drawCardHeading`, `drawHeroValue`, and `drawCardMetricLine`. All three card types (quiz, replay, streak) were refactored onto the shared helpers so future cards cannot fork random coordinates; `drawBrandFooter` reads padding from the layout constants. New tests assert anchor ordering and that the helpers paint at the unified coordinates.
- New `cardFontFor(locale)` helper replaced four independently hardcoded font stacks (three share components + share-card-preview), adding Noto Sans CJK fallback for Linux and explicit Segoe UI for Windows.
- Accessibility upgrade: preview `<img>` alt now narrates the card contents (e.g. "回放卡预览：回放战绩卡，BTCUSDT · 1h，准确率 70%…") instead of a bare "preview" placeholder, in both locales; existing tests were upgraded to the new contract rather than relaxed.

Verification recorded:

- Targeted Vitest suites: `share-card.test.ts` (51 tests incl. new R13.1 specs) and all three share component suites passed.
- Full suite: `npm test` passed with 140 test files and 1065 tests.
- Lint gate: `npm run lint -- --quiet` passed; typecheck gate passed.

Next queue:

1. Watch PR #1 CI after this push.
2. Continue R13: R13.3 share link param whitelist, R13.4 share landing privacy redaction, R13.5 OG image error degradation, R13.6 download failure feedback, then the mobile/perf/SEO batch.

## 2026-09-11 — R12.25 Retention metric definitions & audit doc — R12 complete

## 2026-09-11 — R12.25 Retention metric definitions & audit doc — R12 complete

Closed R12 with `docs/retention-metrics.md`, an honest retention-metrics constitution:

- §0 records the binding constraint: no server-side cohort analytics exists by design (privacy constitution), so every metric is defined as locally computable or computable from the user's own export.
- §1 defines the metrics with exact data sources: active learning day (≥60s in the study-time ledger), 7-day active days/minutes, weekly goal attainment, streak semantics (truthful `tb-streak` increment/break behavior, longest as monotonic max counter), revisit proxy, due-review visibility, and the R12.23 cross-surface consistency invariant — plus explicit "NOT retention metrics" exclusions.
- §2 audits trim policies (90-day study ledger, 100-round replay history) and bans labeling trimmed numbers as "all-time" — matching the R12.14 privacy-page wording.
- §3 ties to the R12.24 no-login parity contract; §4 leaves an audit checklist including a gate that any future server-side retention telemetry must be reviewed here first.

Verification recorded:

- Doc claims were checked against code (`streak.ts`, `study-time.ts`, `replay-store.ts`, `wrongbook.ts`); the longest-streak wording was corrected to match the monotonic `tb-streak.longest` counter.
- Roadmap: all 25 R12 items are now complete.

Next queue:

1. Watch PR #1 CI after this push; consider squashing/merging once the whole milestone is verified on production CI.
2. Next milestone suite per roadmap: R13 feedback loop / P2 quality (chapter-level quizzes expansion, share quality, etc.) or the governance backlog.

## 2026-09-11 — R12.13 Privacy entry review + R12.14 Data retention notes

## 2026-09-11 — R12.13 Privacy entry review + R12.14 Data retention notes

R12.13 review found a real gap: the privacy page (`/privacy`, R9.x) was an orphan — no link existed anywhere in the app chrome:

- Added a "隐私政策 / Privacy Policy" link to the global footer navigation (always-visible entry, next to Stats), with `footer.privacy` i18n keys for both locales.
- Verified page completeness: localStorage statement, Supabase sync statement, cookie scope, third-party list, and the R9.9 `PrivacyDataExport` block are all present.

R12.14 (data retention & cleanup notes) is now documented truthfully in the privacy page itself, sourced from actual code behavior:

- Local data expires only when the user clears site data; built-in trims: study-time ledger keeps the last 90 days (`study-time.ts`), replay history keeps the latest 100 rounds (`replay-store.ts` / `sync-layer.ts`).
- Cloud data persists while the account exists; offline write queue retries until synced; deletion path documented (account menu → Delete account removes cloud rows + local data, backed by `account-delete.ts` + `auth-header`).
- No misleading retention promises were added (no invented "we delete after N days" claims).

Verification recorded:

- Targeted Vitest suites: `src/lib/i18n.test.ts`, `src/lib/i18n-stats.test.ts`, `src/components/privacy-data-export.test.tsx` passed (18 tests).
- Typecheck gate: `npm run typecheck` passed; lint gate passed; `npm run check:ai-copy` passed (en dict has no zh leftovers).

Next queue:

1. Watch PR #1 CI after this push.
2. Finish R12.25 retention metric definitions & audit docs — then R12 is fully closed; move to the R13 share/mobile/growth-quality suite or the P2 governance backlog per roadmap.

## 2026-09-11 — R12.15–R12.17 Local review reminders

## 2026-09-11 — R12.15–R12.17 Local review reminders

Implemented the reminder triad as one coherent in-site system (no push, no service worker, no permissions — consistent with the no-tracking constitution):

- Added `src/lib/review-reminder.ts`: settings (cadence off/daily/weekly + DND start/end hour) with repair-on-read clamping; `inDndWindow` supporting cross-midnight windows (22→8) and start==end as disabled; `reminderPeriodKey` (local date / ISO week via Thursday rule) so each period shows at most one banner; `shouldShowReminder` is pure with an injectable `now` — unit tests never touch real time.
- Stats dashboard: dismissible reminder banner appears only with due reviews, outside the DND window, once per period (CTA links to `/{locale}/review`; "Later" marks the period shown). A settings section edits cadence and DND window with bilingual labels and persists immediately.
- Snapshot-stability lesson applied: `useSyncExternalStore` snapshots are raw strings and the parsed settings object is memoized — object-valued snapshots cause infinite re-render loops.

Verification recorded:

- Targeted Vitest suites: `src/lib/review-reminder.test.ts` (9 tests incl. cross-midnight, ISO-week boundaries, dedup), `src/components/stats-client.test.tsx` (3 reminder UI specs) passed.
- Full suite: `npm test` passed with 140 test files and 1062 tests.
- Lint gate: `npm run lint -- --quiet` passed; typecheck gate passed; `npm run check:ai-copy` passed.
- Prior push CI on PR #1 passed (ci + Vercel).

Next queue:

1. Watch PR #1 CI after this push.
2. Remaining R12: R12.13 privacy settings entry review, R12.14 retention docs, R12.25 retention metric audit docs — then R14 governance backlog (R14.1–R14.10).

## 2026-09-11 — R12.18 Completion celebration audit (no profit hints)

## 2026-09-11 — R12.18 Completion celebration audit (no profit hints)

Audited `ChapterCompleteCelebration` and found a real constitution violation, now fixed:

- The emoji sequence contained 📈 (bull-market gains) and 💎 ("diamond hands" holding meme), which violate the "never imply returns" rule. The list is now exported as `CELEBRATION_EMOJIS` and restricted to learning-neutral glyphs (🎉 📖 ✨ ✅ 📚 🎓); a regression test asserts the forbidden set ({📈💎🚀💰🤑🐂🌕}) stays excluded.
- Copy was hardcoded zh "篇章完成！" — now localized via `locale` prop (zh/en) and wired from the knowledge chapter page; the overlay gained `role="status"` for screen readers.
- Tests lock: celebration appears only for genuinely complete chapters, copy never mentions profit/win-rate/returns, and the overlay auto-dismisses.

Verification recorded:

- Targeted Vitest suite: `npx vitest run src/components/chapter-complete-celebration.test.tsx` passed (3 tests).
- Typecheck gate: `npm run typecheck` passed.

Next queue:

1. Watch PR #1 CI after this push.
2. Continue the remaining R12 suite: R12.13 privacy settings entry review, R12.14 retention docs, R12.15–R12.17 reminders, R12.25 retention metric audit docs.

## 2026-09-11 — R12.24 Guest-mode stats degradation contract

## 2026-09-11 — R12.24 Guest-mode stats degradation contract

Implemented R12.24 as a verified no-login parity contract (the stats page was already local-first; this locks it with regression coverage):

- Added `src/components/stats-client-guest.test.tsx`: three specs proving that with no AuthProvider and no Supabase env, the dashboard renders every section (overview, all four trends, weekly report + summary, next suggestion), the source badge reads "本机数据", range switching persists, a guest export produces the complete versioned payload (correct counts from seeded local ledgers), and no login wall / degraded placeholder text ever appears.

Verification recorded:

- Targeted Vitest suite: `npx vitest run src/components/stats-client-guest.test.tsx` passed (3 tests).

Next queue:

1. Watch PR #1 CI after this push.
2. Continue the remaining R12 suite: R12.13 privacy settings entry review, R12.14 retention docs, R12.15–R12.17 reminders, R12.18 course-completion celebration audit, R12.25 retention metric audit docs.

## 2026-09-11 — R12.19 Editable weekly learning goal + R12.20 Local weekly summary

## 2026-09-11 — R12.19 Editable weekly learning goal + R12.20 Local weekly summary

Implemented R12.19 and R12.20 as one coherent goal-and-feedback pair (daily goal was already tier-editable with cloud double-write; the real gap was the weekly axis):

- Added `src/lib/weekly-summary.ts`: `WEEKLY_GOAL_TIERS` (45/90/150 min, default 90) with `getWeeklyGoalMin`/`setWeeklyGoalMin` (persists `tb-weekly-goal-min`, dispatches `tb-weekly-goal`, fire-and-forget cloud upsert), and pure `buildWeeklySummary()` over the study-time ledger + progress/quiz/review ledgers + replay history — last-7-calendar-day window compared by local date strings, corruption-tolerant, no fabricated dates.
- Cloud sync: migration `supabase/migrations/0007_weekly_goal_min.sql` adds `user_settings.weekly_goal_min`; hydrate merges local-intent-first like the daily goal; `syncWeeklyGoalUpsert` + queue executor `goal` kind now upserts whichever goal field is present; R12.9 conflict detection extended with the `weekly-goal` kind.
- Stats dashboard gains a "本周学习摘要 / Weekly learning summary" card showing the generated line (minutes, active days, completions, quizzes, reviews, replay rounds) plus achieved/remaining state and the editable goal tier row.
- Tests: pure builder (window boundaries with endpoint-inclusive semantics, corruption, achieved-only-on-real-minutes), storage tier clamping, cloud merge + conflict wiring, and three UI specs (summary render, tier edit persistence, honest achieved state).

Verification recorded:

- Targeted Vitest suites: `src/lib/weekly-summary.test.ts`, `src/lib/sync-conflicts.test.ts`, `src/lib/sync-layer-hydrate.test.ts`, `src/components/stats-client.test.tsx` all passed.
- Full suite: `npm test` passed with 137 test files and 1044 tests.
- Lint gate: `npm run lint -- --quiet` passed; typecheck gate passed; `npm run check:ai-copy` passed.

Next queue:

1. Watch PR #1 CI after this push.
2. Continue the remaining R12 suite: R12.13 privacy settings entry review, R12.14 retention docs, R12.15–R12.17 reminders, R12.18 course-completion celebration audit, R12.24 no-login degradation, R12.25 retention metric audit docs.

## 2026-09-11 — R12.12 Versioned stats data export

## 2026-09-11 — R12.12 Versioned stats data export

Implemented R12.12 as a local, versioned JSON export on the stats dashboard:

- Added `src/lib/stats-export.ts`: `buildStatsExport()` (pure, injectable clock) emits `{ format: "trade-buty-stats-export", version: 1, exportedAt, locale, data }` with stable field names for courses/quizzes/replay/review/engagement/goals; all numeric inputs clamped so corrupt local state never produces NaN/negative garbage; `serializeStatsExport()` + `downloadStatsExport()` (blob + temp anchor, dated filename).
- Export button on the stats overview grid builds the payload from the live models — zero network calls (privacy-constitution compliant), labels bilingual.
- Tests: field-shape/version assertions, corrupt-input sanitization, null-percentage and locale coercion, JSON round-trip, and the download helper wiring.

Verification recorded:

- Targeted Vitest suite: `npx vitest run src/lib/stats-export.test.ts src/components/stats-client.test.tsx` passed (24 tests).
- Full suite: `npm test` passed with 137 test files and 1034 tests.
- Lint gate: `npm run lint -- --quiet` passed; typecheck gate passed; `npm run check:ai-copy` passed.

Next queue:

1. Watch PR #1 CI after this push.
2. Continue the remaining R12 suite: R12.13 privacy settings entry review, R12.14 retention docs, R12.15–R12.17 reminders, R12.18 completion celebration audit, R12.19 editable goals, R12.20 weekly summaries, R12.24 no-login degradation, R12.25 retention metric audit docs.

## 2026-09-11 — R12.11 Per-section empty-state CTAs on stats

## 2026-09-11 — R12.11 Per-section empty-state CTAs on stats

Implemented R12.11 as actionable empty states inside each stats trend section (the page-level new-user CTA from R4.5 only covers the all-zero case):

- Quiz trend: when no quiz was ever finished, links to the first chapter quiz (`/{locale}/knowledge/{firstChapter}`).
- Review efficiency: when the mistake log is empty and no review has ever been recorded, explains that quiz attempts feed the wrongbook and links to the first chapter quiz.
- Replay practice time: when no replay was ever done, links to `/{locale}/replay`.
- CTAs disappear as soon as real data exists (tests assert the toggle on finished quizzes / wrongbook entries).
- zh/en labels added (`ctaQuiz`/`ctaReview`/`ctaReplay`).

Verification recorded:

- Targeted Vitest suite: `npx vitest run src/components/stats-client.test.tsx` passed (19 tests).
- Full suite: `npm test` passed with 136 test files and 1025 tests.
- Lint gate: `npm run lint -- --quiet` passed; typecheck gate passed; `npm run check:ai-copy` passed.
- PR #1 CI (vitest + mutation + deps + bundle + mobile) passed on `d9ace57`.

Next queue:

1. PR #1 remains open accumulating the R12 suite; keep batching and watch CI per push.
2. Continue the remaining R12 suite: R12.12 export versioning, R12.13 privacy settings entry review, R12.14 retention docs, R12.15–R12.17 reminders, R12.18 completion celebration audit, R12.19 editable goals, R12.20 weekly summaries, R12.24 no-login degradation, R12.25 retention metric audit docs.

## 2026-09-11 — R12.9 Multi-device sync conflict notice

## 2026-09-11 — R12.9 Multi-device sync conflict notice

Implemented R12.9 as a truthful, auto-resolving conflict surface for multi-device sync:

- Added `src/lib/sync-conflicts.ts`: pure `detectMergeConflicts()` (daily-goal divergence when both sides explicitly set values, same-key wrongbook SRS/picked divergence with resolution direction), plus `tb-sync-conflicts` record/dismiss storage with per-timestamp dismissal so a genuinely new conflict set re-notifies.
- `hydrateFromCloud()` now computes conflicts from the pre-merge local snapshot vs. cloud rows and records them after every merge (empty conflicts clear prior records); failure paths never leave stale notices.
- The stats dashboard shows a dismissible "多设备同步提示 / Multi-device sync note" banner describing the automatic merge rules (local goal wins, newer review plan wins) instead of silently overwriting.
- Tests cover detection edge cases (one-side-unset is not a conflict, cloud-only keys ignored, resolution direction), storage/dismissal semantics, the hydrate wiring, and banner render/dismiss behavior.

Verification recorded:

- Targeted Vitest suite: `npx vitest run src/lib/sync-conflicts.test.ts src/lib/sync-layer-hydrate.test.ts src/components/stats-client.test.tsx` passed.
- Full suite: `npm test` passed with 136 test files and 1025 tests.
- Lint gate: `npm run lint -- --quiet` passed; typecheck gate passed.

Next queue:

1. GitHub auth still needs reconnecting to push the R12 batches and watch CI on PR #1.
2. Continue the remaining R12 suite: R12.11 empty-state CTA review, R12.12 export versioning, R12.13 privacy settings, R12.14 retention docs, R12.15–R12.17 reminders, R12.18 completion celebration audit, R12.19 editable goals, R12.20 weekly summaries, R12.24 no-login degradation, R12.25 retention metric audit docs.

## 2026-09-11 — R12.23 Stats consistency audit

## 2026-09-11 — R12.23 Stats consistency audit

Implemented R12.23 as a cross-aggregator reconciliation auditor plus dev-time diagnosis:

- Added `src/lib/stats-consistency.ts`: `auditStatsConsistency()` asserts the identities and range invariants that must hold when every stats widget reads the same local facts — course overview ↔ course trend (readDocs/doneChapters/totalDocs/completionPct), quiz done counts, replay rounds, wrong pending vs due/overdue ranges, and all percentage fields inside [0,100] or null.
- `StatsClient` runs the audit in non-production builds and `console.warn`s on drift (tree-shaken out of production bundles).
- Tests prove the real builders agree on a shared fixture (zero issues) and that the auditor catches course/quiz/replay/wrong drift, range inversions, out-of-range percentages, and missing inputs.

Verification recorded:

- Targeted Vitest suite: `npx vitest run src/lib/stats-consistency.test.ts src/components/stats-client.test.tsx` passed.
- Full suite: `npm test` passed with 134 test files and 1015 tests.
- Lint gate: `npm run lint -- --quiet` passed; typecheck gate passed.

Next queue:

1. GitHub auth still needs reconnecting to push the R12 batches and watch CI on PR #1.
2. Continue the remaining R12 suite: R12.9 sync conflict notice, R12.11 empty-state CTA review, R12.12 export versioning, R12.13 privacy settings, R12.14 retention docs, R12.15–R12.17 reminders, R12.18 completion celebration audit, R12.19 editable goals, R12.20 weekly summaries, R12.24 no-login degradation, R12.25 retention metric audit docs.

## 2026-09-11 — R12.8 Local/cloud data source labels

## 2026-09-11 — R12.8 Local/cloud data source labels

Implemented R12.8 as a truthful data-source indicator on the stats dashboard:

- Added `src/lib/cloud-sync-meta.ts`: `recordCloudSync()` / `getLastCloudSync()` for the last successful cloud-merge timestamp (`tb-last-cloud-sync`), corrupt-value safe.
- `hydrateFromCloud()` now records the timestamp after a successful merge (failed hydrations never fake a sync).
- The stats overview source pill is now dynamic: signed-out visitors see "本机数据 / This device"; signed-in users see "本机 + 云端 / Local + cloud" plus the last cloud-sync time (localized).
- Added zh/en labels and tests for the meta store, the hydrate wiring, and the signed-out rendering path.

Verification recorded:

- Targeted Vitest suite: `npx vitest run src/lib/cloud-sync-meta.test.ts src/lib/sync-layer-hydrate.test.ts src/components/stats-client.test.tsx` passed.
- Full suite: `npm test` passed with 133 test files and 1010 tests.
- Lint gate: `npm run lint -- --quiet` passed.
- Typecheck gate: `npm run typecheck` passed.

Next queue:

1. GitHub auth still needs reconnecting to push R12.6–R12.8 batches and watch CI on PR #1.
2. Continue the remaining R12 suite: R12.9 sync conflict notice, R12.11 empty-state CTA review, R12.12 export versioning, R12.13 privacy settings, R12.14 retention docs, R12.15–R12.17 reminders, R12.18 completion celebration audit, R12.19 editable goals, R12.20 weekly summaries, R12.23 consistency checks, R12.24 no-login degradation, R12.25 retention metric audit docs.

## 2026-09-11 — R12.10 Time-range filter + R12.21 stats mobile layout gate

## 2026-09-11 — R12.10 Time-range filter + R12.21 stats mobile layout gate

Implemented R12.10 as a shared, persisted time-range filter for the four R12 trend sections, and turned R12.21 into an automated 320px gate for the stats page:

- Added `src/lib/stats-range.ts`: 7/30-day tiers with sanitizing read (invalid/missing → 7, read-only fallback), persisted `tb-stats-range-days`, and `tb-stats-range` broadcast event.
- `StatsClient` subscribes via `useSyncExternalStore` and re-aggregates all four trends (course completion, quiz score, review efficiency, replay time) at the selected range; charts switch to equal-width columns (`gridTemplateColumns` inline style, no Tailwind purge risk) and 30-day views get horizontal scroll containers so the 320px layout never overflows.
- Range toggle is keyboard/screen-reader accessible (`role="group"` + `aria-pressed`) and the course trend chart's accessible name now reflects the active range.
- R12.21: added `/zh/stats` and `/en/stats` to `check:mobile` (CI-gated 320px overflow regression) so every new stats component stays inside the mobile budget permanently.
- Added zh/en labels and tests for tier sanitization, persistence, event broadcast, toggle rendering, persisted 30-day re-aggregation, and grid column switching.

Verification recorded:

- Targeted Vitest suite: `npx vitest run src/lib/stats-range.test.ts src/components/stats-client.test.tsx` passed.
- Full suite: `npm test` passed with 132 test files and 1004 tests.
- Lint gate: `npm run lint -- --quiet` passed.
- Typecheck gate: `npm run typecheck` passed.
- Mobile regression note: Playwright browser binaries cannot download inside this sandbox (cdn.playwright.dev blocked); `check:mobile` is extended and CI runs it with a real browser.

Next queue:

1. GitHub auth still needs reconnecting to push R12.6/R12.7/R12.10 commits and watch CI (PR #1 covers 74b9a1e).
2. Continue the remaining R12 suite: R12.8 local/cloud source labels, R12.9 sync conflict notice, R12.11 empty-state CTA review, R12.12 export versioning, R12.13 privacy settings, R12.14 retention docs, R12.15–R12.17 reminders, R12.18 completion celebration audit, R12.19 editable goals, R12.20 weekly summaries, R12.23 consistency checks, R12.24 no-login degradation, R12.25 retention metric audit docs.

## 2026-09-11 — R12.7 Personalized next learning suggestion

Implemented R12.7 as a deterministic, local-data-driven "Up next" suggestion (review dues > next unread > chapter quiz > replay warm-up):

- Added `src/lib/next-suggestion.ts`: `buildNextSuggestion()` pure decision function with localized hrefs, context titles, and honest reasons (`due-reviews` / `next-unread` / `chapter-quiz` / `replay-warmup` / `all-clear`).
- Stats page now serves chapter titles and doc metadata into `StatsClient`; the suggestion renders as a highlighted card directly under the learning overview section, recomputed from live local data on every progress event.
- Distinct from `/path`'s `TodayPick`: that one only considers reading progress, while R12.7 weighs SRS dues, quizzes, and replay practice.
- Added zh/en labels and fixture coverage for priority order, replay warm-up threshold (<3 rounds), corrupt inputs, slug fallbacks, and stats-page rendering of all three main branches.

Verification recorded:

- Targeted Vitest suite: `npx vitest run src/lib/next-suggestion.test.ts src/components/stats-client.test.tsx` passed with 2 files and 17 tests.
- Full suite: `npm test` passed with 131 test files and 999 tests.
- Lint gate: `npm run lint -- --quiet` passed; `npm run check:ai-copy` passed.
- Typecheck gate: `npm run typecheck` passed.

Next queue:

1. GitHub auth in this sandbox expired mid-session (push + gh both rejected); local commits continue to accumulate on `arena/01a08e2f-trade-buty` and will be pushed once the connection is restored. PR #1 CI (run 34556180299, commit 74b9a1e) was still pending when the token lapsed — Vercel preview had already passed.
2. On reconnect: push, watch CI for 74b9a1e → 43a62fc → new R12.7 commit, fix any failures.
3. Continue the remaining R12 suite: R12.8 local/cloud source labels, R12.9 sync conflict notice, R12.10 time-range filters, R12.11 empty-state CTA review, R12.12 export versioning, R12.13 privacy settings, R12.14 retention docs, R12.15–R12.17 reminders, R12.18 completion celebration audit, R12.19 editable goals, R12.20 weekly summaries, R12.21 mobile layout, R12.23 consistency checks, R12.24 no-login degradation, R12.25 retention metric audit docs.

## 2026-09-11 — R12.6 Gentle streak recovery prompt

Implemented R12.6 as a fact-only, action-oriented recovery card (distinct from R4.3's fact reassurance inside DailyGoal):

- Added `src/lib/streak-recovery.ts`: `buildStreakRecovery()` pure decision function — shows only when the streak actually broke AND today has zero study minutes (hides automatically once the user restarts, so no nagging).
- Action priority derived from real local data: due SRS reviews first, then continue an unfinished chapter, else a replay warm-up; capped at two actions with localized hrefs.
- Added `src/components/streak-recovery-card.tsx` on `/[locale]/stats` with useSyncExternalStore subscriptions (auto-hides when today goes above zero), a per-day "later" dismiss (`tb-recovery-dismissed`), and accessible section labeling.
- Added zh/en stats labels for the recovery card.

Verification recorded:

- Targeted Vitest suite: `npx vitest run src/lib/streak-recovery.test.ts src/components/streak-recovery-card.test.tsx src/components/stats-client.test.tsx` passed with 3 files and 18 tests.
- Full suite: `npm test` passed with 130 test files and 990 tests.
- Lint gate: `npm run lint -- --quiet` passed; `npm run check:ai-copy` passed.
- Typecheck gate: `npm run typecheck` passed.

Next queue:

1. Watch GitHub Actions on PR #1 and fix any failures.
2. Continue R12.7 personalized next suggestions and the remaining R12 retention suite: R12.8 local/cloud source labels, R12.9 sync conflict notice, R12.10 time-range filters, R12.11 empty-state CTA review, R12.12 export versioning, R12.13 privacy settings, R12.14 retention docs, R12.15–R12.17 reminders, R12.18 completion celebration audit, R12.19 editable goals, R12.20 weekly summaries, R12.21 mobile layout, R12.23 consistency checks, R12.24 no-login degradation, R12.25 retention metric audit docs.

## 2026-09-11 — R12.5 Replay practice time trend

Implemented R12.5 as local-data-first replay practice duration statistics with no fabricated durations:

- Extended `ReplayRecord` with optional `durationSec`; `replay-trainer` now records the measured round elapsed seconds (only when a round-start timestamp exists, capped at 8h).
- Added `src/lib/replay-time-trend.ts` as a versioned pure aggregator over local replay history: per-day rounds/duration/accuracy buckets, in-range summary, all-time totals, and best streak (merged with `tb-replay-best` at render time).
- Kept legacy semantics honest: rounds always count from real `at` timestamps, but old records without `durationSec` report `hasDurations: false` + warning `no-round-durations` and zero duration — never estimated.
- Integrated an accessible replay time section into `/[locale]/stats`: daily bars (duration labels), rounds in range, time in range, average per round, best streak, and a legacy no-duration notice.
- Added zh/en stats labels for the replay time section.
- Added tests for day bucketing, accuracy clamping, duration sanitization (negative/NaN/8h cap), legacy no-duration warnings, empty history, corrupt entries, range clamping, and stats-page rendering.

Verification recorded:

- Targeted Vitest suite: `npx vitest run src/lib/replay-time-trend.test.ts src/components/stats-client.test.tsx` passed with 2 files and 15 tests.
- Full suite: `npm test` passed with 128 test files and 980 tests.
- Lint gate: `npm run lint -- --quiet` passed.
- Typecheck gate: `npm run typecheck` passed.
- Build gate: `npm run build` passed (Turbopack) with `/zh/stats` and `/en/stats` routes; bundle budget all green including `zh/stats` 306KB/320KB.
- Sandbox note: fonts.googleapis.com is unreachable from this dev sandbox, so the local build was verified with Geist temporarily self-hosted via `next/font/local`; committed code keeps the unchanged `next/font/google` layout and CI remains the authoritative build gate.

Next queue:

1. Watch GitHub Actions for R12.4+R12.5 and fix any failures.
2. Continue the remaining R12 retention suite: R12.6 streak recovery prompt, R12.7 personalized next suggestions, R12.8 local/cloud source labels, R12.9 sync conflict notice, R12.10 time-range filters, R12.11 empty-state CTA review, R12.12 export versioning, R12.13 privacy settings, R12.14 retention docs, R12.15–R12.17 reminders, R12.18 completion celebration audit, R12.19 editable goals, R12.20 weekly summaries, R12.21 mobile layout, R12.23 consistency checks, R12.24 no-login degradation, R12.25 retention metric audit docs.

## 2026-09-11 — R12.4 Wrongbook review efficiency (+R12.22 stats page bundle budget)

Implemented R12.4 as local-data-first wrongbook review efficiency statistics with no fabricated review dates, and landed the R12.22 stats-page performance budget work needed to ship it:

- Added `src/lib/review-attempt-ledger.ts`: `tb-review-attempts` local ledger (capped at 300 entries), written by `applySrsResult()` for every SRS answer — both correct/mastered and reset outcomes — with idempotent same-timestamp writes.
- Added `src/lib/wrongbook-efficiency.ts` as a versioned pure aggregator over the current wrongbook (authoritative pending state) and the review ledger: per-day reviews/correct/mastered buckets with accuracy, due-today/overdue backlog from SRS fields (backfill semantics consistent with `effectiveSrs`), average stage progress, and mastered totals.
- Kept legacy semantics honest: without a ledger the section reports `dataSource: "current-wrongbook-only"`, `hasLedger: false`, warning `no-review-dates`, and still shows live due/pending counts — no invented dates.
- Integrated an accessible review efficiency section into `/[locale]/stats` with a stacked correct/total mini chart and summary cards (reviews, accuracy, mastered, due now).
- R12.22: extracted the entire stats dictionary from `src/lib/i18n.ts` into `src/lib/i18n-stats.ts` (imported only by the stats page) so stats copy no longer inflates every route's shared chunk; added a dedicated `zh/stats` budget (320KB, measured 306KB) to `check-bundle.mjs`; extended `check-ai-copy.mjs` to scan both dictionary files.
- Added zh/en labels and deep-parity + no-CJK tests for the split stats dictionary.
- Added tests for trend bucketing, due/overdue/backfill semantics, corrupt/unknown entries, range clamping, ledger idempotency/capping, SRS ledger wiring, and stats-page rendering.

Verification recorded:

- Targeted Vitest suite: `npx vitest run src/lib/wrongbook-efficiency.test.ts src/lib/review-attempt-ledger.test.ts src/components/stats-client.test.tsx src/lib/i18n-stats.test.ts src/lib/i18n.test.ts src/lib/wrongbook.test.ts` passed.
- Full suite: `npm test` passed with 128 test files and 980 tests.
- Lint gate: `npm run lint -- --quiet` passed.
- Typecheck gate: `npm run typecheck` passed.
- Build gate: `npm run build` passed (Turbopack); `npm run check:bundle` all green (home back to 295KB after the dictionary split).
- Bundle regression found and fixed during this task: pre-split dictionary additions pushed home routes to 297KB (>295KB budget); the i18n-stats extraction both fixed the budget and delivers R12.22.

# Progress (archived earlier entries below)

## 2026-09-07 — R12.3 Quiz score trend

Implemented R12.3 as a local-data-first quiz score trend with no fabricated historical dates:

- Added `src/lib/quiz-score-trend.ts` as a versioned pure aggregator over quiz definitions, current quiz progress, and the local attempt ledger.
- Added `tb-quiz-attempts` local ledger writes in `saveQuizProgress()` so completed positive-score quiz attempts record chapter, best, total, and timestamp.
- Kept current best scores authoritative in existing `tb-quiz-{chapter}` storage; the ledger is metadata only.
- Preserved legacy behavior: if no attempt ledger exists, trend output reports `dataSource: "current-quiz-progress-only"`, `hasLedger: false`, and warning `no-quiz-attempt-dates`.
- Tightened ledger writes so zero-score attempts are ignored and duplicate same-timestamp entries are not appended.
- Integrated an accessible quiz trend mini chart into `/[locale]/stats`, showing attempts in range, best score in range, current average score, completed quiz count, and a no-date notice for legacy data.
- Added zh/en stats labels for the quiz trend section.
- Added tests for trend bucketing, current best/average calculation, legacy no-date warnings, corrupt/unknown/invalid attempts, ledger normalization, zero-score/duplicate writes, and stats-page rendering.

Verification recorded:

- Targeted Vitest suite: `npx vitest run src/lib/quiz-score-trend.test.ts src/lib/quiz-attempt-ledger.test.ts src/components/stats-client.test.tsx` passed with 3 files and 12 tests.
- Full suite: `npm test` passed with 124 test files and 952 tests.
- Lint gate: `npm run lint -- --quiet` passed.
- Typecheck gate: `npm run typecheck` passed.
- Build gate: `npm run build` passed with `/zh/stats` and `/en/stats` routes included.

Next queue:

1. Commit and push R12.3, then watch GitHub Actions and fix any failures.
2. Continue R12.4 wrongbook review efficiency and R12.5 replay practice duration with measurable local summaries.
3. Continue the remaining R12 retention suite: streak recovery, personalized next suggestions, local/cloud source labels, time-range filters, empty-state CTAs, export versioning, privacy/cleanup docs, reminder controls, weekly summaries, mobile/performance budgets, consistency checks, no-login degradation, and retention metric audit docs.


# Progress

## 2026-09-07 — R12.2 Course completion trend

Implemented R12.2 as local-data-first course completion trend support without fabricating timestamps for legacy progress:

- Added `src/lib/course-completion-trend.ts` as a versioned pure aggregator over chapters, current progress, and the local completion ledger.
- Added `tb-progress-completions` ledger writes in `markRead()` so only first-time reads record completion timestamps; duplicate reads do not update history.
- Kept legacy progress non-inventive: when no ledger exists, trend output reports `dataSource: "current-progress-only"`, `hasLedger: false`, and warning `no-completion-dates`.
- Integrated a 7-day accessible mini bar chart into `StatsClient`, showing course completions, completed chapters, read docs, completion percentage, and a legacy-data notice when completion dates are unavailable.
- Added zh/en `stats` labels for the course completion trend section.
- Added tests for aggregator bucketing, chapter completion counting, duplicate/legacy/empty/corruption handling, progress ledger write behavior, and stats-page rendering.

Verification recorded:

- Targeted Vitest suite: `npx vitest run src/lib/course-completion-trend.test.ts src/lib/progress.test.ts` passed.
- Targeted Vitest component suite: `npx vitest run src/components/stats-client.test.tsx` passed.
- Full suite: `npm test` passed with 122 test files and 942 tests.
- Lint gate: `npm run lint -- --quiet` passed.
- Typecheck gate: `npm run typecheck` passed.
- Build gate: `npm run build` passed with `/zh/stats` and `/en/stats` routes included.

Next queue:

1. Commit and push R12.2, then watch GitHub Actions and fix failures.
2. Continue R12.3 quiz score trend and highest score with a local quiz completion ledger, preserving no-fabricated-dates semantics.
3. Continue R12.4 wrongbook review efficiency and R12.5 replay duration with measurable local summaries.
4. Continue the remaining R12 retention suite: streak recovery, personalized next suggestions, local/cloud source labels, time-range filters, empty-state CTAs, export versioning, privacy/cleanup docs, reminder controls, weekly summaries, mobile/performance budgets, consistency checks, no-login degradation, and retention metric audit docs.

## 2026-09-07 — R12.1 Learning overview card

Implemented the first R12 retention/statistics task as a real, tested stats feature:

- Added `src/lib/learning-overview.ts` with a versioned pure learning overview model for course progress, quiz records, replay practice, and engagement time.
- Added `src/lib/learning-overview.test.ts` covering stable output, duplicate course progress handling, empty/new status, invalid inputs, and rate sanitization.
- Integrated the overview into `/[locale]/stats` via `StatsClient`, including an accessible local-data source label and responsive course/quiz/replay/time cards.
- Added zh/en stats dictionary labels for the overview card.
- Marked R12.1 complete in `docs/roadmap.md` after tests and UI wiring were added.

Verification recorded:

- Targeted Vitest suite: `npx vitest run src/lib/learning-overview.test.ts` passed with 1 file and 4 tests.
- Full suite: `npm test` passed with 120 test files and 934 tests.
- Lint gate: `npm run lint -- --quiet` passed.
- Typecheck gate: `npm run typecheck` passed after tightening numeric sanitization.
- Build gate: `npm run build` passed.

Next queue:

1. Commit and push R12.1, then watch GitHub Actions and fix failures.
2. Continue R12.2 course completion trends and R12.3 quiz score trends with pure aggregators plus stats-page rendering.
3. Continue R12.4 wrongbook review efficiency and R12.5 replay duration with measurable local data summaries.
4. Continue the remaining R12 retention suite: streak recovery, personalized next suggestions, local/cloud source labels, time-range filters, empty-state CTAs, export versioning, privacy/cleanup docs, reminder controls, weekly summaries, mobile/performance budgets, consistency checks, no-login degradation, and retention metric audit docs.


## 2026-09-07 — R11.9 AI quiz offline quality fixtures

Implemented offline fixture-driven quality gates for AI quiz generation:

- Added `src/lib/ai/fixtures/quiz-quality-cases.json` with locale-specific valid and invalid fixture cases.
- Added `src/lib/ai/quiz-quality-fixtures.test.ts` to exercise schema audit codes, accepted-question counts, relevance filtering, dedupe filtering, and quiz strategy boundaries from fixtures.
- Covered valid Chinese/English outputs, invalid roots, missing or too-short fields, duplicate options, answer validation, source accessibility, locale-specific source maps, explicit no-source, relevance thresholds, duplicate/near-duplicate questions, and chapter/variant difficulty counts.

Verification recorded:

- Targeted Vitest suite: `npx vitest run src/lib/ai/quiz-quality-fixtures.test.ts` passed with 1 file and 23 tests.
- Full suite: `npm test` passed with 119 test files and 930 tests.
- Lint gate: `npm run lint -- --quiet` passed with no blocking errors.
- Typecheck gate: `npm run typecheck` passed.
- Build gate: `npm run build` passed.

Next queue:

1. Commit and push R11.9, then watch GitHub Actions and handle failures.
2. Continue R12 data insights tasks: learning overview card, course completion trend, quiz score trends, wrongbook review efficiency, replay practice duration, streak recovery prompt, personalized next learning suggestion, and local/cloud source labeling.

## 2026-09-07 — R11.7 / R11.8 AI quiz strategy and difficulty

Implemented configurable AI quiz generation strategy and difficulty preference:

- Added `src/lib/quiz-strategy.ts` with shared locale/difficulty/chapter/variant strategy resolution.
- Added unit coverage for expected question counts, cache keys, prompt versions, and storage-safe defaults in `src/lib/quiz-strategy.test.ts`.
- Updated `src/lib/ai/prompt.ts` so AI prompts carry difficulty, locale, cache version, token budget, relevance threshold, and chapter context through one strategy object.
- Updated `/api/ai/quiz` to resolve strategy on the server and derive cache keys from prompt version plus strategy cache key.
- Updated `AiChapterQuizCard` to expose 入门/进阶 controls, persist preference per locale, and submit difficulty with generation requests.
- Added component coverage for advanced preference persistence and request body.

Verification recorded:

- Targeted Vitest suite: `npx vitest run src/lib/quiz-strategy.test.ts src/lib/ai/prompt.test.ts src/components/ai-chapter-quiz.test.tsx` passed with 3 files and 38 tests.
- Full suite: `npm test` passed with 118 test files and 907 tests.
- Lint gate: `npm run lint -- --quiet` passed with no blocking errors.
- Typecheck gate: `npm run typecheck` passed.
- Build gate: `npm run build` passed.

Next queue:

1. Continue R12 data insights tasks: learning overview card, course completion trend, quiz score trends, wrongbook review efficiency, replay practice duration, streak recovery prompt, personalized next learning suggestion, and local/cloud source labeling.
