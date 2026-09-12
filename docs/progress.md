# Progress

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
