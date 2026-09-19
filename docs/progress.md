# Progress

## 2026-09-13 — 覆盖率批次 8：隐私审计边界补强

- 扩展 `scripts/growth-event-privacy.test.mjs`，覆盖缺失 console sink、缺失禁止字段文档，以及缺失 `normalizeGrowthEvent` 规范化边界。
- 目标测试通过：`npx vitest run scripts/growth-event-privacy.test.mjs`（7 tests）。
- 全量覆盖率基线保持：91.95% statements / 86.13% branches / 91.82% functions / 94.45% lines。

下一项：继续处理低覆盖率的错误上报隐私审计与内容工具边界，优先补充失败输入和脚本契约测试。


## 2026-09-13 — 覆盖率批次 8：网络质量与 i18n 边界回归

- 为 `useNetworkQuality` 增加 SSR 快照和缺少可选连接方法的回归覆盖，确保服务端输出稳定且卸载不抛错。
- 为 i18n 增加默认 locale 回退、双语插值和阅读时长文案断言。
- 修正错题复习效率组件测试使用固定历史日期导致在 7 天默认窗口外失效的问题，改为使用当前时间保持测试稳定。

验证：

- 目标测试：`npx vitest run src/components/use-network-quality.test.tsx src/lib/i18n.test.ts` 通过（2 文件 / 22 tests）。
- StatsClient 回归：`npx vitest run src/components/stats-client.test.tsx` 通过（1 文件 / 27 tests）。
- `npm run lint -- --quiet` 通过。
- `npm run typecheck` 通过。
- 全量测试：`npx vitest run --maxWorkers=4` 通过（253 文件 / 2126 tests）。
- 构建：`npm run build` 通过（474 个静态页面）。

下一项：

1. 继续覆盖率批次 8，优先检查剩余低覆盖率组件和日期相关脆弱测试。
2. 已完成全量测试与构建回归；继续检查剩余低覆盖率组件和日期相关脆弱测试。


## 覆盖率批次 7：剪贴板助手统一与复制诚实性修复（`codex/coverage-batch-7`）

- 状态：DONE（本地全部门禁绿灯，待 push + PR）
- 工作分支：`codex/coverage-batch-7`（基于 `origin/main@0d0042b`）
- 提交：`fix(clipboard): report copy failures and unify copy fallbacks` · `test: cover clipboard paths, hotkey and code copy` · `docs(progress): record clipboard helper and coverage batch 7`
- 目标：把批次 6 在邮件订阅上发现的「复制结果必须诚实」原则推广到全部复制入口，并消除四处近似重复的剪贴板兜底实现。

### 生产回归：AI 对话复制失败完全静默

- 问题：`src/components/ai-chat.tsx` 的 `copyMsg` 把 `navigator.clipboard.writeText` 放在 `try/catch` 中且 `catch { /* ignore */ }` —— 复制失败时按钮毫无反应、没有任何反馈；同时没有 `execCommand` 兜底，在微信内置浏览器等没有 `navigator.clipboard` 的环境 100% 静默失效。
- 修复：抽出统一的 `copyText(text): Promise<boolean>`（先异步 Clipboard API，失败退回 `execCommand`，返回真实结果），`copyMsg` 依据结果写入 `dict.copied` / `dict.copyFailed`。
- 反证：把 `ai-chat.tsx` 临时还原为旧 buggy 版本跑 `-t "复制失败时显示失败文案"` → **1 failed**；恢复修复版 → 通过。

### 统一重复实现与兜底健壮性

- 新增 `src/lib/clipboard.ts`：`copyViaExecCommand`（`<textarea>` + `execCommand`，`try/catch/finally` 保证无论成功/失败/抛错都清理临时节点）、私有 `copyViaClipboardApi`、公开 `copyText`。
- 统一四处重复实现：`newsletter-signup.tsx`（删本地 `fallbackCopy`）、`copy-link-button.tsx`（删内联 textarea 降级）、`milestone-share-button.tsx`（删 `copyToClipboard`）、`code-copy.tsx`（删 `try/catch`，现在也有 `execCommand` 兜底），共消除约 150 行近似重复代码。
- `src/lib/i18n.ts` 的 `ai` 字典新增 zh/en `copyFailed`（`复制失败` / `Copy failed`）。

### 覆盖率提升（单文件实测）

| 文件 | 语句 | 分支 | 函数 | 行 |
|---|---|---|---|---|
| `search-hotkey.tsx`（1 → 8 例） | 72.7 → **100** | 0 → **100** | 75 → **100** | 70 → **100** |
| `milestone-share-button.tsx` | — → **100** | — → **100** | — → **100** | — → **100** |
| `newsletter-signup.tsx` | 89.3 → **94.87** | 80.8 → **90.9** | 72.7 → **80** | 92.3 → **100** |
| `code-copy.tsx` | 77.3 → **92.85** | 50 → **83.33** | 60 → **70** | 83.8 → **100** |
| `copy-link-button.tsx` | 80.5 → **87.5** | 86.4 → **92.85** | 50 | 86.8 → **100** |
| `clipboard.ts`（新，7 例） | — → **88.46** | — → **75** | — → **100** | — → **95.45** |

- 全局：**253 文件 / 2120 用例**通过；语句 **91.87** / 分支 **86.13** / 函数 **91.44** / 行 **94.36**（阈值 84 / 77 / 83 / 87）。

### 新增的关键行为断言

- 搜索快捷键：⌘K / Ctrl+K / 大写 K 触发跳转、无修饰键与其他键不跳转、卸载解绑、locale 变更后仍指向最新字典。
- 代码复制：真实点击复制、`execCommand` 兜底、两路都失败显示 ✕、`MutationObserver` 动态插入、无 language 类、容器选择器不匹配。
- AI 对话：复制失败可见文案、异步剪贴板缺失时走 `execCommand` 兜底成功。
- 邮件订阅：Change 切回表单、挂载后记录消失 → 复制失败、`setItem` 抛错 → 保存失败。
- 复制链接按钮：空 `url` 直接判失败、不触碰剪贴板、上报 failure。

### 变更文件

- `src/lib/clipboard.ts`、`src/lib/clipboard.test.ts`：新增统一剪贴板助手与其用例。
- `src/components/ai-chat.tsx` + `.test.tsx`、`code-copy.tsx` + `.test.tsx`、`copy-link-button.tsx` + `.test.tsx`、`newsletter-signup.tsx` + `.test.tsx`、`milestone-share-button.tsx`、`search-hotkey.test.tsx`。
- `src/lib/i18n.ts`：新增 `ai.copyFailed`。
- `src/data/release-notes.json`、`CHANGELOG.md`、`docs/progress.md`。

### 验证命令与结果（本地，全部以退出码判定）

- `npm run test:coverage` exit 0 → **253 文件 / 2120 用例**通过；语句 91.87 / 分支 86.13 / 函数 91.44 / 行 94.36，阈值全过。
- `npm run lint` / `npm run typecheck` / `npm run build` exit 0。
- 33 项 `check:*` 门禁（含 `check:secrets`、`check:bundle`、`check:mobile`、`check:structured-data`、`check:kb-parity-budget`、`check:changelog` 等）exit 0。
- `npm run e2e` exit 0 → Playwright **93 passed**。
- `npm run audit:prod` / `npm run audit:all` exit 0 → 0 vulnerabilities。
- `npm run db:test` exit 0。
- `git diff --check` exit 0。

- 上游依赖：无；`content/kline-buty` 未变更。
- 风险与回滚：只改复制路径与失败文案，不改存储/导出协议；`clipboard.ts` 为纯工具函数，回滚即撤销该 commit 并还原四处调用点。
- 下一步：push 分支、创建 PR、等待全绿后以 `--rebase` 合并；随后继续补 `i18n.ts`、`/api/ai/quiz/route.ts`、`use-network-quality.ts`、`ai-quiz.tsx`、`reading-progress.tsx` 等覆盖率热点。
- 最后更新：2026-09-13


## 覆盖率批次 6：邮件订阅复制诚实性修复 + 回放分享卡补测（`codex/coverage-batch-6`）

- 状态：MERGED（PR [#65](https://github.com/Sun1090/trade-buty/pull/65)，`--rebase` 合入 main，main 到 `0d0042b`）
- 工作分支：`codex/coverage-batch-6`（基于 `origin/main@f114a41`）
- 提交：`b1471af` `fix(newsletter): report copy failure instead of faking success` · `3f3617c` `test: cover replay share card and stabilize streak preview assertion`
- 目标：先清理批次 5 全量回归暴露的偶发失败，再按「真实缺陷 > 覆盖率」继续核查分享链路中与批次 5 同类的诚实性与单位语义问题。

### 生产回归：邮件订阅复制失败仍显示「已复制」

- 问题：`handleCopy` 在 `navigator.clipboard.writeText` 失败后进入 `execCommand` 兜底，但从不检查兜底返回值，随后无条件 `setCopied(true)`；主副路径都失败时按钮仍显示「已复制」。另外 `document.execCommand` 不存在或抛错时，异常会逃出 async 事件处理器，变成未处理的 Promise rejection。
- 修复：抽出 `fallbackCopy()` 返回真实布尔结果；两条路径都失败时显示本地化 `copyFailed` 文案（zh/en 已补），不再伪装成功。
- 反证：新增「主副剪贴板都失败」「execCommand 抛错」用例在修复前分别无法断言到失败文案或会产生未处理拒绝；修复后通过。

### 测试稳定性与覆盖率

- 批次 5 的「连续学习分享卡重复预览回收 URL」用例把 `waitFor(() => expect(revoke).toHaveBeenCalledTimes(0))` 当等待条件——该断言恒真，高负载下第二次点击可能发生在首张预览写入 state 之前，导致全量回归偶发失败（本批首次全量跑即复现）。现改为等待 `<img>` 真正渲染，再断言回收调用次数与目标 data URL。
- `replay-share-card.tsx`：3 → 13 例，语句 75 → **90.38**，分支 51.72 → **86.2**，函数 80 → **100**，行 82.22 → **95.55**。新增中文/英文 alt、预览后按 `preview` 触发下载、下载失败与预览失败的可见反馈、复制链接成功/失败埋点、重复预览与卸载回收、无 2D 上下文仍可下载、文件名清洗与空值回退。
- 全局：**252 文件 / 2094 用例**通过；语句 **91.71** / 分支 **85.96** / 函数 **91.27** / 行 **94.13**（阈值 84 / 77 / 83 / 87）。

### 同类缺陷核查结论

逐一核对 `accuracyBps`（万分比）到评级的全部消费方：`share-landing.ts`（本批之前已修为 `/10_000` 传 0–1）、`opengraph-image.tsx`（同样 `/10000`）、`share-card-preview.tsx`（本地 `replayGradeLetter` 明确按 0–100 百分数比较）、`share-card.ts::drawReplayCard`（入参本身是 0–1）语义一致，未发现新的单位错配。`replay-share-card.tsx` 接收的 `accuracy` 也是 0–1，预览 alt 与画布均正确乘 100 展示。

### 变更文件

- `src/components/newsletter-signup.tsx`：复制结果诚实化 + 兜底异常收敛。
- `src/lib/i18n.ts`：新增 zh/en `newsletter.copyFailed`。
- `src/components/newsletter-signup.test.tsx`：3 条复制失败/兜底用例。
- `src/components/replay-share-card.test.tsx`：13 例分享卡回归与分支用例。
- `src/components/streak-share-card.test.tsx`：修正重复预览等待条件。
- `src/data/release-notes.json`、`CHANGELOG.md`：登记批次 6。

### 验证命令与结果（本地，全部以退出码判定）

- `npm run test:coverage` exit 0 → **252 文件 / 2094 用例**通过；语句 91.71 / 分支 85.96 / 函数 91.27 / 行 94.13，阈值全过。
- `npm run lint` / `npm run typecheck` / `npm run build` exit 0；生产构建 **474 静态页**。
- 28 项内容/SEO/构建产物门禁（含 `check:changelog`、`check:dark-pattern-copy`、`check:structured-data`、`check:secrets` 等）exit 0。
- `npm run audit:prod` / `npm run audit:all` exit 0 → 0 vulnerabilities；`npm run check:lockfile-repro` exit 0（npm 10.9.4 复现 981 个包条目，无差异）。
- `git diff --check` exit 0。

- 上游依赖：无；`content/kline-buty` 未变更。
- 风险与回滚：只改复制结果判断与失败文案，不改本地存储/导出协议；回滚 = 撤销 `b1471af`；测试与文档可独立撤销。
- 下一步：push 分支、创建 PR、等待全绿后以 `--rebase` 合并；随后继续补 `ai-quiz.tsx`、`search-hotkey.tsx` 与 `i18n.ts` 热点，并继续核查分享链路单位语义。
- 最后更新：2026-09-13


## 覆盖率批次 5：回放分享评级单位回归修复 + 五个热点补测（`codex/coverage-batch-5`）

- 状态：MERGED（PR [#64](https://github.com/Sun1090/trade-buty/pull/64)，`--rebase` 合入 main，main 到 `f114a41`）
- 工作分支：`codex/coverage-batch-5`（基于 `origin/main@139d257`；合入后删除远端分支）
- 提交：`28b184e` `fix(share): grade replay landing from accuracy basis points` · `26cf871` `test: lift coverage on doc list, chart, streak card, login and share landing`
- 目标：继续抬高客户端覆盖率地板，优先处理 `doc-list.tsx`、`kline-chart.tsx`、`streak-share-card.tsx`、`login-client.tsx` 与刚刚从批次 4 结论上锁定的 `share-landing.ts`。

### 生产回归：回放分享落地页评级恒为最高档

- 问题：`accuracyBps` 的单位是万分比（`10_000` = 100%）。`summarizeForMeta` 先把 `accuracyBps / 100` 得到展示用百分数（如 65）后，直接把它传给 `replayGradeLabel()`；而该函数与 `share-card.ts` 的 `gradeFromReplayAccuracy` 同语义，期望 0–1 比例。于是除「总题数 < 3」的兜底分支外，任何 `accuracy >= 0.7` 恒真，所有回放分享页（含 OG/社交媒体预览）永远显示 S 级「卓越」。
- 修复：展示用的百分数单独存入 `accuracyPercent`，分级调用改传 `p.accuracyBps / 10_000`；展示文案不变。
- 反证：新增的 `replayGradeLabel 分级覆盖` 用例在修复前 4 条稳定失败（全部输出「卓越」/「S」），修复后通过。

### 覆盖率提升（单文件实测）

| 文件 | 语句 | 分支 | 函数 | 行 |
|---|---|---|---|---|
| `doc-list.tsx`（4 → 15 例） | 68.42 → **100** | 50 → **100** | 50 → **100** | 70.58 → **100** |
| `kline-chart.tsx`（3 → 31 例） | 71.62 → **97.97** | 48.51 → **98.01** | 58.33 → **97.22** | 76.92 → **100** |
| `streak-share-card.tsx`（4 → 12 例） | 70 → **85** | 51.42 → **77.14** | 77.77 → **100** | 81.63 → **95.91** |
| `login-client.tsx`（12 → 16 例） | 72.22 → **94.44** | 78.26 → **91.3** | 71.42 → **100** | 77.08 → **100** |
| `share-landing.ts`（+10 例） | 74.13 → **94.82** | 47.61 → **84.12** | 100 | 83.33 → **100** |

- 全局：语句 **91.55** / 分支 **85.77** / 函数 **91.2** / 行 **93.99**（批次前 90.68 / 84.21 / 90.06 / 93.22；阈值 84 / 77 / 83 / 87）。

### 新增的关键行为断言

- 课程目录：空态 zh/en、已读勾选与进度条宽度、未读优先排序（已读沉底但课号仍按 `metas` 原序）、无 description 不渲染 `<p>`、两位补零课号。
- K 线图：错误/超时重试、离线态、慢网低带宽、移动端紧凑/完整密度与 `dataLimit`、自定义交易对合法/非法/回车、周期切换、MA series 复用、卸载后不写入、空响应、跌 K 红色量柱，以及 WS 建连/更新/脏帧/缺字段/跌帧/退避重连/卸载关闭/离线不建连。
- 连续学习分享卡：下载失败/预览失败可见 alert、preview 触发下载、shareUrl 复制成功/失败埋点、英文 alt、无 2D context、重复预览 `revokeObjectURL`。
- 登录表单：fetch 抛错归为网络异常、冷却期提交走客户端节流、冷却归零恢复 idle、倒计时文案刷新。
- 分享落地页：`kindToLocale` / `gradeLabel` / `replayGradeLabel` 全分级覆盖。

### 变更文件（关键）

- `src/lib/share-landing.ts`：回放分享评级单位回归修复。
- `src/app/share/[kind]/[path]/page.test.ts`、`src/components/doc-list.test.tsx`、`src/components/kline-chart.test.tsx`、`src/components/login-client.test.tsx`、`src/components/streak-share-card.test.tsx`：新增回归与分支用例。
- `src/data/release-notes.json`、`CHANGELOG.md`：登记回归修复与覆盖率结果。

### 验证命令与结果（本地，全部以退出码判定）

- `npm run test:coverage` exit 0 → **252 文件 / 2081 用例**通过；语句 91.55 / 分支 85.77 / 函数 91.2 / 行 93.99，阈值全过。
- `npm run lint` / `npm run typecheck` / `npm run build` exit 0；生产构建 474 静态页。
- `npm run changelog:generate` + `npm run check:changelog` exit 0。
- `npm run audit:prod` / `npm run audit:all` exit 0 → 0 vulnerabilities；`npm run check:secrets` exit 0（666 个文本文件）。
- `npm run check:lockfile-repro` exit 0（npm 10.9.4 复现 981 个包条目，无差异）。
- 全部 30 项内容/SEO/构建产物门禁与 7 项内容质量报告 exit 0；知识库新章节 dry-run 冒烟 exit 0；`git diff --check` exit 0。

- 上游依赖：无；`content/kline-buty` 未变更。
- 风险与回滚：只改分级入参，不改 URL/分享协议；回滚 = 撤销 `28b184e`。测试/文档可独立撤销。
- 下一步：push 分支、创建 PR、等待全绿后以 `--rebase` 合并；随后继续补 `replay-share-card.tsx` 等热点，并核查是否存在同类评级单位缺陷。
- 最后更新：2026-09-13

## 覆盖率批次 4：复制反馈回归修复 + 三个热点组件补测（`codex/coverage-batch-4`）

- 状态：DONE（本地全部门禁绿灯，待 push + PR）
- 工作分支：`codex/coverage-batch-4`（基于 `origin/main@c5de18e`）
- 提交：`4a2b4ba` `fix(ai): keep copy confirmation after async clipboard write` · `01d3c1d` `test: expand auth, replay history, and AI chat coverage`
- 目标：继续抬高客户端覆盖率地板，优先处理 `auth-header.tsx`（语句 70.45%）、`replay-history.tsx`（69.23%）与已有大量交互分支但没有断言操作反馈的 `ai-chat.tsx`（72.02%）。

### 生产回归：AI 回答复制成功但不显示「已复制」

- 问题：`copyMsg()` 在 `await navigator.clipboard.writeText(text)` **之后**才读取 React 合成事件的 `e.currentTarget`。异步边界之后 `currentTarget` 已失效，读取/写回按钮文案会抛错并被同一个 `catch` 静默吞掉；剪贴板实际写入成功，但用户永远看不到任何复制反馈。
- 修复：在进入 `try`/`await` 前把按钮引用捕获到局部变量，再执行异步写入与 1.5 秒文案恢复。
- 反证：新增的复制回归用例在修复前稳定失败（找不到「已复制」），修复后通过。

### 覆盖率提升（单文件实测）

| 文件 | 语句 | 分支 | 函数 | 行 |
|---|---|---|---|---|
| `auth-header.test.tsx` 对应组件（6 → 15 例） | 70.45 → **100** | 54.54 → **86.36** | 53.84 → **100** | 72.5 → **100** |
| `replay-history.tsx`（1 → 7 例） | 69.23 → **100** | 20 → **100** | 33.33 → **100** | 73.91 → **100** |
| `ai-chat.tsx`（15 → 19 例） | 72.02 → **87.56** | 64.67 → **73.65** | 51.66 → **73.33** | 77.16 → **92.59** |

- 全局：语句 **90.68** / 分支 **84.21** / 函数 **90.06** / 行 **93.22**（批次前 90.11 / 83.65 / 88.69 / 92.68；阈值 84 / 77 / 83 / 87）。

### 新增的关键行为断言

- 登录头：游客/已登录/管理员态、路径高亮、危险账号操作、注销进行中禁用、失败恢复。
- 回放历史：空态、汇总与色阶、倒序、最多 10 条、`total=0` 除零、`tb-progress` 实时刷新、卸载移除监听。
- AI 对话：反馈只提交一次并配对问题/回答；清空必须确认且取消不丢失；复制成功/恢复文案；被截断回答续写时原文追加并提交 `continueFrom`。

### 变更文件（关键）

- `src/components/ai-chat.tsx`：复制反馈异步边界修复。
- `src/components/ai-chat.test.tsx`、`src/components/auth-header.test.tsx`、`src/components/replay-history.test.tsx`：新增 19 条回归/分支用例。
- `src/data/release-notes.json`、`CHANGELOG.md`：登记复制反馈修复与覆盖率结果。

### 验证命令与结果（本地，全部以退出码判定）

- `npm run test:coverage` exit 0 → **252 文件 / 2018 用例**通过；语句 90.68 / 分支 84.21 / 函数 90.06 / 行 93.22，阈值全过。
- `npm run lint` / `npm run typecheck` / `npm run build` exit 0；生产构建 **474 静态页**生成成功。
- `npm run audit:prod` / `npm run audit:all` exit 0 → 0 vulnerabilities；`npm run check:secrets` exit 0（666 个文本文件）。
- `npm run check:lockfile-repro` exit 0（npm 10.9.4 复现 981 个包条目，无差异）。
- 全部 30 项内容/SEO/构建产物门禁与 7 项内容质量报告 exit 0；新章节 dry-run 冒烟 exit 0；`git diff --check` exit 0。

- 上游依赖：无；`content/kline-buty` 未变更。
- 风险与回滚：修复只提前捕获 DOM 引用，不改复制协议；回滚 = 撤销 `4a2b4ba`。测试/文档可独立撤销。
- 下一步：push 分支、创建 PR、等待全绿后以 `--rebase` 合并；随后重新检查 roadmap，继续处理可执行项。
- 最后更新：2026-09-13

## 覆盖率批次 3：回放训练器两个生产回归 + 四条热点路径补测（`codex/coverage-batch-3`）

- 状态：DONE（本地全部门禁绿灯，待 push + PR）
- 工作分支：`codex/coverage-batch-3`（基于 `origin/main@6994f2d`）
- 提交：`d3d081e` `fix(replay): stop dropping the first round and reject corrupt difficulty state` · `c1c618b` `test: lift coverage on review client, conversations route, OG card and download`
- 目标：按上一轮「优先补客户端 → 路由契约类用例」的结论继续补覆盖率地板，重点盯 `replay-trainer.tsx`（语句 53%）。补测过程中又挖出两个「构建/测试全绿、线上路径不可用」的真实缺陷。
- 检查结论：`docs/roadmap.md` 剩余 10 项仍**全部** `BLOCKED_EXTERNAL`；源码内无 `TODO`/`FIXME`。可执行工作 = 覆盖率批次 3。

### 缺陷 A：首轮回放战绩被静默丢弃（生产回归）

- 问题：`replay-trainer.tsx` 用 `const savedRoundRef = useRef(0)` 记录「已保存到第几轮」，而 `round` 状态也从 `0` 起，于是守卫 `savedRoundRef.current !== round` 在**第 0 轮恒为假**——**每个用户的第一个回放回合都不会写入训练历史**，第二轮回合才被记下来。
- 回归来源：`749c594`（`feat(replay): training log with per-round history`）引入该 ref 的初值。
- 修复：哨兵改为 `useRef(-1)`（`round` 永远取不到的值），并加注释说明为什么不能用 0。

### 缺陷 B：localStorage 脏数据打崩整个训练器

- 问题：难度下标 `useState(() => { const saved = localStorage.getItem(...); return saved ? parseInt(saved, 10) : 1 })` 只兜了「读不到」，没兜「读到但非法」：`parseInt("abc")` → `NaN`、`parseInt("9")` → 越界，随后 `DIFFICULTIES[difficultyIdx].context` 抛 `TypeError: Cannot read properties of undefined (reading 'context')`，**整个 `ReplayTrainer` 白屏**。手改过 localStorage、或旧版本写入过不同档位数的用户都会命中。
- 修复：抽出 `initialDifficultyIdx()`，用 `Number.isInteger(n) && n >= 0 && n < DIFFICULTIES.length` 收敛，非法值回退默认「进阶」；`context` 取值处再加一层 `?? DIFFICULTIES[1]` 兜底，防止未来新入口绕过校验。
- 反证（关键证据）：把两处修复临时还原后，新增的 4 条用例**全部失败**（2 条 `TypeError`、2 条 `saveReplayRecord` 未被调用）；恢复后全绿。

### 覆盖率提升（单文件实测）

| 文件 | 语句 | 分支 | 函数 | 行 |
|---|---|---|---|---|
| `replay-trainer.tsx` | 53.14 → **89.94** | 34.5 → **85.23** | 47.36 → **92.98** | 59.06 → **93.42** |
| `review-client.tsx` | 54.09 → **98.36** | 43.06 → **89.05** | 50 → **100** | 52.77 → **100** |
| `conversations/route.ts` | 66.15 → **95.38** | 70.68 → **91.37** | 66.66 → **100** | 67.92 → **100** |
| `opengraph-image.tsx` | 62.5 → **100** | 35.89 → **89.74** | 100 → **100** | 64.28 → **100** |
| `download.ts` | 91.3 → **100** | 90 → **100** | 83.33 → **100** | 94.73 → **100** |

- 全局：语句 **90.11** / 分支 **83.65** / 函数 **88.69** / 行 **92.68**（阈值 84 / 77 / 83 / 87）。

### 变更文件（关键）

- `src/components/replay-trainer.tsx`、`src/components/replay-trainer.test.tsx`（1 → 21 例）
- `src/components/review-client.test.tsx`（3 → 22 例）：空态、孤儿清理、到期/过期提示、SRS 开关、复习应答、导出/清空、快速重答、AI 契约、分组跳转
- `src/app/api/ai/conversations/route.test.ts`（6 → 15 例）：GET 全分支 + POST 错误分支
- `src/app/share/[kind]/[path]/opengraph-image.tsx` + `.test.tsx`（3 → 14 例）：`summarize` 加 `export` 以便直接断言各 kind 取值（零行为改动）
- `src/lib/download.test.ts`（6 → 9 例）：非浏览器环境、延迟回收 ObjectURL
- `src/data/release-notes.json`、`CHANGELOG.md`：用户可见修复进未发布条目

### 验证命令与结果（本地）

- `npm test` exit 0 → **252 文件 / 1999 用例**通过。
- `npm run test:coverage` exit 0 → 语句 90.11 / 分支 83.65 / 函数 88.69 / 行 92.68，阈值全过。
- `npm run lint` exit 0（`--max-warnings=0`）；`npm run typecheck` exit 0；`npm run build` exit 0。
- 内容门禁：`check:ai-copy` / `check:growth-event-privacy` / `check:error-report-privacy` / `check:env-docs` / `check:dark-pattern-copy` / `check:docs` / `check:changelog` / `check:constitution` / `check:frontmatter` / `check:image-alt` / `check:glossary` / `check:slug-conflicts` / `check:description-dupes` / `check:kb-pointer` / `check:kb-changelog` / `check:translation-history` / `check:kb-parity-budget` / `check:quiz-mounts` / `check:quiz-coverage` / `check:links` / `check:sitemap` / `check:seo-surface` / `check:search-index` / `check:nav-chain` / `check:relative-links` / `check:bundle` / `check:structured-data` / `check:secrets` 全部 PASS；`git diff --check` exit 0。

- 上游依赖：无；`content/kline-buty` 未变更。
- 未验证项：E2E / Lighthouse 依赖浏览器与线上环境，交由 CI 复核。
- 风险与回滚：两处修复都是局部状态收敛，无 schema、无迁移、无对外接口变化；`opengraph-image.tsx` 只加 `export`。回滚 = 撤销 `d3d081e` / `c1c618b`。
- 下一步：`ai-quiz.tsx` 仍是低覆盖热点（74.19 / 67.34 / 66.66 / 82.69），补 error / next / report 边界；以及同类「形状假设错误」审计（如 `summary/route.ts` 的 `parseSummaryBody` 只校验长度不校验 slug 形状）。
- 最后更新：2026-09-13


## 自主开发续跑：lockfile 复现门禁、覆盖率批次与两个生产回归修复（PR #56–#60）

- 状态：DONE（#56–#60 全部以 `--rebase` 合并进 main；main 推进到 `bb0893b`）
- 工作分支：#56 `codex/lockfile-repro-gate` · #57 `codex/ui-coverage` · #58 `codex/coverage-batch-2` · #59 `codex/fix-quiz-variant-slug` · #60 `codex/progress-sweep-2`（均已删除）
- 目标：上一轮把「npm 主版本必须对齐 CI」写成了人工约定，需要机器门禁；同时按覆盖率地板继续补测，并在补测过程中把「测试全绿但线上路径不可用」的盲区找出来。
- 检查结论：`docs/roadmap.md` 剩余 10 项**全部** `BLOCKED_EXTERNAL`（Sentry/Supabase 线上联调/GSC/Bing/Vercel Analytics/PostHog/分享链路人工抽查/冷启动分发/云备份演练/R13.23 用户研究），源码内无 `TODO`/`FIXME`，因此本轮可执行工作集中在「门禁 + 回归网 + 真实缺陷」。

### #56 `ci(lockfile): gate package-lock reproducibility against the pinned npm major`（合并 `74f9197`）

- 问题：PR #54 的根因是「本地 npm 11 / CI npm 10」生成出形状不同的 lockfile，而当时只把「用对齐的 npm 生成」写进 `docs/deps.md`，靠人工复核。
- 已落地：`npm run check:lockfile-repro` —— 用 `devEngines.packageManager` 钉住的 npm 主版本在临时副本里重新生成 `package-lock.json`，再与仓库条目逐条比对，**脚本始终从备份恢复 lockfile**，失败也不会污染工作树；`scripts/lockfile-repro-lib.mjs` 带 171 行单测，CI 在早期阶段接入。
- 变更文件（关键）：`scripts/check-lockfile-reproducibility.mjs`、`scripts/lockfile-repro-lib.mjs`(+test)、`.github/workflows/ci.yml`、`package.json`、`docs/deps.md`、`docs/ops.md`、`src/data/release-notes.json`、`CHANGELOG.md`。
- 远端验证：CI run [34741576237](https://github.com/Sun1090/trade-buty/actions/runs/34741576237) `ci` + `db-tests` 全绿。

### #57 `test(ui): cover untested toggle/registrar paths and de-flake the sidebar test`（合并 `9316ec9`）

- 已完成：补 `theme-toggle` / `language-toggle` / `service-worker-registrar` 的未覆盖分支（分别到 100/100/100/100、100/91.7/100/100、96.3/85.7/100/100）；`service-worker-registrar` 用例从 `.ts` 挪到 `.tsx`（原文件不渲染 JSX）；`learning-sidebar` 测试把 `next/link` mock 成纯 `<a>`，去掉 prefetch 抖动窗口，单文件 3.9s → 1.07s。
- 变更文件（关键）：`src/components/theme-toggle.test.tsx`、`src/components/language-toggle.test.tsx`、`src/components/service-worker-registrar.test.tsx`、`src/components/learning-sidebar.test.tsx`。
- 远端验证：CI run [34742273114](https://github.com/Sun1090/trade-buty/actions/runs/34742273114) 全绿。

### #58 `test: lift coverage on share-card preview, toc and reading-time`（合并 `0d65a89`）

- 已完成（纯测试新增，零运行时改动）：`share-card-preview.tsx` 语句 47.2 → **95.8** / 分支 26.2 → 95.2（2 → 17 例）；`toc.tsx` 语句 55.6 → **100** / 分支 68.8 → 93.8（5 → 11 例）；`reading-time.ts` 语句 66.7 → **100** / 分支 60 → 100（9 → 15 例）。
- 变更文件（关键）：`src/components/share-card-preview.test.tsx`、`src/components/toc.test.tsx`、`src/lib/reading-time.test.ts`。
- 记录到的测试环境事实：同一 tick 内并发调用 `addReadingTime` 会让动态 `import("./study-time")` 在 Vitest SSR runner 里判重入（浏览器同 specifier 会去重），因此按 5s tick 的真实节奏串行化。
- 远端验证：CI run [34743280152](https://github.com/Sun1090/trade-buty/actions/runs/34743280152) 全绿。

### #59 `fix(ai): accept real chapter slugs in quiz variant mode`（合并 `ef4fa30`）—— 生产回归

- 问题：`POST /api/ai/quiz` 的**变体模式**（错题本 → AI 变体题）对所有真实客户端**固定返回 400**，`chat` 从未被调用。成因是路由用 `/^\d{1,3}$/` 校验 `item.chapterNum`，而 `QUIZZES` 的键是英文篇章 slug（27 个，与 `kb-titles.json` 一致）；错题本链路（`review-client.tsx` → `ai-quiz.tsx`）传的正是 slug，于是在校验处就被判非法。
- 回归来源：`a969a6c`（`fix(ai): validate request bodies and parse LLM JSON leniently`）——当时只补了形状校验，测试又全部使用 `"01"` / `"999"` 这类数字样例，于是**CI 全绿而线上路径不可用**。
- 修复：改为校验 slug 形状（`/^[a-z0-9]+(?:-[a-z0-9]+)*$/`，≤64 字符），保留 R7.12 的原始安全意图（不把任意文本/越界索引拼进 prompt 或用于访问题库）；存在性仍由 `QUIZZES` 查找兜底，取不到原题即 400。
- 测试：新增正向用例（真实 slug → 取出原题 → 调用模型 → 返回题目，并断言原题内容确实进了 prompt）与形状非法用例（路径穿越字符、大写、超长、首尾连字符）；另补一条**客户端契约用例**钉住 `ai-quiz.tsx` 发给 `/api/ai/quiz` 的请求体形状。
- 反证：把 `route.ts` 临时还原成旧实现后，新增的两条用例**均失败**（`expected 400 to be 200`、`expected 'Invalid payload' to be 'No matching questions'`），确认测试真的锁住了这个回归。
- 变更文件（关键）：`src/app/api/ai/quiz/route.ts`、`src/app/api/ai/quiz/route.test.ts`、`src/components/ai-quiz.test.tsx`。
- 远端验证：CI run [34743550007](https://github.com/Sun1090/trade-buty/actions/runs/34743550007) `ci` 6m26s + `db-tests` 全绿。

### #60 `fix(api): rate limit the anonymous feedback and citation-click writes`（合并 `bb0893b`）—— 同批次发现的安全缺口

- 问题：`/api/ai/feedback` 与 `/api/ai/citation-click` 是**匿名可写库**端点——迁移里 RLS 明确放行匿名插入（`0002_ai.sql` 的 `user_id is null`、`0004_ai_citation_clicks.sql` 的 `anon_or_self_insert_citation_clicks`），所以应用层是唯一闸门，而这两个路由**一次配额都没有**：脚本可无上限往 `ai_feedback`（单条约 10KB）和 `ai_citation_clicks` 堆行。同一轮加固里 `/api/error-reports` 已加每 IP 限流，这两个漏掉了。
- 修复：两路由接入同一套 `createRateLimiter`（`BoundedMap` 兜底内存上限、按需清扫过期窗口），**在解析 body 之前**判定，超限返回 `429` + `Retry-After`；配额按真人上限定为反馈 20 次/分钟、引用点击 30 次/分钟。两个调用点都是 `void fetch(...)` fire-and-forget，超限只丢遥测，不影响任何用户路径。
- 测试：新增「同 IP 超过配额返回 429 且不再写库（写库次数正好等于配额）」「另一个 IP 仍有独立配额」；`request()` 辅助函数改为按请求轮换 `x-forwarded-for`——限流表是模块级进程内状态，用例之间不能互相扣配额。
- 变更文件（关键）：`src/app/api/ai/feedback/route.ts`(+test)、`src/app/api/ai/citation-click/route.ts`(+test)、`src/data/release-notes.json`、`CHANGELOG.md`。
- 远端验证：CI run [34744119227](https://github.com/Sun1090/trade-buty/actions/runs/34744119227) `ci` 6m9s + `db-tests` 全绿；本次 Vercel 预览也恢复可用（此前为账号构建配额 `Deployment rate limited`）。

### 验证命令与结果（本地，main@`bb0893b`）

- `npm test` exit 0 → **252 文件 / 1938 用例**通过。
- `npm run lint` exit 0（`--max-warnings=0`）；`npm run typecheck` exit 0。
- `npm run check:docs` exit 0；`npm run check:changelog` exit 0；`git diff --check` exit 0。

- 上游依赖：无；`content/kline-buty` 未变更。
- 未验证项：无。
- 风险与回滚：三个修复都是「局部形状/闸门」改动，无 schema、无迁移、无对外接口破坏；`#60` 的限流是进程内按 IP 分桶，多实例不共享配额（与既有 `chat`/`error-reports` 同一取舍），已在代码注释与本文件记录。回滚 = 分别撤销该 PR 的提交。
- 下一步：覆盖率批次 3 —— `replay-trainer.tsx` / `review-client.tsx` / `api/ai/conversations` / `lib/download.ts` 四个低覆盖热点，优先补「客户端 → 路由」契约类用例（本轮两次真实缺陷都出在契约盲区）。
- 最后更新：2026-09-13

## 工具链升级到 TypeScript 6.0.3 与 npm 10/11 lockfile 漂移（PR #54）

- 状态：DONE（PR #54 已以 `--rebase` 合并进 main；PR CI run [34740352348](https://github.com/Sun1090/trade-buty/actions/runs/34740352348) 全绿）
- 工作分支：`codex/typescript-6`（已删除）
- PR：[#54](https://github.com/Sun1090/trade-buty/pull/54) · `MERGED`
- Base：`origin/main@4c162b7`（rebase 后）
- 合并提交：`6ac7721`
- 已验证 Head：`ade0b10`
- 本地提交：`ade0b10` `build(deps-dev): bump typescript to 6.0.3 (still under typescript-eslint peer)`
- 目标：Dependabot PR #52 把 `typescript` 从 5.9.3 升到 6.0.3，CI 40 秒即红。必须先判定这是「类型层面不兼容」还是「流水线自身的问题」，再决定关闭还是落地。
- 根因（**不是类型错误**）：生成 lockfile 的 npm 主版本与 CI 不一致。Dependabot / 本地侧用 npm 11，CI（Node 22 自带）用 npm 10。npm 11 会重排 root `devDependencies` 并删掉 14 条 `puppeteer-core/node_modules/*` 的 optional-peer 条目（`proxy-agent-negotiate`、`get-uri` 等），npm 10 的 `npm ci` 直接报 `Missing: get-uri@8.0.1 from lock file`，根本没走到编译。`typescript-eslint@8.70.0` 的 peer 是 `typescript >=4.8.4 <6.1.0`，6.0.3 落在允许区间内，越界的只有 TS 7。
- 已完成：
  - `package.json` 的 `typescript` 由 `^5` 升到 `^6`；用 **npm 10.9.4** 重新生成 lockfile，diff 压到 **6 增 6 删**（root `devDependencies` 排序归一 + `node_modules/typescript` → 6.0.3），不触碰任何其他包。
  - `docs/deps.md`：TypeScript 从「延期」表移入「已落地」表；月度审计行改为「已升级到 6.0.3（7.0.2 仍延期）」；新增「lockfile 工具链漂移（npm 10 vs npm 11）」小节，把「改 lockfile 必须用与 CI 相同的 npm 主版本生成，并在 PR 里贴 `npm ci` 退出码」写进约定。
  - `src/data/release-notes.json` + 生成的 `CHANGELOG.md` 增加未发布条目。
  - 关闭被取代的 Dependabot PR #52，并附上 lockfile 根因说明。
- 变更文件（关键）：`package.json`、`package-lock.json`、`docs/deps.md`、`src/data/release-notes.json`、`CHANGELOG.md`。
- 验证命令与结果（全部用 npm 10.9.4，对齐 CI 的 npm 主版本）：
  - `npx --yes npm@10.9.4 ci --registry=https://registry.npmjs.org` exit 0。
  - `npx tsc --version` → `6.0.3`；`npm run typecheck` exit 0。
  - `npm run lint` exit 0（零警告门禁）；`npm test` exit 0 → **251 文件 / 1862 用例**通过；`npm run build` exit 0。
  - `npm run check:changelog` exit 0。
  - PR CI（Node 22 + npm 10）exit 0：`ci` 6m17s + `db-tests` 34s；CodeQL（actions / javascript-typescript）pass。Vercel 因配额 `Deployment rate limited` 未产出预览。
- 上游依赖：无；`content/kline-buty` 未变更。
- 未验证项：无。
- 风险与回滚：TS 6 是 major，但 typecheck / lint / 全量测试 / 构建都已实测通过；lockfile 差异只有 typescript 一处，回滚 = 撤销 PR #54。长期风险是 npm 主版本继续漂移，候选根治手段是加 `packageManager` 字段或在 CI 显式安装固定 npm 主版本。
- 下一步：无（已完成）。遗留改进项：把 npm 主版本写进仓库配置（`packageManager` 字段或 CI 显式安装固定 npm）以根治 lockfile 漂移。
- 最后更新：2026-09-13

## AI chat 路由流式/缓存/RAG 接线补齐测试（PR #53）

- 状态：DONE（PR #53 已以 `--rebase` 合并进 main）
- 工作分支：`codex/ai-chat-route-tests`（已删除）
- PR：[#53](https://github.com/Sun1090/trade-buty/pull/53) · `MERGED`
- Base：`origin/main@1c3962e`
- 合并提交：`9faeb58`
- 已验证 Head：`f9075b4`
- 本地提交：`f9075b4` `test(ai): cover the chat route streaming, cache and RAG wiring`
- 目标：`src/app/api/ai/chat/route.ts` 是流式 AI 问答主入口，覆盖率只有 语句 37.14% / 分支 12.5% / 函数 37.5% / 行 37.62%，流式分支、缓存写入与 RAG 接线基本没有测试，改动这些路径时没有回归网。
- 已完成：`src/app/api/ai/chat/route.test.ts` 从 6 例扩到 20 例，覆盖流式响应拼装、缓存命中与实际写入、RAG 检索接线、错误与限流分支。
- 变更文件（关键）：`src/app/api/ai/chat/route.test.ts`。
- 验证命令与结果：
  - 单文件覆盖率提升到 **语句 96.19% / 分支 87.5% / 函数 87.5% / 行 99%**（原 37.14% / 12.5% / 37.5% / 37.62%）。
  - `npm test` exit 0 → **251 文件 / 1862 用例**通过；`npm run lint` / `npm run typecheck` exit 0。
  - PR CI `ci` + `db-tests` 全绿；Vercel 因配额 `Deployment rate limited` 未产出预览，属外部状态而非代码问题。
- 上游依赖：无；`content/kline-buty` 未变更。
- 未验证项：无。
- 风险与回滚：纯测试新增，不改运行时行为；回滚 = 撤销 PR #53。
- 下一步：无（已完成）。
- 最后更新：2026-09-13

## sitemap lastmod 探测可注入化并补覆盖（PR #51）

- 状态：DONE（PR #51 已以 `--rebase` 合并进 main；rebase 后 PR CI run [34739929986](https://github.com/Sun1090/trade-buty/actions/runs/34739929986) 全绿）
- 工作分支：`codex/kb-freshness-testable`（已删除）
- PR：[#51](https://github.com/Sun1090/trade-buty/pull/51) · `MERGED`
- Base：`origin/main@9faeb58`
- 合并提交：`4c162b7`
- 已验证 Head：`407b591`
- 本地提交：`407b591` `refactor(kb): make sitemap lastmod probing injectable and covered`
- 目标：`src/lib/kb-freshness.ts` 决定 sitemap 每条课程页的 `lastmod`（R13.17），但此前只有 `parseKbCommitDate` 有单测，文件覆盖率 36.8%。真正决定「能不能拿到时间」的逻辑——`git rev-parse --show-toplevel` 的错仓库守卫、`git log` 抛错兜底、目录不存在兜底——全部不可测：`readKbCommitDate` 是私有函数且直接调 `execFileSync`，模块还用私有 `cached` 变量做进程内缓存、测试无法重置。若把「父仓库根目录 ≠ 子模块目录」这条守卫写错（正是防止拿站点仓库提交时间当内容更新时间的那条），所有 `lastmod` 会静默变错而没有任何测试会红。
- 已完成：
  - 把副作用收进可注入的 `KbFreshnessDeps`（`exists` / `execGit`），导出纯函数 `readKbCommitDate(dir, deps)`；缓存移进 `createKbLastModifiedReader(resolveDir, deps)` 工厂，生产导出的 `kbLastModified()` 仍是同一个带缓存实例——**`src/app/sitemap.ts` 零改动，运行时行为不变**。
  - 测试 3 → 12 用例：目录缺失（且不调 git）、toplevel 不等（且只问一次就否决）、git 抛错、log 输出不可解析、相对路径 toplevel 归一化、命中/未命中两种缓存行为，以及生产默认实例「不抛错且同进程结果稳定」的契约。
- 变更文件（关键）：`src/lib/kb-freshness.ts`、`src/lib/kb-freshness.test.ts`。
- 验证命令与结果：
  - `npx vitest run src/lib/kb-freshness.test.ts` exit 0 → 1 文件 / 12 用例。
  - `npx vitest run --coverage src/lib/kb-freshness.test.ts` → 该文件 **100% 语句 / 100% 分支 / 100% 函数 / 100% 行**（原 36.8% / 0% / 50% / 33.3%）。
  - `npm test` exit 0 → 251 文件 / 1856 用例通过；`npm run lint` exit 0；`npx tsc --noEmit` exit 0。
  - rebase 后 PR CI exit 0：`ci` + `db-tests` 全绿；CodeQL 两个语言 job pass。
- 上游依赖：无；`content/kline-buty` 未变更。
- 未验证项：无。
- 风险与回滚：纯重构 + 测试，运行时行为不变；回滚 = 撤销 PR #51。
- 下一步：无（已完成）。
- 最后更新：2026-09-13

## 让 Dependabot 不再重开必然红灯的 major（PR #50）

- 状态：DONE（PR #50 已以 `--rebase` 合并进 main）
- 工作分支：`codex/dependabot-ignore-blocked-majors`（已删除）
- PR：[#50](https://github.com/Sun1090/trade-buty/pull/50) · `MERGED`
- Base：`origin/main@cc1a3f1`
- 合并提交：`1c3962e`
- 已验证 Head：`2234fcc`
- 本地提交：`2234fcc` `chore(deps): stop dependabot from re-opening blocked major bumps`
- 目标：`docs/deps.md` 已记录 `eslint@10` 与 `typescript@7` 在当前依赖链上实测失败（`eslint-plugin-react` peer 仍是 `eslint ^9`；`typescript-eslint` peer 是 `typescript <6.1.0`），但 Dependabot 每周仍开出这两个必然红灯的 PR（#47 / #48），把「必须人工判断的延期」伪装成「待合并的更新」。
- 已完成：`.github/dependabot.yml` 的 npm 条目加 `ignore`，只挡 `eslint@10.x` 与 `typescript@7.x`，不影响 minor/patch 分组，也不挡 11.x / 8.x；`scripts/ci-workflow.test.mjs` 增回归用例锁定这两条忽略；`docs/deps.md` 补说明与解除条件。#47 / #48 已关闭并附实测证据。
- 变更文件（关键）：`.github/dependabot.yml`、`scripts/ci-workflow.test.mjs`、`docs/deps.md`。
- 验证命令与结果：`npx vitest run scripts/ci-workflow.test.mjs` exit 0 → 1 文件 / 18 用例（新增 1 例）；`npm run check:docs` exit 0；`npm run lint` exit 0；PR CI 全绿。
- 上游依赖：无；`content/kline-buty` 未变更。
- 未验证项：无。
- 风险与回滚：只影响 Dependabot 排期，不碰运行时；解除条件（上游放宽 peer）成立后必须先删对应 ignore 再升级。回滚 = 撤销 PR #50。
- 下一步：无（已完成）。
- 最后更新：2026-09-13

## CI 覆盖率地板门禁（PR #49）

- 状态：DONE（PR #49 已以 `--rebase` 合并进 main）
- 工作分支：`codex/coverage-gate`（已删除）
- PR：[#49](https://github.com/Sun1090/trade-buty/pull/49) · `MERGED`
- Base：`origin/main@6d2e29c`
- 合并提交：`cc1a3f1`
- 已验证 Head：`c227503`
- 本地提交：`c227503` `ci(coverage): enforce a coverage floor in CI`
- 目标：v0.6 关账标准要求「测试覆盖范围不下降」，但 CI 只跑 `npm test`（Vitest，无覆盖度统计），没有任何门禁证明覆盖率没退化——新增代码可以完全不带测试而全绿。
- 已完成：新增 `@vitest/coverage-v8@5.0.0` devDependency；`vitest.config.mts` 配置 `coverage` 与阈值地板；新增 `npm run test:coverage`（`vitest run --coverage`）与 `pretest:coverage`；CI 的 `ci` 作业由 `npm run test` 换成 `npm run test:coverage`；`eslint.config.mjs` 全局忽略 `coverage/**`（否则本地跑过覆盖率后 lint 会去检查 lcov HTML 产物而误报）；`scripts/ci-workflow.test.mjs` 增门禁守卫；`docs/ops.md` / `docs/deps.md` 同步。
- 阈值：地板取 **语句 84 / 分支 77 / 函数 83 / 行 87**，2026-09-13 实测基线为 语句 86.45% / 分支 79.31% / 函数 84.84% / 行 89%，向下留约 2 个百分点吸收本地（Node 26）与 CI（Node 22）的 V8 计数差异。**Node 22 CI 实测与本地完全一致**（86.45 / 79.31 / 84.84 / 89）。
- 验证命令与结果：
  - `npm ci` exit 0；lockfile 仅新增 8 个包条目、无删除无关条目。
  - `npm run test:coverage` exit 0 → 251 文件 / 1847 用例，四项均高于地板。
  - 反证门禁真会拦：`npx vitest run --coverage --coverage.thresholds.lines=99 src/lib/date-utils.test.ts` exit 1，报 `Coverage for lines (92.85%) does not meet global threshold (99%)`。
  - `npx vitest run scripts/ci-workflow.test.mjs` exit 0（1 文件 / 17 用例）；`npm run lint` / `typecheck` / `build` exit 0；`check:docs` / `check:secrets` / `check:changelog` / `check:env-docs` / `check:kb-pointer` / `check:kb-changelog` / `check:mobile` / `check:bundle` / `check:search-index` / `check:links` / `check:sitemap` / `check:seo-surface` / `check:structured-data` 全部 exit 0。
- 上游依赖：无；`content/kline-buty` 未变更。
- 未验证项：无。
- 风险与回滚：纯质量门禁，不改运行时行为；主要风险是新依赖的 lockfile 变更，已用官方 registry 解析并经 `npm ci` + 全量门禁验证。若 CI 的 V8 计数与本地差异超预期，先按实测收紧/放宽阈值并附测量证据。回滚 = 撤销 PR #49。
- 下一步：无（已完成）。覆盖率最低的若干文件（`language-toggle` / `service-worker-registrar` / `share-card-preview` / `replay-trainer` / `toc` / `review-client` / `api/ai/quiz`）可作为后续补测候选。
- 最后更新：2026-09-13

## 固定 GitHub Actions 并接入 Dependabot（PR #46）

- 状态：DONE（PR #46 已以 `--rebase` 合并进 main）
- 工作分支：`codex/pin-actions`（已删除）
- PR：[#46](https://github.com/Sun1090/trade-buty/pull/46) · `MERGED`
- Base：`origin/main@c348e33`
- 合并提交：`6d2e29c`
- 已验证 Head：`feec4d9`
- 本地提交：`feec4d9` `ci(workflows): pin actions and track dependency updates`
- 目标：工作流里的 `uses:` 仍用浮动的 `@vN` 标签，上游 tag 被移动或发布破坏性更新时 CI 行为会静默改变；同时仓库没有依赖更新跟踪。
- 已完成：把官方 GitHub Actions 固定到完整 commit SHA 并保留可追踪的 `# vN` 注释；新增 Dependabot，每周跟踪 npm 与 GitHub Actions，npm 的 minor/patch 分组；工作流回归门禁会拦截未固定的 action 与 Dependabot 配置漂移。
- 变更文件（关键）：`.github/workflows/*.yml`、`.github/dependabot.yml`、`scripts/ci-workflow.test.mjs`。
- 验证命令与结果：`npx vitest run scripts/ci-workflow.test.mjs` exit 0（16 用例）；`npm run lint` exit 0；`npm test` exit 0 → 251 文件 / 1846 用例；`npm run check:docs` / `npm run check:secrets` exit 0。
- 上游依赖：无；`content/kline-buty` 未变更。
- 未验证项：无。
- 风险与回滚：SHA 固定后需要人工/Dependabot 推进版本，安全性优于便利性；回滚 = 撤销 PR #46。
- 下一步：无（已完成）。
- 最后更新：2026-09-13

## 声明支持的 Node 版本并刷新 js-yaml（PR #45）

- 状态：DONE（PR #45 已以 `--rebase` 合并进 main）
- 工作分支：`codex/node-toolchain`（已删除）
- PR：[#45](https://github.com/Sun1090/trade-buty/pull/45) · `MERGED`
- Base：`origin/main@26fb697`
- 合并提交：`c348e33`
- 已验证 Head：`4170e76`
- 本地提交：`4170e76` `chore(toolchain): declare supported Node and refresh js-yaml`
- 目标：CI 已固定 Node.js 22，但 `package.json` 没有 `engines`，本地用 Node 26 或更老版本都不会得到提示；README 的 Quick Start 用 `npm install` 而非可复现的 `npm ci`；`js-yaml` 当日发布 5.4.2 patch 未跟进。
- 已完成：根 `package.json` 新增 `engines.node >=22`；README / CONTRIBUTING / 运维文档明确 Node.js 22 要求；Quick Start 改用 `npm ci`；`js-yaml` 5.4.1 → 5.4.2 及 lockfile。
- 变更文件（关键）：`package.json`、`package-lock.json`、`README.md`、`README.zh-CN.md`、`CONTRIBUTING.md`、`docs/ops.md`。
- 验证命令与结果：`npm ci` exit 0；`npm run lint` exit 0；`npm test` exit 0 → 251 文件 / 1845 用例；`npm run typecheck` / `build` / `check:docs` / `check:changelog` / `audit:all` 全部 exit 0。
- 上游依赖：无；`content/kline-buty` 未变更。
- 未验证项：无。
- 风险与回滚：`engines` 只对 `engine-strict` 生效，属提示性约束，不改变安装行为；回滚 = 撤销 PR #45。
- 下一步：无（已完成）。
- 最后更新：2026-09-13

## 清理 main 上剩余的 CodeQL 告警（PR #44）

- 状态：DONE（PR #44 已以 `--rebase` 合并进 main）
- 工作分支：`codex/codeql-alert-hardening`（已删除）
- PR：[#44](https://github.com/Sun1090/trade-buty/pull/44) · `MERGED`
- Base：`origin/main@d3de36d`
- 合并提交：`26fb697`
- 已验证 Head：`d3d8761`
- 本地提交：`d3d8761` `fix(security): resolve remaining codeql alerts`
- 目标：main 上仍有 3 个 CodeQL 告警（2 个 React `key`、1 个 TOC 畸形标签重组清理），必须清零而不是长期挂着。
- 已完成：`src/lib/toc.ts` 改为单次扫描处理标题内联 HTML，嵌套畸形标签不再跨边界拼回可注入标签，并补精确回归断言；首页与 404 推荐位的静态列表改用稳定的列表索引作为 React key（该值不会渲染到 DOM）。
- 变更文件（关键）：`src/lib/toc.ts`、`src/lib/toc.test.ts`、首页与 404 组件。
- 验证命令与结果：`npm test` exit 0 → 251 文件 / 1845 用例；`npm run lint` / `typecheck` / `build`（474 静态页）exit 0；`npm run check:structured-data` exit 0（454 页 / 5656 实体）；`check:docs` / `check:env-docs` / `check:secrets` exit 0。
- 上游依赖：无；`content/kline-buty` 未变更。
- 未验证项：无。
- 风险与回滚：列表顺序为构建期静态顺序且不做客户端重排，索引 key 不影响渲染身份；TOC 继续支持 `<mark>` 内文字，畸形标签整段移除。回滚 = 撤销 PR #44。
- 下一步：无（已完成）。
- 最后更新：2026-09-13

## 加固动态渲染与序列化面（PR #43）

- 状态：DONE（PR #43 已以 `--rebase` 合并进 main）
- 工作分支：`codex/security-hardening`（已删除）
- PR：[#43](https://github.com/Sun1090/trade-buty/pull/43) · `MERGED`
- Base：`origin/main@71d85a4`
- 合并提交：`d3de36d`
- 已验证 Head：`dde23cb`
- 本地提交：`dde23cb` `fix(security): harden dynamic rendering surfaces`
- 目标：知识库内容与用户可控片段会进入动态 `href`、JSON-LD、TOC、FAQ 表格等渲染面；畸形输入或正则回溯会造成注入或 DoS 风险。
- 已完成：新增知识库路径构造函数，验证 locale 与英文 slug，避免动态 `href` 接受 URL scheme / 路径穿越值；JSON-LD 序列化转义 `<`、`>`、`&`、U+2028/U+2029，阻止 `</script>` 逃逸；清理 TOC 标题中的畸形 HTML 标签；移除 env-docs 中可能灾难回溯的正则，改为状态机式前导注释解析；FAQ 表格单元格同时转义反斜杠与竖线；为上述安全边界补回归测试。
- 变更文件（关键）：知识库路径构造模块、JSON-LD 序列化、`src/lib/toc.ts`、`scripts/check-env-docs.mjs`、FAQ 表格渲染与相应用例。
- 验证命令与结果：`npm run lint` exit 0；`npm test` exit 0 → 251 文件 / 1845 用例；`npx tsc --noEmit` exit 0；`npm run build` exit 0（474 静态页）；`npm run check:structured-data` exit 0（454 页 / 5656 实体）；`check:env-docs` / `check:docs` exit 0。
- 上游依赖：无；`content/kline-buty` 未变更。
- 未验证项：无。
- 风险与回滚：属 fail-closed 加固，非法输入会被拒绝而不是降级渲染；回滚 = 撤销 PR #43。
- 下一步：无（已完成）。
- 最后更新：2026-09-13

## 贡献与架构文档收口（Q5.1/Q5.2 文档一致性）

- 状态：DONE（PR #41 已以 `--rebase` 合并进 main；PR CI run [34728712232](https://github.com/Sun1090/trade-buty/actions/runs/34728712232) 与合并后 main CI run [34728985414](https://github.com/Sun1090/trade-buty/actions/runs/34728985414) 均全绿）
- 工作分支：`codex/docs-contributing-architecture`（已删除）；本轮记录分支：`codex/progress-doc-guides`
- PR：[#41](https://github.com/Sun1090/trade-buty/pull/41) · `MERGED`
- PR 状态：MERGED
- Base：`origin/main@da815ae`
- 合并提交：`e551cde`
- 已验证 Head：`58185d0`
- 本地提交：`58185d0` `docs(project): add contribution and architecture guides`
- 目标：README 仍把已接入的 Vitest 写成 `Vitest-ready`，并引用已不存在的 `middleware.ts`；仓库缺少统一的贡献/发布入口和当前架构事实索引，文档会继续随实现漂移且新贡献者没有可执行的 PR、知识库、数据库与安全检查清单。
- 已完成：
  - 新增 `CONTRIBUTING.md`：覆盖 Node.js 22、submodule、`npm ci`、开发/测试/构建命令、Angular Convention、一提交一主题、禁止 AI sign-off、`codex/` 分支、禁止直推 main、rebase merge、知识库只读与 `kb:update` 流程、内容宪法、数据库/RLS/安全/隐私要求及 PR 清单。
  - 新增 `docs/architecture.md`：记录 Next.js 16 App Router、语言/根级静态代理、知识库 prebuild 与搜索索引、Supabase Auth/Postgres/RLS 和本地优先双写、OpenAI 格式 AI/RAG、分享/PWA/缓存/安全/可观测性，以及 Vitest、Playwright、Lighthouse 和 db-tests 的 CI 分层。
  - 双语 README 将 `Vitest-ready` 修正为实际 Vitest，将 `middleware.ts` 修正为 `src/proxy.ts`，更新 docs 结构并链接贡献指南与架构文档。
  - `check:docs` 新增 README 实现引用、贡献契约和架构事实审计；缺失/过时描述会 exit 1，并新增正向与失败用例锁定审计器。
- 变更文件（关键）：`CONTRIBUTING.md`、`docs/architecture.md`、`README.md`、`README.zh-CN.md`、`scripts/check-docs-consistency.mjs`、`scripts/docs-consistency-lib.mjs`、`scripts/docs-consistency-lib.test.mjs`。
- 验证命令与结果：
  - `npx vitest run scripts/docs-consistency-lib.test.mjs` exit 0 → 1 文件 / 8 用例通过。
  - `npm run check:docs` / `npm run lint` / `npm run typecheck` / `npm run check:changelog` / `npm run check:secrets` exit 0；secrets 扫描 660 个文本文件。
  - `npm test` exit 0 → **250 文件 / 1840 用例**通过；`npm run build` exit 0 → 418 个搜索索引条目、364 个标题、474 个静态页。
  - `npm run audit:prod` / `npm run audit:all` exit 0 → 均 0 vulnerabilities；`git diff --check` exit 0。
  - PR CI run 34728712232 exit 0：`ci` 5m50s + `db-tests` 47s；Vercel Preview pass。合并后 main CI run 34728985414 exit 0：`ci` 5m57s + `db-tests` 42s。
- 上游依赖：无；`content/kline-buty@a57d510` 未变更。
- 未验证项：无。
- 风险与回滚：文档与审计器变更，不改变运行时行为；新增门禁按 fail-closed 设计，文档缺失或残留历史实现都会阻断 CI。回滚 = 撤销 PR #41。
- 下一步：无（已完成）。
- 最后更新：2026-09-13

## 知识库内容 hash 基线门禁（R10.7 fail closed）

- 状态：DONE（PR #39 已以 `--rebase` 合并进 main；PR CI run [34727201817](https://github.com/Sun1090/trade-buty/actions/runs/34727201817) 与合并后 main CI run [34727434239](https://github.com/Sun1090/trade-buty/actions/runs/34727434239) 均全绿）
- 工作分支：`codex/kb-hash-baseline-gate`（已删除）
- PR：[#39](https://github.com/Sun1090/trade-buty/pull/39) · `MERGED`
- PR 状态：MERGED
- Base：`origin/main@6e66db0`
- 合并提交：`23e3ebe`
- 已验证 Head：`32c78b3`
- 本地提交：`32c78b3` `feat(ops): gate knowledge base hash drift`
- 目标：`check:kb-pointer` 只能证明 gitlink、工作区 submodule 与 manifest 的 commit 指针一致，不能证明 manifest 中逐文件 sha256 真的对应当前内容。若基线缺失或内容在快照外漂移，既有 changelog 脚本会生成文件而不是稳定阻断，CI 存在假绿空间。
- 已完成：
  - `scripts/check-kb-changelog.mjs` 新增只读 `--check` 模式：内容新增、修改或删除时打印具体路径并 exit 1；hash 基线缺失时 fail closed，exit 1；普通模式继续保留生成 `docs/kb-changelog-YYYY-MM-DD.md` 的运营行为。
  - `package.json` 新增 `check:kb-changelog`，CI 在 `check:kb-pointer` 后执行；CI 路径不会写文件，漂移必须由 `npm run kb:update` 完整同步并提交 submodule 指针、manifest 与变更记录。
  - `scripts/check-kb-changelog.test.mjs` 增加 3 条 CLI 回归：一致通过且不写产物、内容漂移阻断并列出路径、缺失基线阻断；`scripts/ci-workflow.test.mjs` 锁定 CI 必须调用该门禁。
  - `docs/ops.md` 登记门禁语义及与 `check:kb-pointer` 的分工；`docs/roadmap.md` 的 Q1.6 同步说明 hash 基线已由 CI 核对。
  - 未把 `kb:parity --strict` 接入 CI：`AGENTS.md` 明确 en 可逐步补齐翻译；当前 zh/en 各 27 章全齐只是运营事实，不能把它伪装成与知识库契约冲突的长期全量阻断门禁，`kb:parity` 继续作为人工运营检查。
- 变更文件（关键）：`scripts/check-kb-changelog.mjs`、`scripts/check-kb-changelog.test.mjs`、`scripts/ci-workflow.test.mjs`、`package.json`、`.github/workflows/ci.yml`、`docs/ops.md`、`docs/roadmap.md`、`docs/progress.md`。
- 验证命令与结果：
  - `npx vitest run scripts/check-kb-changelog.test.mjs scripts/ci-workflow.test.mjs` exit 0 → 2 文件 / 18 用例通过。
  - `npm run lint` / `npm run typecheck` exit 0；`npm test` exit 0 → **250 文件 / 1837 用例**通过。
  - `npm run build` exit 0 → 474 静态页；`npm run e2e` exit 0 → **93/93** 通过。
  - `check:kb-changelog` / `check:kb-pointer` / `check:translation-history` / `check:kb-parity-budget` / `check:docs` / `check:changelog` / `check:seo-surface` / `check:search-index` 全部 exit 0。
  - `npm run kb:parity` exit 0：zh/en 各 27 章，缺失 0；当前 submodule `a57d510`，419 篇 Markdown，manifest 419 个 hash，漂移 0。
  - PR CI run 34727201817 exit 0：`ci` 5m02s + `db-tests` 41s；Vercel Preview pass。合并后 main CI run 34727434239 exit 0：`ci` 5m43s + `db-tests` 39s。
- 上游依赖：`kline-buty@a57d510`；本轮无上游更新。
- 未验证项：无。
- 风险与回滚：新增门禁会把未同步的 KB 内容漂移变成显式红灯，这是预期信号；修复必须走完整 `kb:update` 流程，不允许手改 hash 或让 CI 自动写快照。回滚 = 撤销 PR #39。
- 下一步：无（已完成）。
- 最后更新：2026-09-13

## 外链巡检空集假绿修复（link-patrol fail closed）

- 状态：DONE（PR #37 已以 `--rebase` 合并进 main；PR CI run [34725572623](https://github.com/Sun1090/trade-buty/actions/runs/34725572623) 与合并后 main CI run [34725882320](https://github.com/Sun1090/trade-buty/actions/runs/34725882320) 均全绿）
- 工作分支：`codex/link-patrol-falsifiable`（已删除）
- PR：[#37](https://github.com/Sun1090/trade-buty/pull/37) · `MERGED`
- PR 状态：MERGED
- Base：`origin/main@c0321c7`
- 合并提交：`04d09e4`
- 已验证 Head：`f5afe09`
- 本地提交：`793bac9` `fix(ops): fail link patrol on empty inputs` + `cf033cc` `test(ops): cover link patrol empty and HTTP failures` + `f5afe09` `docs(progress): record PR #37 for link patrol hardening`
- 目标：`scripts/link-patrol.mjs` 对不存在的知识库目录静默返回空文件集，并在扫描结果为 0 个外链时输出“✅ 全部健康”且 exit 0。这样一旦 submodule 未初始化、目录结构漂移或链接提取器失效，月度巡检会把“根本没有执行任何有效检查”误报为通过。
- 已完成：
  - 脚本改为 fail closed：知识库目录缺失、路径不是目录、目录内无 Markdown、零外链四种情况均返回可操作错误并 exit 1。
  - 当前知识库 419 篇 Markdown、0 个外链，默认巡检按设计 exit 1；只有显式设置 `LINK_PATROL_ALLOW_EMPTY=1` 才放行空集，并在输出中明确标注“显式放行空集”。
  - 抽出 `listMarkdownFiles` / `extractExternalLinks` / `collectExternalLinks` / `checkExternalLink` / `patrolExternalLinks` / `run` 可测试边界；`checkExternalLink` 注入 `fetchImpl`，保留 HEAD、403/405 降级 GET、10s 超时与网络错误重试语义。
  - `scripts/link-patrol.test.mjs` 新增 15 条用例：HTTP/HTTPS 去重、目录递归、HEAD/GET fallback、瞬时网络错误重试、超时、HTTP 失败、三层空集、坏链出处及真实本地 HTTP 退出码。
  - `scripts/ci-workflow.test.mjs` 新增守卫：外链巡检工作流必须保留 `npm run ops:link-patrol`，且不得把 `LINK_PATROL_ALLOW_EMPTY` 写死，避免空集豁免重新变成假绿。
  - `docs/ops.md` 登记 fail-closed 语义、人工空集豁免命令与“CI 不设置豁免”的约束。
- 变更文件（关键）：`scripts/link-patrol.mjs`、`scripts/link-patrol.test.mjs`、`scripts/ci-workflow.test.mjs`、`docs/ops.md`、`docs/progress.md`。
- 验证命令与结果：
  - `npx vitest run scripts/link-patrol.test.mjs scripts/ci-workflow.test.mjs` exit 0 → 2 文件 / 30 用例通过。
  - `npm run lint` / `npm run typecheck` exit 0；`npm test` exit 0 → **249 文件 / 1834 用例**通过。
  - `npm run build` exit 0 → 474 静态页；`npm run check:mobile`、内容/SEO/链接/结构化数据/bundle 全部门禁 exit 0。
  - `npm run e2e` exit 0 → **93 用例**通过；`npm run lhci` exit 0。
  - `npm run audit:prod` / `npm run audit:all` exit 0（0 vulnerabilities）；`npm run check:secrets`（657 文本文件）exit 0。
  - 当前知识库实测：默认 `npm run ops:link-patrol` exit 1，明确报告 419 篇 Markdown / 0 外链；`LINK_PATROL_ALLOW_EMPTY=1 npm run ops:link-patrol` exit 0，并打印“显式放行空集”。
  - PR CI run 34725572623 exit 0：`ci` 6m02s（lint / 1834 tests / typecheck / build / 内容门禁 / 93 e2e / Lighthouse）+ `db-tests` 42s；Vercel 预览 SUCCESS。
  - 合并后 main CI run 34725882320 exit 0：`ci` 4m50s + `db-tests` 37s。
- 上游依赖：无。
- 未验证项：无。
- 风险与回滚：修复后零外链状态会让月度巡检保持可见失败，这是刻意的信号而非误报；若内容团队确认长期不需要外链，只能在人工确认后使用环境变量显式豁免，不允许写进 CI。回滚 = 撤销 PR #37 的三个提交。
- 下一步：无（已完成）。
- 最后更新：2026-09-13

## 根级软 404 与分享落地页修复（proxy 静态表面显式放行）

- 状态：DONE（PR #36 已以 `--rebase` 合并进 main；PR CI run [34724588395](https://github.com/Sun1090/trade-buty/actions/runs/34724588395) 与合并后 main CI run [34724932429](https://github.com/Sun1090/trade-buty/actions/runs/34724932429) 均全绿）
- 工作分支：`codex/proxy-static-surface`（已删除）
- PR：[#36](https://github.com/Sun1090/trade-buty/pull/36) · `MERGED`
- PR 状态：MERGED
- Base：`origin/main@e65dc3a`
- 合并提交：`c0321c7`
- 已验证 Head：`a178835`
- 本地提交：`41a29a4` `fix(proxy): serve the root static surface honestly` + `e5f28e6` `test(e2e): guard the root static surface contract` + `c0321c7` `docs(progress): record PR #36 for the static surface fix`
- 目标：`src/proxy.ts` 的 matcher 用 `.*\.\w+$` 兜住了所有带扩展名的路径，外加写得很宽的无扩展名白名单。副作用有两条相反的坏账：(1) **不存在的根级路径**（`/foo.png`、`/apple-icon`、`/sitemap.json`、`/knowledge-assets`）绕过代理直落根级动态段 `/[locale]`，被当成非法 locale 渲染出 HTTP 200 的首页外壳——一批既无 404 也无 `noindex` 的软 404；(2) **`/share/{kind}/{payload}` 分享落地页**本该原样放行（locale 编码在载荷里），却被补成 `/en/share/...` → 全站分享链接 404（生产线上 `https://trade-buty.vercel.app/share/quiz/v1abc` → 307 → 404 实测复现）。
- 已完成：
  - `src/proxy.ts`：matcher 改为**显式列举真实静态表面**并逐条锚定路径边界（`_next/`、`api/`、`favicon.ico$`、`icon$`、`manifest.webmanifest$`、`robots.txt$`、`sitemap.xml$`、`search-index.json$`、`sw.js$`、`offline.html$`、`knowledge-assets/`），新增导出 `LOCALE_FREE_PREFIXES = ["share"]` 并在 `proxy()` 里原样放行。
  - **更深的第二个 bug**：即使绕过代理，`src/app/share/[kind]/[path]/page.tsx` 仍会渲染 404 外壳——page 拿到的 `params.path` 是 percent-encoded 形态（`v1%7CeyJ...`），而 `generateMetadata` / `opengraph-image` 拿到的是已解码形态 `v1|eyJ...`，`detectKind` 在页面里因此解析失败。新增纯逻辑模块 `src/lib/share-landing.ts`（`normalizeShareSegment` / `resolveShareLanding` / `summarizeForMeta` / `kindToLocale`），page 与 metadata 共用同一条归一化路径；畸形 percent 序列返回 null 而非抛 500。
  - 删除 `public/` 下 5 个 Next 模板遗留 SVG（`file/globe/next/vercel/window.svg`，全仓无引用），让「`public/` 下的每个文件都必须被 matcher 放行」这条守卫只覆盖真实资产。
  - 新增 `e2e/static-surface.spec.ts`（19 用例）：不存在的根级路径最终 404；根级静态表面直连 200；知识库资产真实文件 200；`/share/{quiz,replay,streak}` 直连 200 且不被补前缀、CTA 语言由载荷决定；未知知识库 slug 仍是 200 + noindex 的软 404（未被误伤）。
  - `src/proxy.test.ts` 重写（17 用例）：含 `LOCALE_FREE_PREFIXES` 断言与 `public/` 全文件枚举守卫（`listPublicFiles()` 递归枚举 + 空集断言，新增静态文件漏登记即失败）。
  - `src/app/share/[kind]/[path]/page.test.ts` 重写为直接测 `@/lib/share-landing`（此前是「把 page 逻辑复制到测试里」的自证）；`src/lib/share-decode.test.ts` 补 percent-encoded 回归用例。
  - `package.json`：`e2e` 脚本登记新 spec；`docs/ops.md` 补「根级静态表面注记」；`docs/seo-surface.md` 补「软 404 与根级伪页面的边界」。
- 变更文件（关键）：`src/proxy.ts`、`src/lib/share-landing.ts`、`src/app/share/[kind]/[path]/page.tsx`、`e2e/static-surface.spec.ts`、`src/proxy.test.ts`、`package.json`、`docs/ops.md`、`docs/seo-surface.md`、`docs/progress.md`。
- 验证命令与结果：
  - PR CI run 34724588395 exit 0：`ci`（lint / 1819 tests / typecheck / build / 内容门禁 / Playwright 93 e2e / Lighthouse）+ `db-tests` 全绿；Vercel 预览 SUCCESS。
  - 合并后 main CI run 34724932429 exit 0。
  - 本地生产回归：`/share/quiz/<encoded>` → 200，title 正确；`/foo.png`、`/apple-icon`、`/sitemap.json` 等最终 404；`/[locale]/opengraph-image.png` 仍 200。
- 上游依赖：无。
- 未验证项：无。
- 风险与回滚：matcher 由通配改为显式清单后，**新增根级静态文件必须同步进 matcher**，否则会被补语言前缀而 404——这条由 `src/proxy.test.ts` 的 `public/` 全文件枚举守卫强制。回滚 = 撤销 PR #36 的三个提交。
- 下一步：无（已完成）。
- 最后更新：2026-09-13

## 根级路由被语言代理重定向的自动守卫（PR #33 回归）

- 状态：DONE（PR #35 已以 `--rebase` 合并进 main；PR CI 与合并后 main CI 均通过）
- 工作分支：`codex/root-route-guard`（分支保留，未删除）
- PR：[#35](https://github.com/Sun1090/trade-buty/pull/35) · `MERGED`
- PR 状态：MERGED
- Base：`origin/main@2369157`
- 已验证 Head：`3337fae`
- 合并提交：`e65dc3a`（PR CI run [34721908148](https://github.com/Sun1090/trade-buty/actions/runs/34721908148) `ci` + `db-tests` 全绿；合并后 main CI run [34722802083](https://github.com/Sun1090/trade-buty/actions/runs/34722802083) `ci` + `db-tests` 全绿）
- 本地提交：`test(e2e): guard root metadata routes against locale redirects`
- 目标：PR #33 修掉了 `/icon` 被语言代理 307 到 `/en/icon` → 404 的缺陷，但当时只有 manifest 图标间接覆盖这一个地址。`src/proxy.ts` 的 matcher 排除的是「带扩展名的静态文件 + 显式列举的几个根级路由」，而 Next 在根级暴露的元数据路由恰好**没有扩展名**（`/icon`、`/apple-icon`、`/opengraph-image`、`/twitter-image`…）。将来新增任何一个，同一类 404 会静默复发；此外 `npm run e2e` 用显式 spec 白名单驱动 Playwright，新增 `e2e/*.spec.ts` 若忘记登记会**不进 CI 且不报错**。
- 已完成：
  - 新增 `e2e/metadata-routes.spec.ts`：从构建产物 `.next/app-path-routes-manifest.json` 枚举全部根级单段路由（跳过 `_` 内部路由与 `[dynamic]` 模板），逐个以 `maxRedirects: 0` 断言「本站直接 200」且未被重定向到 `/{locale}<route>`；另有一条用例钉住已知路由集合，防止枚举出空集后测试静默变绿。
  - 负向验证（有牙齿）：临时从 `src/proxy.ts` matcher 摘掉 `(?:apple-)?icon(?:/|$)|` 并重建，新用例精确失败并报出 `/icon 被语言代理重定向到 /en/icon`；恢复后 6 条全绿。
  - 新增 `scripts/e2e-suite.test.mjs`（3 用例）：`e2e/` 下每个 `*.spec.ts` 必须被某个 `e2e` / `e2e:*` 脚本登记；登记的 spec 文件必须真实存在；视觉基线 `visual.spec.ts` 固定不进 CI 套件（R7.8）。
  - `package.json`：`e2e` 脚本登记新 spec（68 → 74 条 Playwright 用例）。
  - `docs/ops.md`：`npm run e2e` 行补「根级元数据路由」，并新增「E2E 套件注记」说明显式清单的代价与对应机检。
- 变更文件（关键）：`e2e/metadata-routes.spec.ts`、`scripts/e2e-suite.test.mjs`、`package.json`、`docs/ops.md`、`docs/progress.md`。
- 验证命令与结果：
  - `npx playwright test e2e/metadata-routes.spec.ts` exit 0 → 6 用例通过；负向验证见上（修复前形态精确失败）。
  - `npx vitest run scripts/e2e-suite.test.mjs` exit 0 → 3 用例通过；负向验证：从脚本摘掉 `metadata-routes.spec.ts` 后报出「CI 静默不跑」并失败。
  - `npm run e2e` exit 0 → **74** 用例通过（此前 68）。
  - `npm run lint` / `npm run typecheck` / `npm run build`（474 静态页）exit 0。
  - `npm test` exit 0 → **248 文件 / 1807 用例**通过（此前 247/1804）。
  - `npm run check:docs` / `check:changelog` / `check:secrets`（659 文本文件）exit 0；`audit:prod` / `audit:all` exit 0（0 vulnerabilities）。
- 上游依赖：无。
- 未验证项：远端 PR CI 与合并后 main CI。
- 风险与回滚：新 spec 依赖 `.next/app-path-routes-manifest.json`（E2E 本来就要求先 build，缺失时抛带指引的错误）；若 Next 更换清单文件名，改一处路径常量即可。回滚 = 撤销本提交。
- 下一步：推送分支、开 PR、CI 全绿后 `gh pr merge --rebase`。
- 最后更新：2026-09-13


## PWA 图标元数据路由被语言代理重定向

- 状态：DONE（PR #33 已以 `--rebase` 合并进 main；PR CI 与合并后 main CI 均通过）
- 工作分支：`codex/icon-metadata-route`（分支保留，未删除）
- PR：[#33](https://github.com/Sun1090/trade-buty/pull/33) · `MERGED`
- PR 状态：MERGED
- Base：`origin/main@8ce77a6`
- 合并提交：`534c5fb`（PR CI run [34721000419](https://github.com/Sun1090/trade-buty/actions/runs/34721000419) `ci` + `db-tests` 全绿；合并后 main CI run [34721304452](https://github.com/Sun1090/trade-buty/actions/runs/34721304452) `ci` + `db-tests` 全绿）
- 已验证 Head：`21d4ca9`（见 PR #33 head）
- 本地提交：`fix(proxy): preserve Next icon metadata routes`（分支另含前置 `docs(progress): close out the ops gate coverage work` 收口提交）
- 目标：`src/app/icon.tsx` 由 Next 暴露为根级动态元数据路由 `/icon`，manifest 的两枚 512×512 图标与页面自动 `<link rel="icon">` 都直接引用该无扩展名地址；但 `src/proxy.ts` 的 matcher 只排除了带扩展名的静态文件，导致 `/icon` 被语言代理 307 到 `/en/icon`，最终返回 404 HTML。已用生产构建实测复现：修复前 `/icon` → `307 /en/icon` → `404 text/html`。
- 已完成：
  - `src/proxy.ts` matcher 精确排除 `icon` / `apple-icon`（使用路径边界，避免误伤 `/iconography` 等真实页面），不再重定向 Next 根级图标元数据路由。
  - `src/proxy.test.ts` 增加 `/icon`、`/apple-icon` 排除断言与 `/iconography` 同前缀不误伤断言（共 14 用例）。
  - `e2e/pwa-offline.spec.ts` 读取 manifest 后逐项请求 `icons[].src`，断言 HTTP 200 且响应 `content-type` 与 manifest 声明一致，防止 manifest 将来新增图标后再次出现不可达地址。
  - 生产回归：`npm run build` 后 `next start`，`/icon` 返回 `200 image/png`，文件识别为 512×512 PNG；`/iconography` 仍按语言 cookie 正确 307。
- 验证命令与结果：
  - `npx vitest run src/proxy.test.ts` exit 0 → 14 用例通过。
  - `npx playwright test e2e/pwa-offline.spec.ts` exit 0 → 7 用例通过。
  - `npm run build` exit 0 → 474 静态页面生成完成。
  - `npx eslint src/proxy.ts src/proxy.test.ts e2e/pwa-offline.spec.ts` exit 0。
- 上游依赖：无。
- 未验证项：无（Vercel 预览检查因账号构建配额 `upgradeToPro=build-rate-limit` 报 FAILURE，属外部配额而非代码问题；合并门禁以 GitHub Actions 全绿为准）。
- 风险与回滚：matcher 改动只放行两个精确路径；若需回滚，恢复单条 matcher 字符串并撤销对应测试即可。
- 下一步：无（已完成）。
- 最后更新：2026-09-13

## 门禁表覆盖机检（docs/ops.md ↔ ci.yml）

- 状态：DONE（PR #32 已以 `--rebase` 合并进 main；PR CI 与合并后 main CI 均通过）
- 工作分支：`codex/ops-gate-coverage`
- PR：[#32](https://github.com/Sun1090/trade-buty/pull/32) · `MERGED`
- PR 状态：MERGED
- Base：`origin/main@265dac3`
- 合并提交：`8ce77a6`（PR CI run [34720356967](https://github.com/Sun1090/trade-buty/actions/runs/34720356967) `ci` + `db-tests` 全绿；合并后 main CI run [34720648720](https://github.com/Sun1090/trade-buty/actions/runs/34720648720) `ci` + `db-tests` 全绿）
- 已验证 Head：`bb9da23`（见 PR #32 head）
- 本地提交：`docs(ops): register the db-tests gates and machine-check table coverage`
- 目标：`docs/ops.md` 表头声称「下表覆盖 `.github/workflows/ci.yml` 的全部执行步骤，并按实际顺序排列」，但整张表漏掉了 `db-tests` 作业（`docker pull` / `node scripts/db-test.mjs` / `npm run backup:drill`），且 `npx playwright install` 行排在流水线最末（实际在 `build` 与 `check:mobile` 之间）。该声明此前无任何门禁守护，会随工作流演进而静默漂移。
- 已完成：
  - `docs/ops.md`：补登 `db-tests` 作业的三行门禁（以 `db-tests ·` 前缀标注）；把 `npx playwright install --with-deps chromium` 行移到 `build` 与 `check:mobile` 之间，恢复实际顺序；表头改写为覆盖 `ci` / `db-tests` 两个作业，并注明覆盖与顺序由测试机检。
  - `scripts/ci-workflow.test.mjs` 新增两条守卫（共 15 用例）：
    - **覆盖**：抽取 `ci.yml` 所有 `npm run X` / `node scripts/*.mjs` / `npx playwright install` / `docker pull <image>` 门禁标识，逐一要求出现在 `docs/ops.md`；漏登记即失败。
    - **顺序**：解析质量门禁表首列命令的相对位置，要求与 `ci.yml` 的作业/步骤顺序单调一致。
  - 负向验证：
    - 删除 `db-tests · npm run backup:drill` 行 → 覆盖用例失败并报出 `backup:drill` 未登记；
    - 把 `npx playwright install` 行移回流水线末尾 → 顺序用例失败并报出该行乱序。
- 变更文件（关键）：`docs/ops.md`、`scripts/ci-workflow.test.mjs`、`docs/progress.md`。
- 验证命令与结果：
  - `npx vitest run scripts/ci-workflow.test.mjs` exit 0 → 15 用例通过（原 13，新增覆盖与顺序两条）；负向验证见上。
  - `npm run lint` exit 0；`npm run typecheck` exit 0。
  - `npm test` exit 0 → 247 文件 / 1803 用例通过。
  - `npm run build` exit 0 → 474 静态页面生成完成。
  - `npm run audit:prod` / `npm run audit:all` exit 0 → 0 vulnerabilities。
  - `npm run check:docs` / `npm run check:changelog` / `npm run check:secrets` exit 0。
- 上游依赖：无。
- 未验证项：无。
- 风险与回滚：只改文档与新增测试守卫，回滚单个提交即可；覆盖/顺序守卫可能对工作表结构敏感，已在测试注释中固定「首列命令参与顺序校验」的约定。
- 下一步：无（已完成）。
- 最后更新：2026-09-13

## CI 并发收敛（被取代的 PR 运行自动取消）

- 状态：DONE（PR #31 已以 `--rebase` 合并进 main；PR CI 与合并后 main CI 均通过）
- 工作分支：`codex/ci-concurrency`（分支保留，未删除）
- PR：[#31](https://github.com/Sun1090/trade-buty/pull/31) · `MERGED`
- PR 状态：MERGED
- Base：`origin/main@b2420bf`
- 合并提交：`265dac3`（PR CI run [34719607629](https://github.com/Sun1090/trade-buty/actions/runs/34719607629) `ci` + `db-tests` 全绿；合并后 main CI run [34719942378](https://github.com/Sun1090/trade-buty/actions/runs/34719942378) 全绿）
- 已验证 Head：`3239b6f`（见 PR #31 head）
- 本地提交：`ci(workflows): cancel superseded PR runs`
- 目标：PR #30 收尾时同一分支连续 push 触发了 3 个并行 CI run（只保留最新一个，手动取消了 2 个）。根因是 `ci.yml` 没有 `concurrency`：既浪费 runner 分钟，也让「最新提交是否绿」被旧 run 的结果稀释。本次给 PR 事件加并发收敛，同时保证 main 的每次 push 仍有独立完整门禁。
- 已完成：
  - `.github/workflows/ci.yml` 新增根级 `concurrency`：`group: ${{ github.workflow }}-${{ github.event_name == 'pull_request' && github.head_ref || github.run_id }}`，`cancel-in-progress: ${{ github.event_name == 'pull_request' }}`。PR 连推自动取消被取代的运行；main 的 push 以 `github.run_id` 分组，每个提交都有独立的完整门禁结果，不会被取消。
  - `scripts/ci-workflow.test.mjs` 新增守卫：`ci.yml` 必须声明 `concurrency`、`cancel-in-progress` 表达式含 `pull_request`、`group` 同时含 `github.head_ref` 与 `github.run_id`。负向验证：临时删除 `concurrency` 块后该用例失败并报出「ci.yml 缺少 concurrency 配置」。
  - `docs/ops.md` 门禁表下补「并发注记」。
- 变更文件（关键）：`.github/workflows/ci.yml`、`scripts/ci-workflow.test.mjs`、`docs/ops.md`、`docs/progress.md`。
- 验证命令与结果：
  - `npx vitest run scripts/ci-workflow.test.mjs` exit 0 → 13 用例通过；反向验证：临时删除 `concurrency` 块后该用例失败并报出「ci.yml 缺少 concurrency 配置」。
  - `npm run lint` exit 0；`npm run typecheck` exit 0。
  - `npm test` exit 0 → 247 文件 / 1801 用例通过。
  - `npm run build` exit 0 → 474 静态页面生成完成。
  - `npm run audit:prod` / `npm run audit:all` exit 0 → 均 `found 0 vulnerabilities`。
  - `npm run check:docs` / `npm run check:changelog` / `npm run check:secrets` exit 0。
- 上游依赖：无。
- 未验证项：无（PR #31 CI 与合并后 main CI 均绿）。
- 风险与回滚：只在 `pull_request` 事件取消被取代的运行；main 的 push 分组不含任何取消语义。回滚即删除 `concurrency` 块与对应守卫。
- 下一步：无（已完成）。
- 最后更新：2026-09-13

## CI actions 运行时对齐（workflow action parity）

- 状态：DONE（PR #30 已以 `--rebase` 合并进 main；PR CI 与合并后 main CI 均通过）
- 工作分支：`codex/ci-action-parity`（分支保留，未删除）
- PR：[#30](https://github.com/Sun1090/trade-buty/pull/30) · `MERGED`
- PR 状态：MERGED
- Base：`origin/main@e8be59c`
- 合并提交：`b2420bf`（rebase 后 main 上的 4 个提交：`7e9ef5a` / `6506301` / `27f1964` / `b2420bf`，合并后 main CI run [34719210967](https://github.com/Sun1090/trade-buty/actions/runs/34719210967) 全绿）
- 已验证 Head：`6fd15fa`（PR CI run [34718615164](https://github.com/Sun1090/trade-buty/actions/runs/34718615164) → `ci` 5m23s、`db-tests` 54s 全绿；Vercel 仍为平台 `Deployment rate limited`，外部因素）
- 本地提交：`ci(workflows): align link-patrol action runtimes and guard every workflow`、`docs(progress): backfill merged PR evidence for the 2026-09-12 batch`、`ci(workflows): pin least-privilege permissions and job timeouts`
- 目标：`ci.yml` 已升到 `actions/checkout@v7` / `actions/setup-node@v7`，但 `.github/workflows/link-patrol.yml` 仍停留在 `@v4`，会继续在月度巡检里触发 Node.js 20 弃用并漂移工具链。对齐后把结构守卫从只测 `ci.yml` 扩到全工作流，防止以后再漏。
- 已完成：
  - `.github/workflows/link-patrol.yml`：`actions/checkout@v4 → v7`、`actions/setup-node@v4 → v7`（Node 22 / npm cache 保持）。
  - `scripts/ci-workflow.test.mjs` 重构为发现并遍历 `.github/workflows/*.{yml,yaml}`：
    - 官方 actions 的 Node 24 最低 major 守卫覆盖所有工作流（含 `link-patrol.yml`）；
    - `setup-node` 统一 Node 22，凡执行 `npm ci` 的 job 必须 `cache: npm`；
    - 所有工作流里的 `npm run <script>` 与 `node scripts/*.mjs` 引用必须真实存在；
    - 新增外链巡检专项：cron `0 3 1 * *`、`workflow_dispatch`、checkout 递归子模块、`ops:link-patrol` 不被删除。
  - 反向验证守卫有效：临时把 `link-patrol.yml` 退回 `@v4` 后测试确实失败（10 用例中 1 失败，报出 checkout/setup-node 两处 stale）。
  - 权限与超时硬化：`.github/workflows/ci.yml` 与 `link-patrol.yml` 都显式声明顶层 `permissions: contents: read`（不依赖仓库默认值，防止以后默认放开为可写时被静默继承）；`ci` job 增 `timeout-minutes: 30`（正常约 6 分钟）、`patrol` job 增 `timeout-minutes: 15`，避免卡死吃满 runner 默认 6 小时上限。
  - 新增两条对应守卫：每个工作流必须有显式 `contents: read` 且不多授予其它权限；每个 job 必须有 (0, 60] 区间内的数值 `timeout-minutes`。反向验证：临时移除 `link-patrol.yml` 的权限与超时后两条用例均失败并报出文件与 job 名。
- 变更文件（关键）：`.github/workflows/ci.yml`、`.github/workflows/link-patrol.yml`、`scripts/ci-workflow.test.mjs`、`docs/progress.md`。
- 验证命令与结果：
  - `npx vitest run scripts/ci-workflow.test.mjs` exit 0 → 12 用例通过（原 7 用例）；反向验证：把 `link-patrol.yml` 临时退回 `@v4`、临时移除其 `permissions`、临时移除其 `timeout-minutes` 三处都实际触发失败并报出文件/job。
  - `npm run lint` exit 0（零 warning）；`npm run typecheck` exit 0。
  - `npm test` exit 0 → 247 文件 / 1798 用例通过。
  - `npm run build` exit 0 → 474 静态页面生成完成。
  - `npm run audit:prod` / `npm run audit:all` exit 0 → 均 `found 0 vulnerabilities`。
  - `npm run check:docs` / `npm run check:changelog` / `npm run check:secrets` exit 0。
- 上游依赖：无。
- 未验证项：无。
- 风险与回滚：仅改 action major、工作流权限/超时与测试，回滚单个提交即可；`link-patrol` 是月度定时任务，不阻塞主流水线。
- 下一步：`gh pr merge 30 --rebase`；随后单独开分支处理下拉后的新发现——同一 PR 连续 push 会并行起多个 workflow（本次 3 个 run 同时在跑，已手动取消 2 个），考虑给 PR 事件加 `concurrency` 自动取消被取代的运行。
- 最后更新：2026-09-13

## 工具链 major 升级（三个落地、两个按上游阻塞延期）

- 状态：DONE（PR #29 已以 `--rebase` 合并进 main，PR CI 与合并后 main CI 均通过）
- 工作分支：`codex/deps-major-upgrades`（合并后已删除）
- PR：[#29](https://github.com/Sun1090/trade-buty/pull/29) · `MERGED`
- Base：`origin/main@2828ef0`
- 远端 Head：`0d2b171`（PR CI run [34717899716](https://github.com/Sun1090/trade-buty/actions/runs/34717899716) 全绿）
- 合并提交：`e8be59c`（合并后 main CI run [34718207878](https://github.com/Sun1090/trade-buty/actions/runs/34718207878)）
- 本地提交：`chore(deps): align @types/node with the Node 22 CI runtime`、`chore(deps): upgrade js-yaml to v5 and adopt its ESM named exports`、`chore(deps): upgrade vitest to v5`、`fix(sync): type the user_settings upsert row explicitly`、`docs(deps): record the toolchain major upgrade outcomes`、`docs(deps): reconcile the monthly audit dispositions`
- 目标：把 2026-09-13 月度审计列出的五个 major 逐项实际安装并跑门禁，不把「可能不兼容」当结论；能升级的落地，不能升级的留下可复现阻塞证据，并修正审计表中的暂缓状态。
- 已完成：
  - `@types/node` 20.19.43 → **22.20.2**，与 CI 的 Node 22 运行时对齐。
  - 直接依赖 `js-yaml` 4.3.2 → **5.4.1**。v5 是 ESM 包且只有具名导出；将 `scripts/ci-workflow.test.mjs` 改为 `import { loadAll } from "js-yaml"`，避免 default import 在运行时变成 `undefined`。`gray-matter` 的 `js-yaml@3.15.2` 与 `@eslint/eslintrc` 的 `js-yaml@4.3.2` 继续通过 `overrides` 固定。
  - `vitest` 4.1.11 → **5.0.0**，全量测试通过。
  - `eslint` 10.10.0 延期：实跑 `npm run lint` exit 2，`eslint-plugin-react` 的 `contextOrFilename.getFilename` 与 ESLint 10 不兼容，且当前 peer 范围只声明到 ESLint 9。
  - `typescript` 7.0.2 延期：实跑 `npm run lint` exit 2，`typescript-eslint@8.70.0` 明确拒绝 TS 7；`tsc --noEmit` 本身可运行但不能单独代表整条工具链兼容。
  - TS 7 暴露出 `src/lib/sync-queue-executor.ts` 的 `user_settings` upsert 行类型过宽（`Record<string, number | string>`），被 Supabase 重载拒绝；改为具名行类型 `{ user_id: string; daily_goal_min?: number; weekly_goal_min?: number }`，在 TS 5.9.3 与 7.0.2 下均通过类型检查，运行时行为不变。
  - `docs/deps.md` 登记三个升级项的实测结果、两个延期项的可复现阻塞证据与解除条件，并把月度审计表中的「暂缓」状态改为最终处置。
  - 首次 PR CI 40s 失败：本机 npm 11 生成的锁文件缺失 14 个传递依赖，CI 的 Node 22 / npm 10.9.9 严格校验拒绝。改用 `npx --yes npm@10 install --package-lock-only --ignore-scripts` 重建锁文件（commit `e8be59c`），并新增约定：改依赖后必须用 `npx --yes npm@10 ci` 复验。
- 变更文件（关键）：`package.json`、`package-lock.json`、`scripts/ci-workflow.test.mjs`、`src/lib/sync-queue-executor.ts`、`docs/deps.md`、`docs/progress.md`。
- 验证命令与结果：
  - `npm test` exit 0 → 247 文件 / 1795 用例通过（Vitest 5.0.0）。
  - `npm run lint` exit 0（零 warning）；`npm run typecheck` exit 0；`npm ls --depth=0` exit 0。
  - `npx vitest run scripts/ci-workflow.test.mjs` exit 0。
  - `npx --yes npm@10 ci` exit 0（复现 CI 的 Node 22 / npm 10 环境，确认锁文件修复有效）。
  - `npm run audit:prod` exit 0、`npm run audit:all` exit 0 → 均 `found 0 vulnerabilities`。
  - `npm run check:secrets` exit 0（657 个文本文件无疑似凭据）；`npm run check:docs` exit 0。
- 上游依赖：ESLint 10 依赖 `eslint-plugin-react` 先声明/实现支持；TypeScript 7 依赖 `typescript-eslint` 先放宽 peer 并完成兼容。
- 未验证项：无。PR 流水线（`ci` 6m04s、`db-tests` 45s）与合并后 main 流水线均已通过；Vercel 预览因平台 `Deployment rate limited` 未产出，属外部限制，不阻塞合并。
- 风险与回滚：`js-yaml` 的 ESM 具名导出已由专项测试锁定；若 CI 发现其它间接导入面，回滚对应单个依赖提交即可。ESLint/TypeScript 未升级，不扩大现有风险面。
- 下一步：无（已完成）。后续工具链升级见 `docs/deps.md` 的解除条件。
- 最后更新：2026-09-13

## 依赖月度审计记录（Q5.3 的 2026-09-13 快照）

- 状态：DONE（PR #27 已以 `--rebase` 合并进 main；PR CI run [34717379666](https://github.com/Sun1090/trade-buty/actions/runs/34717379666) 与合并后 main CI run [34717692359](https://github.com/Sun1090/trade-buty/actions/runs/34717692359) 均通过）
- 工作分支：`codex/deps-monthly-audit`
- PR：[#27](https://github.com/Sun1090/trade-buty/pull/27)
- Base：`origin/main@cf0f92a`
- 远端 Head：`e3c930d`（PR 最终 head，CI 全绿）
- 本地提交：`docs(deps): record the 2026-09-13 monthly dependency audit`
- 目标：Q5.3 要求依赖月度审计，但 `docs/deps.md` 只有「安全基线」叙述，没有可回溯的月度日志；roadmap 里 2026-09-12 的记录也停留在文字上。补齐可审计的日志结构并刷新到 2026-09-13 的真实现状。
- 已完成：
  - `docs/deps.md`：新增「月度审计日志（Q5.3）」小节，规定每月跑 `audit:prod` + `audit:all` + `npm outdated` 并登记；填入 2026-09-13 记录 —— 两条 audit 均 `found 0 vulnerabilities`，`npm outdated` 只剩五个 major（`@types/node` 20.19.43→22.20.2、`eslint` 9.39.5→10.10.0、`js-yaml` 4.3.2→5.4.1、`typescript` 5.9.3→7.0.2、`vitest` 4.1.11→5.0.0），逐条写明暂缓理由。
  - `docs/roadmap.md`：Q5.3 一行刷新到 2026-09-13 的实测结果，并指向 `docs/deps.md` §月度审计日志；保留 2026-09-12 作为历史。
- 变更文件（关键）：`docs/deps.md`、`docs/roadmap.md`、`docs/progress.md`。
- 验证命令与结果：
  - `npm run audit:prod` → `found 0 vulnerabilities`（exit 0）。
  - `npm run audit:all` → `found 0 vulnerabilities`（exit 0）。
  - `npm outdated` → 仅五个包落后且全部是 major（无 minor/patch 待跟），已逐条登记。
  - `npm run check:secrets` exit 0；`npm run check:docs` exit 0；`npm run check:changelog` exit 0。
- 上游依赖：无（纯文档记录）。
- 未验证项：无（本分支两次推送的 CI 均 `ci` + `db-tests` 绿；Vercel 配额限流为已知外部因素，不阻塞合并）。
- 风险与回滚：纯文档，无运行时影响；回滚即撤销本分支提交。
- 下一步：无（已完成）。

## CI actions 升到 node24 运行时（清掉 GitHub 弃用注记）

- 状态：DONE（PR #26 已以 `--rebase` 合并进 main；PR CI run [34716936175](https://github.com/Sun1090/trade-buty/actions/runs/34716936175) 与合并后 main CI run [34717317958](https://github.com/Sun1090/trade-buty/actions/runs/34717317958) 均通过）
- 工作分支：`codex/ci-actions-node24`
- PR：[#26](https://github.com/Sun1090/trade-buty/pull/26)
- Base：`origin/main@cf0f92a`
- 远端 Head：`d9e61e0`（PR 最终 head，CI 全绿）
- 本地提交：`ci(actions): run official actions on node24 and guard against regressions`
- 目标：PR #24 的 CI 日志出现 GitHub 注记「Node.js 20 is deprecated…actions/checkout@v4、actions/setup-node@v4、actions/cache@v4、actions/upload-artifact@v4」。这些 v4 action 打包在 Node.js 20 上，被强制改用 Node.js 24 运行；GitHub 会逐步下线该兼容层，属于真实（非阻塞但有期限）的 CI 债务。
- 已完成：
  - `.github/workflows/ci.yml`：`actions/checkout@v4 → v7`、`actions/setup-node@v4 → v7`、`actions/cache@v4 → v6`、`actions/upload-artifact@v4 → v7`（四个 action 切到 node24 运行时的稳定 major；`ci` 与 `db-tests` 两个作业同步）。
  - `scripts/ci-workflow.test.mjs`：新增回归守卫，遍历所有作业的 `uses:`，对 `checkout/setup-node/cache/upload-artifact` 设最小 major（5/5/5/6），低于即失败并报出具体作业与版本。
  - `docs/ops.md`：门禁表下补「运行时注记」，说明这四个 action 的 node24 下限与守卫位置。
- 变更文件（关键）：`.github/workflows/ci.yml`、`scripts/ci-workflow.test.mjs`、`docs/ops.md`、`docs/progress.md`。
- 验证命令与结果：
  - `npx vitest run scripts/ci-workflow.test.mjs` → 7 用例通过（较 base 新增 1 例）。
  - 负向验证：临时把 `actions/checkout@v7` 改回 `@v4` 后该用例失败并打印 `ci: actions/checkout@v4`，恢复后通过。
  - `npm run lint` exit 0（`--max-warnings=0`）；`npm run typecheck` exit 0。
  - `npm test` → 242 文件 / 1759 用例通过（base `main@5bca7a6` 为 242 文件 / 1758 用例，本分支只多 1 例）。
  - `npm run check:secrets` exit 0；`npm run check:docs` exit 0。
- 上游依赖：无（仅 action major 升级，未新增依赖）。四个 action 要求 runner ≥ 2.327.1，GitHub 托管 `ubuntu-latest` 已满足。
- 未验证项：无（本 PR 的 CI 就是新版 action 的实跑验证：run `34716936175` → `ci` + `db-tests` pass）。
- 风险与回滚：若新版 action 的输入语义有变，PR 的 CI 会直接失败（不会静默通过）；回滚即把四个 `uses:` 改回原 major。
- 下一步：无（已完成）。
- 最后更新：2026-09-13

## 无专属单测模块补测（storage-json / lazy enqueue / network quality hook）

- 状态：DONE（PR #25 已以 `--rebase` 合并进 main；PR CI run [34716459119](https://github.com/Sun1090/trade-buty/actions/runs/34716459119) 与合并后 main CI run [34716756359](https://github.com/Sun1090/trade-buty/actions/runs/34716756359) 均通过）
- 工作分支：`codex/test-coverage-gaps`
- PR：[#25](https://github.com/Sun1090/trade-buty/pull/25) · `MERGED`
- 合并提交：`cf0f92a`
- Base：`origin/main@5bca7a6`
- 远端 Head：`140a333`（PR 最终 head，CI 全绿）
- 本地提交：`test(storage): cover localStorage JSON readers and fallbacks`、`test(sync): cover the lazy enqueue fallback boundary`、`test(network): cover the reactive network quality hook`
- 目标：扫描「被间接覆盖但无专属单测」的模块，挑出三个有真实分支逻辑的补测：`src/lib/storage-json.ts`（SSR / 损坏数据 / 非法数值回退）、`src/lib/sync-layer-queue-fallback.ts`（R9.6 动态 import 边界）、`src/components/use-network-quality.ts`（在线/慢速/离线重算与退订）。
- 已完成：
  - `src/lib/storage-json.test.ts`（10 例）：`isRecord` 只认普通对象；`readStorageJson` 解析成功、缺键返回 null、JSON 损坏返回 null、`getItem` 抛错（隐私模式）返回 null、SSR 无 storage 返回 null；`readNonNegativeNumber` 保留有限非负数并拒绝负数/NaN/Infinity/字符串；`readNonNegativeInteger` 四舍五入与回退。
  - `src/lib/sync-layer-queue-fallback.test.ts`（3 例）：`enqueueWrite` 通过 `vi.hoisted` 打桩，验证参数原样转发、多类别（含 `wrongbook-delete` / `replay-best`）转发、以及 `await` 之前不触达 store（保住 R9.6 的 chunk 拆分语义）。
  - `src/components/use-network-quality.test.tsx`（7 例，jsdom + `renderHook`）：默认 online、`navigator.onLine === false` → offline、`effectiveType === 3g` → slow、`saveData` → slow、窗口 `online`/`offline` 事件触发重算、connection `change` 事件触发重算、卸载时退订窗口与 connection 监听。
- 变更文件（关键）：`src/lib/storage-json.test.ts`、`src/lib/sync-layer-queue-fallback.test.ts`、`src/components/use-network-quality.test.tsx`、`docs/progress.md`。
- 验证命令与结果：
  - `npx vitest run src/lib/storage-json.test.ts` → 10 通过；`npx vitest run src/lib/sync-layer-queue-fallback.test.ts` → 3 通过；`npx vitest run src/components/use-network-quality.test.tsx` → 7 通过。
  - `npm run lint` exit 0（`--max-warnings=0`）；`npm run typecheck` exit 0。
  - `npm test` → 245 文件 / 1778 用例通过（较 base `main@5bca7a6` 的 242 文件 / 1758 用例新增 3 文件 / 20 用例）。
- 上游依赖：无（纯测试，未改运行时行为，未新增依赖）。
- 未验证项：无。
- 风险与回滚：只新增测试文件，不动产品代码；若某条断言与既有实现不符即为真实回归信号。回滚即撤销本分支提交。
- 下一步：无（已完成）。
- 最后更新：2026-09-13

## 环境变量文档门禁（docs/env.md ↔ 代码对账）

- 状态：DONE（远端 CI 全绿后已 rebase 合并进 main）
- 工作分支：`codex/env-docs-completeness`
- PR：[#24](https://github.com/Sun1090/trade-buty/pull/24)
- Base：`origin/main@f374570`
- 远端 Head：`568b3c0`（rebase 合并前 tip；合并后 main 为 `5bca7a6`）
- 本地提交：`docs(env): complete the environment variable reference`、`test(env): gate the environment variable docs against code`
- 目标：`docs/env.md` 自称「唯一受版本控制的环境变量说明」，但此前没有任何门禁保证它与真实 `process.env.*` 用法一致；同时发现 `NEXT_PUBLIC_AI_ENABLED`（R3.10 紧急总开关）根本没登记。补齐文档并把对账关系固化为 CI 门禁。
- 已完成：
  - `docs/env.md`：补登 `NEXT_PUBLIC_AI_ENABLED`（字符串 `false` 隐藏全部 AI 入口，构建期内联）与「紧急关闭」操作段；顶部补 `NEXT_PUBLIC_` 暴露语义说明，点名四个绝不许加公共前缀的服务端密钥。
  - 新增 `scripts/env-docs.mjs`：扫描 `src/**` + `next.config.ts` 的 `process.env.NAME` / `process.env["NAME"]`，做三项对账 —— (1) 代码读到的运行时变量必须写进 `docs/env.md`；(2) 文档登记的变量必须真的被读（幽灵条目）；(3) 服务端密钥（`SUPABASE_SERVICE_ROLE_KEY` / `ADMIN_TOKEN` / `AI_API_KEY` / `AI_EMBEDDING_KEY`）不得出现在 `"use client"` 模块。框架变量 `NODE_ENV` 与运维脚本变量（`DB_TEST_*` / `BACKUP_DRILL_*`）按前缀豁免。
  - 新增 `scripts/env-docs.test.mjs`：9 例，覆盖真实仓库通过、点号/方括号两种写法、代码片段解析（排除 `R3.10` 之类编号）、漏登记被拒、幽灵条目被拒、客户端读密钥被拒、服务端/测试读密钥不误报、缺 `NEXT_PUBLIC_` 语义说明被拒、运维变量豁免。
  - `package.json` 新增 `check:env-docs`；`.github/workflows/ci.yml` 紧邻 `check:error-report-privacy` 加入该步骤；`scripts/ci-workflow.test.mjs` 必检列表同步。
  - `docs/ops.md` 门禁表新增 `check:env-docs` 行；并把「生成内容质量报告」行的七个命令名写实（`kb:inventory` / `kb:gap-priority` / `kb:accept` / `kb:translation-status` / `check:title-terminology` / `check:description-quality` / `check:risk-warning`）。
- 变更文件（关键）：`docs/env.md`、`scripts/env-docs.mjs`、`scripts/env-docs.test.mjs`、`package.json`、`.github/workflows/ci.yml`、`scripts/ci-workflow.test.mjs`、`docs/ops.md`。
- 验证命令与结果：
  - `npm run check:env-docs` exit 0（13 个运行时变量全部登记，无幽灵条目，无客户端密钥泄漏）。
  - `npx vitest run scripts/env-docs.test.mjs` → 9 用例通过；`npx vitest run scripts/ci-workflow.test.mjs` → 6 用例通过。
  - `npm run lint` exit 0（`--max-warnings=0`）；`npm run typecheck` exit 0。
  - `npm test` → 242 文件 / 1758 用例通过（较 base `main@f374570` 的 241 文件 / 1749 用例新增 1 文件 / 9 用例）。
  - `npm run check:docs` exit 0（27 章 / 182 篇，zh/en 对齐）；`npm run check:secrets` exit 0（652 个文本文件无疑似凭据）；`npm run check:changelog` exit 0。
- 上游依赖：无（纯静态审计脚本，复用现有 vitest，未新增依赖）。
- 未验证项：无（远端 CI 全绿）。
- 风险与回滚：门禁为只读静态分析，最坏情况是误报阻断合并；回滚即撤销本分支提交。
- 下一步：已合并；继续按扫描结果补其它真实缺口。
- 最后更新：2026-09-13

## 质量门禁覆盖补齐（R7.6 限流回归 + ops 门禁表）

- 状态：DONE（PR #23 已以 `--rebase` 合并进 main；PR CI run [34715525108](https://github.com/Sun1090/trade-buty/actions/runs/34715525108) 与合并后 main CI run [34715838100](https://github.com/Sun1090/trade-buty/actions/runs/34715838100) 均通过）
- 工作分支：`codex/gate-coverage-followups`
- PR：[#23](https://github.com/Sun1090/trade-buty/pull/23) · `MERGED`
- 合并提交：`f374570`
- Base：`origin/main@80902f4`
- 远端 Head：`d18ee5a`（PR 最终 head，CI 全绿）
- 本地提交：`test(errors): cover error report endpoint rate limiting`、`docs(ops): register the changelog gate in the quality gate table`
- 目标：合并 R7.6 隐私门禁（PR #22）后继续扫描真实缺口，补两处：错误上报端点的按 IP 限流此前没有单测；`npm run check:changelog` 虽在 CI 阻断，却未登记在 `docs/ops.md` 的质量门禁表。
- 已完成：
  - `src/app/api/error-reports/route.test.ts`：`request()` 辅助函数支持附加请求头，新增「同一 IP 超过每分钟配额返回 429 + Retry-After，不同 IP 不受牵连」用例——同一 `x-forwarded-for` 连打 101 次命中 429、`Retry-After > 0` 且响应不带 `Cache-Control`，另一个 IP 仍在独立窗口内返回 202。
  - `docs/ops.md`：质量门禁表新增 `npm run check:changelog` 一行，说明它校验 `CHANGELOG.md` 与单一来源 `src/data/release-notes.json` 一致，失败处理为 `npm run changelog:generate` 重新生成。
- 变更文件（关键）：`src/app/api/error-reports/route.test.ts`、`docs/ops.md`、`docs/progress.md`。
- 验证命令与结果：
  - `npx vitest run src/app/api/error-reports/route.test.ts` → 15 用例通过（较 base 新增 1 例）。
  - `npm run lint` exit 0（`--max-warnings=0`）；`npm run typecheck` exit 0。
  - `npm test` → 241 文件 / 1749 用例通过（较 base `main@80902f4` 的 241 文件 / 1748 用例新增 1 例）。
  - `npm run check:changelog` exit 0；`npm run check:error-report-privacy` exit 0；`npm run check:docs` exit 0。
- 上游依赖：无。
- 未验证项：无。
- 风险与回滚：新增用例只做断言，不改运行时行为；文档行只描述既有门禁。回滚即撤销本分支提交。
- 下一步：无（已完成）。
- 最后更新：2026-09-13

## 错误上报隐私门禁（R7.6 补口）

- 状态：DONE（PR #22 已以 `--rebase` 合并进 main；PR CI run [34715051077](https://github.com/Sun1090/trade-buty/actions/runs/34715051077) 与合并后 main CI run [34715323738](https://github.com/Sun1090/trade-buty/actions/runs/34715323738) 均通过）
- 工作分支：`codex/error-report-privacy-gate`
- PR：[#22](https://github.com/Sun1090/trade-buty/pull/22) · `MERGED`
- 合并提交：`80902f4`（PR CI run [34715051077](https://github.com/Sun1090/trade-buty/actions/runs/34715051077)，合并后 main CI run [34715323738](https://github.com/Sun1090/trade-buty/actions/runs/34715323738)）
- Base：`origin/main@ec86526`
- 远端 Head：`4b118a1`（PR 最终 head，CI 全绿）
- 本地提交：`test(errors): gate error report payload privacy`
- 目标：R7.6 的错误上报端点（PR #21 已合并）此前只有约定式隐私边界，没有可执行门禁。任何后续重构都可能悄悄把错误正文 / URL / 账号塞进上报载荷或服务端日志而不被发现，故把「诊断载荷只能是无身份白名单字段」固化为 CI 门禁。
- 已完成：
  - 新增 `scripts/error-report-privacy.mjs`（与 `growth-event-privacy.mjs` 同构）：静态审计客户端 `buildErrorReportPayload`（敏感标识符黑名单 + `ErrorReportPayload` 接口字段白名单）、`ERROR_REPORT_ENDPOINT` 与真实 Route Handler 目录一致、服务端路由必须拒绝未知字段（`ERROR_REPORT_ALLOWED_KEYS`）且经 `readBoundedBody` 有界读取、不得调用 `req.json()`、不得回显原始载荷、文档与隐私页必须披露端点和「绝不发送」清单。注释先剥离，避免「禁止发送 message」的描述误报。
  - 新增 `scripts/error-report-privacy.test.mjs`：7 例，覆盖真实实现通过、注释不误报、载荷泄漏 message/URL 被拒、非白名单字段被拒、无界读取 / 丢白名单被拒、隐私页漂移被拒、文档漏字段被拒。
  - `package.json` 新增 `check:error-report-privacy` 脚本；`.github/workflows/ci.yml` 紧邻 `check:growth-event-privacy` 加入该步骤；`scripts/ci-workflow.test.mjs` 的必检列表与「引用的 npm 脚本必须存在」契约同步覆盖。
  - `docs/ops.md` 门禁表新增一行；`docs/error-reporting.md` §已验证 补充本条门禁与测试。
- 变更文件（关键）：`scripts/error-report-privacy.mjs`、`scripts/error-report-privacy.test.mjs`、`scripts/ci-workflow.test.mjs`、`package.json`、`.github/workflows/ci.yml`、`docs/ops.md`、`docs/error-reporting.md`。
- 验证命令与结果：
  - `npm run lint` exit 0（`--max-warnings=0`）；`npm run typecheck` exit 0。
  - `npm test` → 241 文件 / 1748 用例通过（较 base `main@ec86526` 的 240 文件 / 1741 用例新增 1 文件 / 7 用例）。
  - `npx vitest run scripts/error-report-privacy.test.mjs` → 7 用例通过；`npx vitest run scripts/ci-workflow.test.mjs` → 6 用例通过。
  - `npm run check:error-report-privacy` exit 0（endpoint /api/error-reports，白名单字段、脱敏日志、隐私页双语披露全部命中）。
  - `npm run check:docs` exit 0（27 章 / 182 篇，zh/en 对齐）；`npm run check:secrets` exit 0（650 个文本文件无疑似凭据）；`npm run check:growth-event-privacy` exit 0；`npm run check:dark-pattern-copy` exit 0；`npm run check:changelog` exit 0。
- 上游依赖：无（纯静态审计脚本，复用现有 vitest / js-yaml，未新增依赖）。
- 未验证项：无。
- 风险与回滚：门禁为只读静态分析，最坏情况是误报阻断合并；回滚即撤销本分支提交。
- 下一步：无（已完成）。
- 最后更新：2026-09-13

## 统一错误上报端点（R7.6 补口）

- 状态：DONE（PR #21 已以 `--rebase` 合并进 main；PR CI run [34714530667](https://github.com/Sun1090/trade-buty/actions/runs/34714530667) 与合并后 main CI run [34714863116](https://github.com/Sun1090/trade-buty/actions/runs/34714863116) 均通过）
- 工作分支：`codex/error-reporting-endpoint`
- PR：[#21](https://github.com/Sun1090/trade-buty/pull/21) · `MERGED`
- 合并提交：`ec86526`
- Base：`origin/main@52732f7`（rebase 后）
- 远端 Head：`834cce6`（PR 最终 head，CI 全绿）
- 本地提交：`feat(errors): report privacy-safe client diagnostics`、`docs(privacy): disclose error diagnostics and update roadmap`
- 目标：R7.6 定义了 fatal / recoverable / silent 三档，但此前 `reportError` 只写本机 console，服务端收不到任何真实崩溃信号（PR #19 已把「统一上报端点」列为遗留项）。本次补齐同源端点，并把隐私约束固化成代码而非口头约定。
- 已完成：
  - 新增 `POST /api/error-reports`（`src/app/api/error-reports/route.ts`）：仅接受 `application/json`；`level` 限 `fatal|recoverable`；`scope`/`kind`/`digest` 必须是限长安全 token（`[a-z0-9._:-]`，无空白/自由文本）；**未知字段整包拒绝**（携带 `message`/`url` 直接 400，不记录不透传）；body 有界读取，上限 `MAX_ERROR_REPORT_BYTES = 2048`（超限 413 并断流）；复用 R7.12 的进程内限流器（每 IP 每分钟 100 次，超限 429 + `Retry-After`）；成功返回 `202` + `Cache-Control: no-store`。
  - 服务端只写一行 sanitized 日志 `[error-report] fatal scope=route-error kind=Error digest=abc123`，**不落库、不回显请求体**。
  - 客户端 `src/lib/error-report.ts`：新增 `buildErrorReportPayload`（只保留 `level/scope/kind/digest` 白名单，绝不携带 message/stack/URL/账号/其他 meta）与 `sendErrorReport`（`sendBeacon` 优先 → 失败/返回 false/抛错回退 `keepalive` fetch → 两者都失败静默放弃，绝不重试或抛错）；`silent` 档仅本机 console，不上报。`reportError` 保持原 console 行为后追加最佳努力上报。
  - 隐私政策中英文同步披露（`src/app/[locale]/privacy/page.tsx`）：无身份、白名单诊断元数据、不写数据库、不用于追踪/广告；并修正原「未登录时服务器上没有任何数据」的失真表述。
  - 新增 `docs/error-reporting.md`：记录 schema、隐私边界、校验规则、传输策略、日志格式/保留、告警边界与已验证用例。
  - 测试：新增 `src/app/api/error-reports/route.test.ts`（14 例：合法/silent/未知 level、非法 scope/kind/digest、未知字段、数组/非对象、畸形 JSON、超长 body 413、非 JSON 415、日志不含原始内容）；`src/lib/error-report.test.ts` 扩 11 例（白名单载荷不含敏感字段、silent 返回 null、无 window 不发请求、sendBeacon 优先/回退/抛错、fetch 抛错不外抛、fatal+recoverable 上报 2 次而 silent 0 次）；`e2e/smoke.spec.ts` 新增「错误上报端点」×3（对 `next start` 真实响应 202+no-store / 400 / 413）。
- 变更文件（关键）：`src/lib/error-report.ts`、`src/lib/error-report.test.ts`、`src/app/api/error-reports/route.ts`、`src/app/api/error-reports/route.test.ts`、`src/app/[locale]/privacy/page.tsx`、`e2e/smoke.spec.ts`、`docs/error-reporting.md`、`docs/roadmap.md`。
- 验证命令与结果：
  - `npm run lint` exit 0（`--max-warnings=0`）；`npm run typecheck` exit 0；`git diff --check` clean。
  - `npm test` → 240 文件 / 1741 用例通过（较 base `main@52732f7` 的 239 文件 / 1716 用例新增 1 文件 / 25 用例）。
  - `npm run build` exit 0（构建条目 473 → 474，唯一差异是新增动态路由 `ƒ /api/error-reports`；未新增预渲染 HTML 页）。
  - `npm run check:bundle` exit 0（15 组预算全部通过；`drawing-tools` 最紧 392.6/400KB，`zh/privacy` 315.1/340KB）。
  - `npx playwright test e2e/smoke.spec.ts -g "错误上报端点" --reporter=line` → 3 用例通过（本地 `next start` 生产构建真实响应）。
  - `npm run check:docs` exit 0（27 章 / 182 篇，zh/en 对齐）；`npm run check:secrets` exit 0（648 个文本文件无疑似凭据）；`npm run check:growth-event-privacy` exit 0（8 个事件仍为 console-only，无网络/持久化 API）。
- 上游依赖：无（复用 R7.12 的 `clientIp` / `createRateLimiter` 与 `BoundedMap`，未新增依赖；同源端点已被现有 CSP `connect-src 'self'` 放行，无需改 CSP）。
- 未验证项：部署后线上端点真实可用性（Vercel 部署配额恢复后复核）。
- 风险与回滚：端点匿名、无鉴权但限流 + 输入白名单 + 有界 body，最坏情况只产生本站日志；客户端上报全程最佳努力，不影响任何成功路径与错误兜底渲染。回滚即撤销本分支提交。
- 下一步：无（已完成）。
- 最后更新：2026-09-13

## 安全头补齐 HSTS（R7.12 补口）

- 状态：DONE（PR #20 已以 `--rebase` 合并进 main；合并后 main CI run [34714331437](https://github.com/Sun1090/trade-buty/actions/runs/34714331437) 通过）
- 工作分支：`codex/security-headers`（合并后已删除）
- PR：[#20](https://github.com/Sun1090/trade-buty/pull/20) · `MERGED`
- 合并提交：`52732f7`
- Base：`origin/main@160e34b`（rebase 至后续 main）
- 远端 Head：`5bc6e7b`（PR 最终 head，CI 全绿）
- 本地提交：`feat(security): send HSTS on all responses`、`docs(security): record HSTS header and gate`、`test(security): assert security headers on live responses`
- 目标：`next.config.ts` 的 R7.12 安全头集合缺 `Strict-Transport-Security`。Vercel 不会自动下发 HSTS，站点此前没有任何强制 HTTPS 的声明，首访仍存在明文降级与 Cookie 剥离中间人风险。
- 已完成：
  - `next.config.ts` 在 `/:path*` 通配规则新增 `Strict-Transport-Security: max-age=63072000; includeSubDomains`，并把取值导出为 `HSTS_VALUE`。
  - 刻意不加 `preload`：preload 列表是不可逆的浏览器硬编码，未来若新增仅 HTTP 的子域会被锁死。
  - `src/lib/next-config.test.ts`：安全头 key 断言补上 `Strict-Transport-Security`，并新增一条锁定「值与 `HSTS_VALUE` 一致且 max-age ≥ 63072000」的回归，防止未来被误删或调成 0 后静默失去保护。
  - `e2e/smoke.spec.ts` 新增「安全响应头」×2：对 `next start` 真实响应断言全套安全头（CSP 关键指令、nosniff、DENY、HSTS 两年期 + `includeSubDomains` 且不含 `preload`、Referrer-Policy、Permissions-Policy），以及对 `/search-index.json` 断言安全头 + `public, max-age=0, must-revalidate`（R10.24）。此前只有配置级单测，没有验证响应真的带上这些头。
- 变更文件（关键）：`next.config.ts`、`src/lib/next-config.test.ts`、`e2e/smoke.spec.ts`、`docs/roadmap.md`、`docs/progress.md`。
- 验证命令与结果：
  - `npx vitest run src/lib/next-config.test.ts` → 5 用例通过（新增 1 例）。
  - `npx playwright test e2e/smoke.spec.ts --grep '安全响应头'` → 2 用例通过。
  - `npm run lint` exit 0（`--max-warnings=0`）；`npm run typecheck` exit 0。
  - `npm test` → 238 文件 / 1712 用例通过（较本分支 base `main@160e34b` 的 238 文件 / 1711 用例新增 1 例）。
  - `npm run build` exit 0（473 静态页）。
  - `npx playwright test e2e/smoke.spec.ts -g "安全响应头" --reporter=line` → 2 用例通过（本地 `next start` 生产构建真实响应）。
  - 远端 GitHub Actions run `34713680267`：`ci` pass（4m11s）、`db-tests` pass（40s）；Vercel 仅因账号部署配额 `Deployment rate limited` 失败。
- 上游依赖：无。
- 未验证项：线上响应头实际下发（部署配额恢复后 `curl -I https://trade-buty.vercel.app` 复核）。
- 风险与回滚：HSTS 只在 HTTPS 响应上下发；不含 preload，回滚 = 撤销本分支提交。已确认站点生产域为 `trade-buty.vercel.app`，其子域由 Vercel 管理，`includeSubDomains` 无现存冲突。
- 下一步：rebase 至 `main@4077e14` 后合并，部署后补一次线上响应头复核。
- 最后更新：2026-09-13

## 路由级错误上报接线（R7.6 补口）

- 状态：DONE（已 rebase 合并）
- 工作分支：`codex/route-error-reporting`
- PR：[#19](https://github.com/Sun1090/trade-buty/pull/19)（MERGED，rebase）
- Base：`origin/main@160e34b`（rebase 后）
- 远端 Head：`903f10f`（已 rebase 合入 `main@4077e14`）
- 本地提交：`fix(errors): report route crashes through the fatal channel`、`docs(errors): record route error reporting wiring`
- 目标：修掉「定义了 fatal 档但没有任何路由调用方」的真实缺口 —— `src/app/error.tsx` 只渲染兜底 UI，从不调用 `reportError`；全仓库此前只有 `ai-chat.tsx` 用到 `reportError`（recoverable）。
- 已完成：
  - `src/lib/error-report.ts` 新增 `reportRouteError(error, scope = "route-error")`：统一按 `fatal` 上报，带上 Next.js 的 `error.digest`（无 digest 时不塞空 meta，保持控制台输出可断言）。
  - `src/app/error.tsx` 在 `useEffect` 中按 Next.js 官方 error boundary 约定上报一次。
  - 测试：`error-report.test.ts` 补 `reportRouteError` 两例（带 digest / 自定义 scope）；新增 `src/app/error.test.tsx` 组件测试（仅上报一次、兜底渲染、重试按钮接线）。
  - 明确**不**新增 `src/app/global-error.tsx`：实测该文件会给全部 454 条 zh/en 路由各加 **13.4KB gzip JS**（home `301.7→315.1`、stats `317.1→330.5`、drawing-tools `302.5→315.9`），一次性击穿 home/lesson/chapter/stats 四组 R13.15 预算。根 layout 崩溃由 Next 内置兜底页承接，收益不抵全站首屏成本；已在本条留证，未来若要接统一上报端点再单独评估「不进首屏预算」的方案。
- 变更文件（关键）：`src/lib/error-report.ts`、`src/lib/error-report.test.ts`、`src/app/error.tsx`、`src/app/error.test.tsx`、`docs/roadmap.md`。
- 验证命令与结果：
  - `npm run lint` exit 0（`--max-warnings=0`）；`npm run typecheck` exit 0；`git diff --check` clean。
  - `npx vitest run src/app/error.test.tsx src/lib/error-report.test.ts` → 2 文件 / 9 用例通过。
  - `npm test` → 239 文件 / 1715 用例通过（较 base `main@160e34b` 的 238 文件 / 1711 用例新增 1 文件 / 4 用例，无 `global-error.test.tsx`）。
  - `npm run build` exit 0（473 静态页，与 base 一致，未新增路由）。
  - `npm run check:bundle` exit 0（15 组预算全部通过；`drawing-tools` 最紧：392.3/400KB）。
  - 远端 GitHub Actions run `34713543522`：`ci` pass（5m39s）、`db-tests` pass（43s）；Vercel 仅因账号部署配额 `Deployment rate limited` 失败。
- 上游依赖：无。
- 未验证项：无（已 rebase 合并为 `main@4077e14`）。
- 风险与回滚：只在错误路径增加一次 console 上报，不触碰成功路径；首屏 JS 零增长（`zh` 301.7KB 与 base 同量级）。回滚即撤销本分支提交。
- 下一步：再评估「统一上报端点 + CSP `connect-src`」是否值得进首屏预算。
- 最后更新：2026-09-13

## 文档事实校正（roadmap Q2.3 + v0.6 复盘状态）

- 状态：DONE（已合并）
- 工作分支：`codex/docs-freshness`
- PR：[#18](https://github.com/Sun1090/trade-buty/pull/18)（MERGED，rebase）
- Base：`origin/main@b41e193`
- 远端 Head：`2a6f4c0`（已随 rebase 合入 `main@160e34b`）
- 本地提交：`docs(roadmap): align Q2.3 with enforced Lighthouse gates`、`docs(release-review): record post-closure push and merge status`、`docs(progress): record doc accuracy pass and changelog merge`
- 目标：审计仓库文档中与当前事实不符的陈述并如实更正；不改产品代码。
- 已完成：
  - `docs/roadmap.md` Q2.3：原文写的是旧版 Lighthouse 门槛与旧实测分数，与 `.lighthouserc.json` 实际强制执行的门禁不一致；更正为 `categories:accessibility` minScore=1 error + 单独阻断 `color-contrast` / `link-name` / `label-content-name-mismatch`，`best-practices` / `seo` ≥ 0.9 error，`performance` ≥ 0.7 warn。
  - `docs/v0.6-release-review.md`：头部仍写 `LOCAL_ONLY`（未推送/未改 PR/未部署），但该分支随后获授权并以 PR #16 rebase 合入 `main`；新增「§0 关账后状态更新」记录 PR #16（tip `5bdd49d`）远端 CI run `34711354683` 全绿（`ci` + `db-tests`）并合入 `main@b41e193`，把 178 文件 / 1350 用例 / 56 e2e 标注为已被 237 文件 / 1701 用例 / 61 e2e 超越的快照数字；§6、§8 的「待授权」条目改为已完成。
- 变更文件（关键）：`docs/roadmap.md`、`docs/v0.6-release-review.md`、`docs/progress.md`。
- 验证命令与结果：
  - `npm run check:docs` exit 0（README/AGENTS/plan 与知识库一致：27 章 / 182 篇）。
  - `npm run check:secrets` exit 0（扫描 639 个文本文件，无疑似凭据）。
  - 引用数字均可复现：`.lighthouserc.json`、`gh run view 34711354683`（237 文件 / 1701 用例 / 61 e2e）、`gh pr view 16`（mergeCommit `b41e193`）。
- 上游依赖：无。
- 未验证项：无（远端 CI run `34712716577` 全绿：`ci` + `db-tests`）。
- 风险与回滚：纯文档更正，无运行时影响；回滚即撤销本分支提交。
- 下一步：已完成合并；后续见上方「路由级错误上报接线」条目。
- 最后更新：2026-09-13

## 策展式发布说明（更新日志）与 CHANGELOG 门禁

- 状态：DONE（已合并）
- 工作分支：`codex/release-notes-changelog`
- PR：[#17](https://github.com/Sun1090/trade-buty/pull/17)（MERGED，rebase）
- PR 状态：MERGED 2026-09-12
- Base：`origin/main@b41e193`
- 远端 Head：`221383d`（已随 rebase 合入 `main@cb97095`）
- 本地提交：本条目随 docs 提交入库
- 目标：修掉 `/[locale]/changelog` 只靠构建机 `git log` 取数的问题（Vercel/浅克隆下只能拿到 1 条提交或直接为空），改为策展式双语发布说明；同时补上仓库一直缺失的根级 `CHANGELOG.md`。
- 已完成：
  - 新增单一数据源 `src/data/release-notes.json`（未发布变更 + v0.6.0 / v0.5.0 / v0.4.0，中英双语条目数强一致）。
  - 新增 `src/lib/release-notes.ts`：版本排序（同日按语义版本）、ISO 日期校验、按 ISO 字符串直接格式化日期（不因时区偏移到前一天）。
  - `/[locale]/changelog` 改为渲染策展发布说明（版本、日期、亮点、发布复盘链接），`git log` 降级为次要的「最近提交」区块，取不到就不渲染。
  - 新增 `npm run changelog:generate` / `npm run check:changelog`：从同一份 JSON 生成根级 `CHANGELOG.md` 并在 CI 阻断漂移；校验版本语义化、唯一、日期合法、按日期倒序、中英条目数一致、`docs` 引用存在。
  - `README.md` / `README.zh-CN.md` 文档索引补上 CHANGELOG 入口。
- 变更文件（关键）：`src/data/release-notes.json`、`src/lib/release-notes.ts`、`src/lib/release-notes.test.ts`、`src/app/[locale]/changelog/page.tsx`、`scripts/generate-changelog.mjs`、`CHANGELOG.md`、`e2e/smoke.spec.ts`、`package.json`、`.github/workflows/ci.yml`、两份 README。
- 验证命令与结果：
  - `npm run lint` exit 0；`npm run typecheck` exit 0；`git diff --check` clean。
  - `npm test` → 238 文件 / 1711 用例通过（新增 `release-notes.test.ts` 10 例）。
  - `npm run build` exit 0；`npx playwright test e2e/smoke.spec.ts -g "更新日志"` → 2 用例通过。
  - `npm run check:changelog` → 通过（4 条记录：未发布 + 3 个已发布版本）。
  - `check:docs` / `check:bundle` / `check:seo-surface` / `check:structured-data` / `check:links` / `check:sitemap` / `check:mobile` 全部通过。
- 上游依赖：无。
- 未验证项：无（远端 CI run `34712342862` 全绿：`ci` + `db-tests`）。
- 风险与回滚：页面从「git 提交列表」改为「策展发布说明 + 次要提交列表」，信息只增不减；回滚可撤销本分支提交。
- 下一步：已完成合并，后续审计见上方「文档事实校正」条目。
- 最后更新：2026-09-13

## 亮色主题对比度回归修复（R13.10 / CI lhci 门禁）

- 状态：DONE（PR #16 已以 `--rebase` 合并进 main；合并后 main CI run [34711721555](https://github.com/Sun1090/trade-buty/actions/runs/34711721555) 通过）
- 工作分支：`codex/zero-eslint-warnings`（合并后已删除）
- PR：[#16](https://github.com/Sun1090/trade-buty/pull/16) · `MERGED`
- 合并提交：`b41e193`
- Base：`origin/main@53f7e01`
- 远端 Head：`5bdd49d`（PR 最终 head，CI 全绿）
- 本地提交：本条目随修复提交一起入库
- 目标：修复 CI 中 `npm run lhci` 唯一失败步骤——亮色主题仍沿用暗色硬编码颜色，导致首页与课程正文页触发 Lighthouse/axe `color-contrast` 违规。
- 已完成：
  - 首页 6 个章节序号的 `text-accent/80` 在浅色背景上实测对比度 3.74:1（低于 4.5:1），改为不透明 `text-accent`；`/path` 序号与学习侧栏未读图标同步收紧。
  - `.kb-prose` 正文由硬编码 `rgba(233, 237, 245, 0.88)`（暗色专用）改为跟随主题的 `var(--foreground)`，消除课程页 187 处违规。
  - callout 的 info / warning 边框与标题不再硬编码 `#60a5fa` / `#fbbf24`，改用 `var(--info)` / `var(--warn)`；亮色 `--warn` 由 `#d97706` 调整为 `#b45309`，并补齐亮色 `--down: #b91c1c`。
  - 新增 `e2e/light-contrast.spec.ts`：对 `/zh`、课程页、`/chart` 三个页面注入亮色主题后用 `axe-core` 只跑 `color-contrast` 规则并断言零违规，纳入 `npm run e2e`。
- 验证命令与结果：
  - `npm run lint` exit 0；`npm run typecheck` exit 0；`git diff --check` clean。
  - `npm test` → 237 文件 / 1701 用例通过。
  - `npm run build` exit 0（473 个静态页面）。
  - `npx playwright test e2e/light-contrast.spec.ts --reporter=line` → 3 用例通过；`npm run e2e` → 61 用例通过。
  - `npm run lhci` → 3 URL × 2 次采样，6/6 断言通过（accessibility 全 100）。
- 变更文件（关键）：`src/app/globals.css`、`src/app/[locale]/page.tsx`、`src/app/[locale]/path/page.tsx`、`src/components/learning-sidebar.tsx`、`e2e/light-contrast.spec.ts`、`package.json`、`package-lock.json`。
- 上游依赖：无。
- 未验证项：远端 CI 复跑结果（推送后由本周期继续跟踪并在绿后 rebase 合并 PR #16）。
- 风险与回滚：仅调整主题色 token 与测试，不改信息结构；回滚可撤销本修复提交。
- 下一步：推送功能分支、守到 CI 全绿后 `gh pr merge 16 --rebase`，再 fetch main 核对合并结果。
- 最后更新：2026-09-13

## 云端合并前本地快照结构校验（Q2.4 / R12 数据韧性）

- 状态：DONE（本地实现与全量验证完成；远端发布待授权）
- 工作分支：`codex/zero-eslint-warnings`
- PR：none
- PR 状态：none
- Base：`origin/main@53f7e01`
- 远端 Head：none（`LOCAL_ONLY`，未推送）
- 本地提交：`799831a`
- 目标：修复合法 JSON 但结构损坏的本地 progress / wrongbook / replay / quiz 快照在登录云端合并时被当作强类型数据使用，导致异常值写回本机并影响合并摘要、冲突检测的问题。
- 已完成：
  - `sync-layer` 在合并前统一通过结构校验器读取 `tb-progress`、`tb-wrong`、`tb-replay-history` 与各章 `tb-quiz-*`，损坏顶层值回退为空快照。
  - 进度过滤空章节、空课程标识、非数组与重复项；错题过滤空章节、非法数字、key 与内嵌 `chapterNum/questionIdx` 不一致的条目；回放过滤空币种/周期和非法计数；测验仅接受有限的非负 `best` 与布尔 `done`。
  - 新增 4 组回归，覆盖 `null`/错误字段/错 key/空标识/损坏测验成绩，确认云端数据仍可恢复且本地不会写回 `NaN`。
- 验证命令与结果：
  - `npx vitest run src/lib/sync-layer-hydrate.test.ts src/lib/sync-layer.test.ts` → 2 文件 / 38 用例通过。
  - `npm test` → 237 文件 / 1700 用例通过。
  - `npm run lint` exit 0（`--max-warnings=0`）；`npm run typecheck` exit 0；`npm run build` exit 0（473 个静态页面）。
- 变更文件：`src/lib/sync-layer.ts`、`src/lib/sync-layer-hydrate.test.ts`。
- 上游依赖：无。
- 未验证项：远端 CI / Vercel 部署（`LOCAL_ONLY`，未推送、未部署）。
- 风险与回滚：只收紧异常本地快照的读取结果，合法数据保持原样；回滚可撤销 `799831a`。
- 下一步：把当前本地功能线推送为 PR，确认远端 CI 后按 rebase 策略合并。
- 最后更新：2026-09-13

## 本地进度存储结构校验（Q2.4 / R12 数据韧性）

- 状态：DONE（本地实现与全量验证完成；远端发布待授权）
- 工作分支：`codex/zero-eslint-warnings`
- PR：none
- PR 状态：none
- Base：`origin/main@53f7e01`
- 远端 Head：none（`LOCAL_ONLY`，未推送）
- 本地提交：`8709741`
- 目标：修复 `tb-progress` 为合法 JSON 但结构错误（尤为 `null` / 数组）时，学习进度读取与写入可能直接抛错的问题。
- 已完成：
  - `src/lib/progress.ts` 对顶层对象、章节数组和文档字符串做结构校验；过滤非法值并对重复文档去重。
  - completion ledger 同样清洗非对象条目、非字符串字段和非有限时间戳，避免损坏数据进入趋势与隐私导出。
  - 新增 5 个边界用例，覆盖 `null` / 数组 / 原始值、字段清洗、结构损坏后的 `markRead` 恢复。
- 验证命令与结果：
  - `npx vitest run src/lib/progress.test.ts` → 1 文件 / 12 用例通过。
  - `npm test` → 237 文件 / 1677 用例全部通过。
  - `npm run lint` exit 0（`--max-warnings=0`）；`npm run typecheck` exit 0；`npm run build` exit 0（473 个静态页面）。
- 变更文件：`src/lib/progress.ts`、`src/lib/progress.test.ts`。
- 上游依赖：无。
- 未验证项：远端 CI / Vercel 部署（`LOCAL_ONLY`，未推送、未部署）。
- 风险与回滚：仅收紧损坏数据的读取结果，合法数据保持不变；回滚可撤销 `8709741`。
- 下一步：继续审计其余 localStorage 读取器的合法但错误结构输入，优先 streak、bookmarks、study-time、replay/wrongbook。
- 最后更新：2026-09-13

## 章节导航与关联课程单测 + 未读开关无障碍修复（R7.12 / R13.9）

- 状态：DONE（本地实现与全量验证完成；远端发布待授权）
- 工作分支：`codex/zero-eslint-warnings`
- PR：none
- PR 状态：none
- Base：`origin/main@53f7e01`
- 远端 Head：none（`LOCAL_ONLY`，未推送）
- 本地提交：`e76074b`
- 目标：为 `chapter-rail`、`related-courses` 两个此前无单测的交互组件补回归保护，并修掉章节导航“隐藏已读”开关缺失展开状态这一无障碍缺陷。
- 已完成：
  - `src/components/chapter-rail.test.tsx`（8 例）：章节/课程渲染、当前课程高亮、未读切换按钮按压后隐藏已读课程、进度文案、语言路由前缀、空数据不崩。
  - `src/components/related-courses.test.tsx`（4 例）：按当前章节过滤关联课程、上限截断、空态隐藏、链接指向对应 slug。
  - `e76074b` 源码修复：`chapter-rail.tsx` 的“显示/隐藏已读”按钮补 `type="button"`、`aria-expanded={showUnread}`，并把纯装饰的 `▸` 字形标 `aria-hidden`，让屏幕阅读器能感知折叠状态且不朗读装饰字符。
- 验证命令与结果：
  - `npm test` → 209 文件 / 1550 用例全部通过。
  - `npm run lint` exit 0（`--max-warnings=0`）；`npm run typecheck` exit 0；`npm run build` exit 0。
- 变更文件（关键）：`src/components/chapter-rail.tsx`、`src/components/chapter-rail.test.tsx`、`src/components/related-courses.test.tsx`。
- 上游依赖：无（纯站内组件）。
- 未验证项：远端 CI / Vercel 部署（`LOCAL_ONLY`，未推送、未部署）。
- 风险与回滚：仅新增属性与测试，无行为变更；回滚可撤销 `e76074b`。
- 下一步：继续补齐剩余无单测运行时模块（auth-provider、theme-selector、focus-mode、service-worker-registrar 等）。
- 最后更新：2026-09-13

## 未覆盖模块单测扩面 + 折叠组件可访问性（R7.12 / R13.9）

- 状态：DONE（本地实现与全量验证完成；远端发布待授权）
- 工作分支：`codex/zero-eslint-warnings`
- PR：none
- PR 状态：none
- Base：`origin/main@53f7e01`
- 远端 Head：none（`LOCAL_ONLY`，未推送）
- 本地提交：`1aadd5b`、`6715aaa`、`e941247`、`573f29a`、`c22c3fa`
- 目标：把此前无任何单测的运行时模块（AI 客户端三模型 fallback、浏览器下载/分享、币安行情、AI 开关、章节标题、404 推荐语料）与关键小部件补上回归保护，并修掉一个真实的折叠组件无障碍缺陷。
- 已完成：
  - `src/lib/ai/client.test.ts`（16 例）：`streamChat` 首个模型成功直返、400 降级到 deepseek、跳过 `reasoning_content`、跨 chunk SSE 行拼回、`finish_reason` 回调、全链失败抛错、`AI_MODEL` 去重与自定义模型置链首；`chat` 非流式成功/降级/空内容继续降级/全空抛错；`embed` 正常返回、独立 env 覆盖端点/模型/密钥、非 2xx 抛错、缺字段返回空数组。
  - `src/lib/download.test.ts`（7 例，jsdom）：Canvas→PNG 触发下载并回收 ObjectURL、toBlob 为 null 抛错；`canWebShare` 能力探测；`webShare` 不支持/用户取消静默返回 false、成功透传载荷。
  - `src/lib/binance.test.ts`（4 例）：原始 K 线解析与 UTC+8 时间对齐、默认 limit/endTime 查询参数、非 2xx 抛状态码错误；随机历史窗口的 limit 与 endTime 落点区间。
  - `src/lib/ai-toggle.test.ts`（4 例）：全局关、key 探测、`aiEnabledForPage` 双条件。
  - `src/lib/ai/chapters.test.ts`（3 例）：`NN · ` 前缀剥离、未知章节/locale 返回 null。
  - `src/lib/progress-helpers.test.ts`（2 例，jsdom）：记录连续天数并派发 `tb-progress`、内部抛错静默。
  - `src/lib/url-suggest-server.test.ts`（3 例）：`buildKnowledgeCorpus` 的 zh/en 前缀、章节/doc 层级、章节 slug 唯一。
  - `src/components/market-ticker.test.tsx`（6 例）：成功渲染三条价格、离线暂停轮询、慢速提示、失败+重试、非数组响应按失败、英文文案。
  - `src/components/daily-goal.test.tsx`（7 例）：百分比、未达成无庆祝、达成 🎉/100%、超额封顶、档位切换、断签挽回提示与已达成时不提示。
  - `src/components/replay-trend.test.tsx`（4 例）：<2 轮空态、≥2 轮折线图、total=0 不产生 NaN、只取最近 20 轮。
  - `src/components/collapsible.test.tsx`（4 例）+ 源码修复：折叠按钮补 `aria-expanded={open}` 与 `type="button"`，让屏幕阅读器能拿到展开状态并避免意外触发表单提交。
  - `src/components/progress-ring.test.tsx`（4 例）：0/50/100% 与超额封顶的 dashoffset 数学。
  - `src/components/week-mini-bar.test.tsx`（3 例）、`src/components/streak-badge.test.tsx`（4 例）、`src/components/today-pick.test.tsx`（5 例）、`src/components/not-found-suggestions.test.tsx`（4 例）。
  - `c22c3fa`：把测试里的 fetch mock 显式类型化为 `(url, init?)`，修掉 `tsc` 对 `mock.calls` 空元组的报错（lint 不抓、typecheck 抓到）。
- 验证命令与结果：
  - `npm test` → **209 文件 / 1550 用例全部通过**（本轮由 193/1470 增至 209/1550）。
  - `npm run lint` exit 0（`--max-warnings=0`）；`npm run typecheck` exit 0；`npm run build` exit 0。
  - 内容/SEO 门禁全绿（clean build 后）：`check:docs`（27 章/182 篇）、`check:constitution`、`check:frontmatter`、`check:image-alt`（102 图）、`check:glossary`（59 词条）、`check:slug-conflicts`（364 课程）、`check:description-dupes`（418 篇）、`check:kb-pointer`（a57d510）、`check:translation-history`、`check:kb-parity-budget`（12/12）、`check:quiz-mounts`、`check:quiz-coverage`（81 题）、`check:links`（454 页/8958 链接）、`check:sitemap`（418 页）、`check:seo-surface`（430/454/418）、`check:search-index`（418/418）、`check:nav-chain`、`check:relative-links`、`check:bundle`（454 路由）、`check:structured-data`（454 页/5656 实体）、`check:mobile`（14 页 @320px）全部 exit 0。
  - 数据与安全：`npm run db:test` exit 0（迁移 9/9、RLS 38、同步 26、`0008_*` 回滚→重放）；`npm run check:secrets` exit 0（609 文件）；`npm run audit:prod` / `audit:all` → 0 vulnerabilities。
  - E2E 与性能：`npm run e2e` → 58 passed；`npm run lhci` exit 0（3 URL × 2 次，断言全过；无 GitHub token，跳过 status check）。
- 变更文件（关键）：`src/lib/ai/client.test.ts`、`src/lib/{download,binance,ai-toggle,progress-helpers,url-suggest-server}.test.ts`、`src/lib/ai/chapters.test.ts`、`src/components/{market-ticker,daily-goal,replay-trend,collapsible,progress-ring,week-mini-bar,streak-badge,today-pick,not-found-suggestions}.test.tsx`、`src/components/collapsible.tsx`。
- 上游依赖：无（纯站内库/组件层）。
- 未验证项：远端 CI / Vercel 部署（`LOCAL_ONLY`，未推送、未部署）；`db-tests` 作业（含备份恢复步骤）从未在 GitHub Actions 上运行过。
- 风险与回滚：新增内容为测试与一处 aria 属性，运行时不改变既有行为（折叠交互逻辑不变，仅补语义）。回滚可分别撤销 `1aadd5b`、`6715aaa`、`e941247`、`573f29a`、`c22c3fa`。
- 下一步：roadmap 剩余项均为外部依赖（Sentry、Supabase 云联调、GSC/Bing、Vercel Analytics、PostHog、OG 卡片人工渲染、冷启动分发、云备份、评论/排行榜用户研究）。
- 最后更新：2026-09-13

## 生成式 AI 路由限流 + 未覆盖模块单测（R7.12 / R9 / R13）

- 状态：DONE（本地实现与全量验证完成；远端发布待授权）
- 工作分支：`codex/zero-eslint-warnings`
- PR：none
- PR 状态：none
- Base：`origin/main@53f7e01`
- 远端 Head：none（`LOCAL_ONLY`，未推送）
- 本地提交：`2ed2a55`、`0b83db1`、`0b4ad8d`
- 目标：补上三类此前无单测保障的运行时模块（离线同步队列执行器、学习时长账本、活动日历保留策略 + RAG 章节过滤），并修掉一个真实花费/安全缺口——三个生成式 AI 路由（plan/summary/quiz）此前对 LLM 调用零配额。
- 已完成：
  - 新增 `src/lib/ai/rate-limit.ts`：`createRateLimiter({guestLimit, authedLimit, windowMs, maxKeys, sweepThreshold})` 建立在 `BoundedMap` 之上，惰性清扫过期键；导出 `clientIp(req)`。返回 `{allowed, limit, remaining, retryAfterSec}`。
  - `POST /api/ai/plan`（30/30 每小时，用户维度，未鉴权先 401）、`/summary`（游客 20 / 鉴权 60 每小时，IP 或用户 id 维度）、`/quiz`（40/40 每小时，用户维度）全部接入限流，超限返回 `429 + Retry-After`。
  - `POST /api/ai/chat` 改为复用同一 limiter，行为保持不变（游客 10/时、鉴权 50/时、仅游客返回 `X-Quota-Limit`/`X-Quota-Remaining`），既有断言 `X-Quota-Limit === "10"` 仍通过。
  - 新增 `src/lib/sync-queue-executor.test.ts`（10 例）：按 kind 映射 Supabase 表与 `onConflict`、delete 的 `.eq()` 主键链、RLS 错误 → 返回 `false` 保留队列项、未知 kind → `false`、客户端抛错 → `false`。
  - 新增 `src/lib/study-time.test.ts`（5 例）：损坏 JSON 回退、单来源 8 小时上限、90 天保留、累加、`getTodayStudySeconds`。
  - 新增 `src/lib/activity-calendar.test.ts`（5 例）：损坏 JSON、同日去重、跨日、365 天上限（`vi.useFakeTimers`）。
  - 新增 `src/lib/ai/rag.test.ts`（6 例）：空 embedding 短路、参数透传、字段投影、chapterFilter 过采样（`topK*4`）后 slice、RPC 报错/null 数据降级。
  - 重写 `scripts/ci-workflow.test.mjs`（5 例）：覆盖**全部**作业（含 `db-tests`）并把工作流里出现的每个 `npm run <script>`（41 个）与 `node scripts/*.mjs`（2 个）逐一对照 `package.json` / 磁盘校验（打印抽取结果证明非空跑）。
- 验证命令与结果：
  - `npm test` → 193 文件 / 1470 用例全部通过（本轮由 188/1428 增至 193/1470）。
  - `npm run lint` exit 0（`--max-warnings=0`）；`npm run typecheck` exit 0；`npm run build` exit 0（473 静态页）。
  - 内容/SEO 门禁全绿：`check:mobile`（14 页 @320px）、`check:docs`、`check:constitution`、`check:frontmatter`、`check:image-alt`、`check:glossary`、`check:slug-conflicts`、`check:description-dupes`、`check:kb-pointer`（a57d510）、`check:translation-history`、`check:kb-parity-budget`、`check:quiz-mounts`、`check:quiz-coverage`、`check:links`、`check:sitemap`（418 知识页）、`check:seo-surface`（430 sitemap / 454 页面）、`check:search-index`、`check:nav-chain`、`check:relative-links`、`check:bundle`（454 路由）、`check:structured-data`（454 页 / 5656 实体）全部 exit 0。
  - 数据与安全：`npm run db:test` exit 0（迁移 9/9、RLS 38、同步 26、`0008_*` 回滚→重放）；`npm run backup:drill` exit 0（30963 bytes，恢复库重跑 pgTAP 38+26 通过）；`npm run check:secrets` exit 0（587 文件无凭据）；`npm run audit:prod`、`npm run audit:all` → 0 vulnerabilities。
  - E2E 与性能：`npm run e2e` → 58 passed；`npm run lhci` exit 0（3 URL × 2 次，断言全过；无 GitHub token，跳过 status check）。
- 变更文件（关键）：`src/lib/ai/rate-limit.ts`、`src/app/api/ai/{chat,plan,summary,quiz}/route.ts` 及其 `route.test.ts`、`src/lib/{sync-queue-executor,study-time,activity-calendar}.test.ts`、`src/lib/ai/{rag,rate-limit}.test.ts`、`scripts/ci-workflow.test.mjs`。
- 上游依赖：无（纯站内 API/库层）。
- 未验证项：远端 CI / Vercel 部署（`LOCAL_ONLY`，未推送、未部署）；`db-tests` 作业（含备份恢复步骤）从未在 GitHub Actions 上运行过。
- 风险与回滚：限流为进程内缓存，多实例部署下每实例独立计数（非分布式配额，已在此记录权衡）；正常请求路径行为不变。回滚可分别撤销 `0b4ad8d`（限流）与 `2ed2a55`、`0b83db1`（测试）。
- 下一步：roadmap 剩余项均为外部依赖（Sentry、Supabase 云联调、GSC/Bing、Vercel Analytics、PostHog、OG 卡片人工渲染、冷启动分发、云备份）。
- 最后更新：2026-09-13

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

## 2026-09-19 — Coverage batch 9: AI quiz route failure/cache paths

Status: completed on `codex/coverage-batch-8`.

Completed:

- Expanded `src/app/api/ai/quiz/route.test.ts` across the production chapter-generation path: successful RAG-backed generation, instance cache hits, zh/en retrieval query selection, fixed-quiz fallback, and RAG/model failure containment.
- Added variant-generation regressions for unavailable retrieval, malformed model JSON, and schema-invalid questions; internal error details remain server-only and clients receive the generic 502 response.
- Raised the AI quiz route's focused coverage to 96.70% statements / 92.06% branches / 98.85% lines; the sole uncovered line is the defensive no-fixed-quiz 502 branch, currently unreachable because every recognized chapter has a fixed quiz fallback.
- Full repository coverage increased from 91.98% / 86.19% / 91.82% / 94.49% (statements/branches/functions/lines) to 92.23% / 86.48% / 91.88% / 94.74%.

Changed files:

- `src/app/api/ai/quiz/route.test.ts`
- `docs/progress.md`

Verification:

- `npm test` — passed, 253 files / 2,130 tests.
- `npm run test:coverage -- --reporter=dot` — passed, 253 files / 2,130 tests; 92.23% statements, 86.48% branches, 91.88% functions, 94.74% lines.
- `npm run lint -- --quiet` — passed with zero warnings.
- `npm run typecheck` — passed (`next typegen` + `tsc --noEmit`).

Blockers / risk / rollback:

- `docs/roadmap.md` still has only the 10 explicitly `BLOCKED_EXTERNAL` items remaining; no product decision is needed for this coverage batch.
- Tests exercise only failure isolation, cache behavior, and existing fallbacks; rollback is the single atomic test/progress commit.

Next:

- Continue the executable quality backlog with the next high-value low-coverage production boundary (AI quiz UI or content parser), while leaving externally blocked roadmap work untouched until credentials/accounts are available.

## 2026-09-19 — Coverage batch 10: adaptive quiz UI lifecycle

Status: completed on `codex/coverage-batch-8`.

Completed:

- Expanded `AiQuiz` component coverage for disabled and empty states, API-provided errors, malformed error responses, non-Error network failures, multi-question navigation, completion reset, and fire-and-forget feedback failures.
- Locked the full learner lifecycle: generate → answer → next question → finish → return to the generation entry, including the second-question progress badge.
- Confirmed failed feedback delivery remains non-blocking while the UI prevents duplicate reports.

Changed files:

- `src/components/ai-quiz.test.tsx`
- `docs/progress.md`

Verification:

- `npx vitest run src/components/ai-quiz.test.tsx --reporter=dot` — passed, 11 tests.
- `npm test` — passed, 253 files / 2,134 tests.
- `npm run lint -- --quiet` — passed with zero warnings.
- `npm run typecheck` — passed (`next typegen` + `tsc --noEmit`).

Blockers / risk / rollback:

- No new blocker. This batch changes tests only; rollback is the atomic commit.

Next:

- Re-run repository coverage and select the next production boundary by uncovered branch count, prioritizing content parsing and learner-facing error handling over cosmetic branches.

## 2026-09-19 — Coverage batch 11: knowledge-base filesystem contract

Status: completed on `codex/coverage-batch-8`.

Completed:

- Added integration coverage against the checked-out `kline-buty` submodule for the content loader's real filesystem boundary.
- Locked the 27-chapter bilingual inventory and stable product ordering, chapter metadata/introduction parsing, chapter adjacency, zh/en lesson parity and ordering, full-document loading, document adjacency, unknown chapter/document behavior, and clear missing-locale failure.
- Raised focused `src/lib/content.ts` statement coverage from 77.0% in the repository baseline to 92.70% (165/178 statements), while testing the actual knowledge-base contract rather than mocked fixtures.

Changed files:

- `src/lib/content.test.ts`
- `docs/progress.md`

Verification:

- `npx vitest run src/lib/content.test.ts --reporter=dot` — passed, 29 tests.
- Focused coverage run — `src/lib/content.ts` 92.70% statements.
- `npm test` — passed, 253 files / 2,139 tests.
- `npm run lint -- --quiet` — passed with zero warnings.
- `npm run typecheck` — passed (`next typegen` + `tsc --noEmit`).

Blockers / risk / rollback:

- These tests intentionally require the knowledge submodule, matching the repository's documented build dependency and producing a clear failure if it is absent.
- No production behavior changed; rollback is the atomic test/progress commit.

Next:

- Recompute full coverage, then continue with the highest-value remaining learner-facing or content-boundary branches. External roadmap items remain blocked on production accounts and credentials.

## 2026-09-19 — Coverage batch 12: global read-stat states

Status: completed on `codex/coverage-batch-8`.

Completed:

- Replaced the previous ineffective “no progress” assertion (which still mocked populated progress) with state-driven coverage of the actual null, empty-object, and empty-chapter-list branches.
- Added multi-chapter aggregation, template replacement, signed-in cloud-sync labeling, and guest behavior coverage for `GlobalReadStat`.
- Recorded the post-batch-11 full coverage baseline: 92.70% statements, 86.87% branches, 92.53% functions, and 95.16% lines across 2,139 tests.

Changed files:

- `src/components/global-read-stat.test.tsx`
- `docs/progress.md`

Verification:

- `npx vitest run src/components/global-read-stat.test.tsx --reporter=dot` — passed, 6 tests.
- `npm test` — passed, 253 files / 2,143 tests.
- `npm run lint -- --quiet` — passed with zero warnings.
- `npm run typecheck` — passed (`next typegen` + `tsc --noEmit`).

Blockers / risk / rollback:

- No production behavior changed. The corrected tests now fail if zero-progress states accidentally render misleading “0 read” copy.
- Rollback is the atomic test/progress commit.

Next:

- Continue auditing low-coverage tests for assertions that do not exercise their named branch, then strengthen the highest-value learner-facing state transitions.

## 2026-09-19 — Coverage batch 13: reading progress interaction

Status: completed on `codex/coverage-batch-8`.

Completed:

- Replaced shallow render-only checks with behavioral coverage of reading percentage calculation, the 800px return-to-top threshold, smooth-scroll action, 100% clamping, zero-scroll-distance handling, and listener cleanup.
- Locked the visible percentage and accessible title/label contract for the floating return-to-top control.

Changed files:

- `src/components/reading-progress.test.tsx`
- `docs/progress.md`

Verification:

- `npx vitest run src/components/reading-progress.test.tsx --reporter=dot` — passed, 5 tests.
- `npm test` — passed, 253 files / 2,146 tests.
- `npm run lint -- --quiet` — passed with zero warnings.
- `npm run typecheck` — passed (`next typegen` + `tsc --noEmit`).

Blockers / risk / rollback:

- No production behavior changed. Tests control viewport geometry explicitly and restore globals after each case.
- Rollback is the atomic test/progress commit.

Next:

- Continue replacing render-only assertions in low-coverage learner-facing components with state-transition and accessibility checks.

## 2026-09-19 — Coverage batch 8–13 delivery

- Branch `codex/coverage-batch-8` pushed successfully after GitHub authentication recovered.
- Pull request opened: #68 (`test: expand regression coverage across critical boundaries`).
- The PR contains 9 atomic commits on top of `origin/main`; CI/preview status is the next authoritative delivery check.

## 2026-09-19 — Coverage batch 14: persisted reading preferences

Status: completed on `codex/coverage-batch-14`.

Completed:

- Replaced render-only font preference checks with behavioral coverage for accessible labels, persisted preference loading, CSS custom-property updates, storage writes, bounds, disabled states, and unavailable storage.
- Found and fixed a production defect where an out-of-range persisted line height was applied directly, allowing invalid typography and inconsistent controls after preference corruption or an older schema value.
- Centralized line-height bounds so loading, clamping, and button states share the same contract.

Changed files:

- `src/components/font-size-control.tsx`
- `src/components/font-size-control.test.tsx`
- `docs/progress.md`

Verification:

- `npx vitest run src/components/font-size-control.test.tsx --reporter=dot` — passed, 6 tests.
- `npm test` — passed, 253 files / 2,148 tests.
- `npm run lint -- --quiet` — passed with zero warnings.
- `npm run typecheck` — passed (`next typegen` + `tsc --noEmit`).
- `npm run build` — passed; knowledge contract validated and 474 static pages generated.

Blockers / risk / rollback:

- No new blocker. Valid stored values retain existing behavior; only invalid line-height values are ignored in favor of the safe default.
- Rollback is the atomic commit for this batch.

Next:

- Re-audit remaining shallow learner-facing component tests and select the next stateful control with persistence, navigation, or accessibility behavior that is not yet asserted.

## 2026-09-19 — Coverage batch 15: automatic read completion

Status: completed on `codex/coverage-batch-14`.

Completed:

- Replaced the invisible-component smoke test with behavioral coverage for short documents, the strict 50% scroll threshold, single-fire semantics, route identity changes, and listener cleanup.
- Fixed a scroll-listener leak on documents shorter than the viewport: the component previously marked them read immediately, then attached a listener that could never do useful work.

Changed files:

- `src/components/mark-read.tsx`
- `src/components/mark-read.test.tsx`
- `docs/progress.md`

Verification:

- `npx vitest run src/components/mark-read.test.tsx --reporter=dot` — passed, 4 tests.
- `npm test` — passed, 253 files / 2,151 tests.
- `npm run lint -- --quiet` — passed with zero warnings.
- `npm run typecheck` — passed (`next typegen` + `tsc --noEmit`).
- `npm run build` — passed; knowledge contract validated and 474 static pages generated.

Blockers / risk / rollback:

- No new blocker. Read-completion thresholds and persistence behavior are unchanged; the fix only skips an unnecessary listener after synchronous completion.
- Rollback is the atomic commit for this batch.

Next:

- Continue the shallow-test audit with learner navigation and responsive controls, prioritizing tests that can reveal stale event subscriptions or state-transition defects.

## 2026-09-19 — Coverage batch 16: AI knowledge chunk boundaries

Status: completed on `codex/coverage-batch-16`.

Completed:

- Replaced broad shape-only chunking tests with deterministic coverage of frontmatter removal, H2 boundaries, metadata, short-section filtering, absent locales, missing chapters, and missing lesson files.
- Found and fixed an embedding-input defect where a single paragraph over 2,000 characters remained oversized despite the documented chunk limit.
- Balanced hard splits so a 2,001-character paragraph does not produce a one-character tail that is then silently discarded by the minimum-length filter.
- Raised focused `src/lib/ai/chunk.ts` coverage to 96.55% statements, 82.75% branches, 100% functions, and 100% lines.

Changed files:

- `src/lib/ai/chunk.ts`
- `src/lib/ai/chunk.test.ts`
- `docs/progress.md`

Verification:

- `npx vitest run src/lib/ai/chunk.test.ts --reporter=dot` — passed, 6 tests.
- Focused coverage — 96.55% statements / 82.75% branches / 100% functions / 100% lines.
- `npm test` — passed, 253 files / 2,154 tests.
- `npm run lint -- --quiet` — passed with zero warnings.
- `npm run typecheck` — passed (`next typegen` + `tsc --noEmit`).
- `npm run build` — passed; knowledge contract validated and 474 static pages generated.

Blockers / risk / rollback:

- No new blocker. Normal H2 and paragraph-based chunks keep their existing behavior; only oversized individual paragraphs use balanced hard splits.
- Embeddings must be regenerated by the existing embedding workflow before this affects a deployed vector index.
- Rollback is the atomic commit for this batch.

Next:

- Audit AI retrieval and embedding generation boundaries for stable identifiers, empty-input behavior, and stale-index detection before returning to lower-value UI branch coverage.

## 2026-09-19 — Embedding refresh failure safety

Status: completed on `codex/coverage-batch-16`.

Completed:

- Extracted the embedding API and Supabase replacement workflow into a testable script library.
- Changed refresh ordering so every vector must be generated and validated before the live locale index is deleted; transient model failures can no longer erase the existing index.
- Refuse empty chunk sets, validate `data[0].embedding`, check DELETE responses, fail on batch insertion errors, and report deterministic batch progress instead of logging a false successful completion.
- Added regression coverage for malformed model responses, empty indexes, model rate limits, database deletion failures, batching, progress, and vector insertion failures.

Changed files:

- `scripts/generate-embeddings.mjs`
- `scripts/generate-embeddings-lib.mjs`
- `scripts/generate-embeddings-lib.test.mjs`
- `docs/progress.md`

Verification:

- `npx vitest run scripts/generate-embeddings-lib.test.mjs --reporter=dot` — passed, 6 tests.
- `npm test` — passed, 254 files / 2,160 tests.
- `npm run lint -- --quiet` — passed with zero warnings.
- `npm run typecheck` — passed (`next typegen` + `tsc --noEmit`).
- `node --check scripts/generate-embeddings.mjs && node --check scripts/generate-embeddings-lib.mjs` — passed.

Blockers / risk / rollback:

- Production execution still requires the documented AI and Supabase service credentials.
- Generation failures are now non-destructive. A database failure after successful deletion can still leave a partial index because the current schema/API has no generation pointer or transactional replacement RPC; that requires a dedicated migration before fully atomic swaps are possible.
- Rollback is the atomic commit for this batch.

Next:

- Design and test an atomic embedding-generation swap using a generation identifier and transactional activation, including migration and rollback behavior, before running a production refresh.

## 2026-09-19 — Atomic embedding generation activation

Status: completed on `codex/coverage-batch-16`.

Completed:

- Added migration `0009_atomic_embedding_generations.sql`: every vector row now belongs to a UUID generation, each locale has one active-generation pointer, and retrieval joins through that pointer so staged rows remain invisible until activation.
- Added the service-role-only `activate_kb_embedding_generation` RPC. It rejects empty generations, switches the active pointer and deletes stale generations in one database transaction.
- Changed the embedding generator to stage a complete generation, activate it only after every batch succeeds, and remove only the failed staged generation on insert or activation errors. A simultaneous refresh and cleanup failure is preserved as an `AggregateError`.
- Added rollback SQL, schema-mirror coverage, script regression tests, and 8 pgTAP assertions for activation, cleanup, locale isolation, empty generations, and RPC privilege boundaries.
- Extended the backup/restore drill to include the generation-pointer table and activation RPC, preserve object ACLs while excluding image-owned default ACLs, and explicitly reassert the service-only RPC grant after restore. The restored database then passes the complete pgTAP suite.

Changed files:

- `scripts/generate-embeddings.mjs`
- `scripts/generate-embeddings-lib.mjs`
- `scripts/generate-embeddings-lib.test.mjs`
- `scripts/backup-drill.mjs`
- `src/lib/supabase/schema.ts`
- `src/lib/supabase/schema.test.ts`
- `supabase/migrations/0009_atomic_embedding_generations.sql`
- `supabase/rollback/0009_atomic_embedding_generations.sql`
- `supabase/tests/embedding_generations.sql`
- `docs/progress.md`

Verification:

- `npx vitest run scripts/generate-embeddings-lib.test.mjs src/lib/supabase/schema.test.ts --reporter=dot` — passed, 2 files / 12 tests.
- `npm test` — passed, 254 files / 2,161 tests.
- `npm run lint -- --quiet` — passed with zero warnings.
- `npm run typecheck` — passed (`next typegen` + `tsc --noEmit`).
- `npm run build` — passed; knowledge contract validated and 474 static pages generated.
- `npm run db:test` — passed, 10 migrations and 72 pgTAP assertions; rollback/replay drill passed.
- `npm run backup:drill` — passed, 10 migrations, 11 business tables, restored ACL boundary, and all 3 pgTAP files.
- `node --check scripts/generate-embeddings.mjs && node --check scripts/generate-embeddings-lib.mjs && node --check scripts/backup-drill.mjs` — passed.

Blockers / risk / rollback:

- Production migration and an actual vector refresh still require Supabase service-role and embedding-provider credentials; no production state was changed locally.
- The activation transaction deletes prior generations after switching the pointer, so rollback after a successful production refresh requires regenerating the prior vectors rather than merely changing the pointer.
- Rollback SQL is available at `supabase/rollback/0009_atomic_embedding_generations.sql`; code rollback is the atomic commit for this batch.

Next:

- Exercise the new migration's own rollback/replay path in the database harness, then continue the AI retrieval audit for stale-generation observability and operational retry behavior.

## 2026-09-19 — Atomic embedding rollback/replay drill

Status: completed on `codex/coverage-batch-16`.

Completed:

- Extended `npm run db:test` with a real rollback/replay exercise for migration 0009.
- Added rollback behavior that removes staged, non-active generations before dropping the generation discriminator, preserving only rows visible through the active pointer.
- Verified rollback removes the generation table/column, preserves the active row, and reapplying migration 0009 restores the pointer, generation metadata, and service-only activation ACL.

Changed files:

- `scripts/db-test.mjs`
- `supabase/rollback/0009_atomic_embedding_generations.sql`
- `docs/progress.md`

Verification:

- `npm run db:test` — passed: 10 migrations, 3 pgTAP files / 72 assertions, 0008 rollback/replay, and 0009 rollback/replay.
- `node --check scripts/db-test.mjs` — passed.
- `git diff --check` — passed.

Blockers / risk / rollback:

- Production migration and vector refresh still require external Supabase and embedding credentials.
- The rollback intentionally discards non-active staged vectors because they were never queryable; active vectors remain available.

Next:

- Commit this atomic rollback/drill topic, then inspect the AI retrieval path for stale-generation observability and retry-safe operational behavior.

## 2026-09-19 — Error-report privacy audit coverage

Status: in progress on `codex/coverage-batch-17`.

Completed:

- Expanded `scripts/error-report-privacy.test.mjs` from implementation-only checks to adversarial coverage for missing client markers, missing/extra payload fields, missing endpoints, unsafe route references and response echoing, bounded-body/parser requirements, and privacy disclosure regressions.
- Focused audit coverage increased to 87.32% statements, 91.3% branches, 85.71% functions, and 88.33% lines.

Changed files:

- `scripts/error-report-privacy.test.mjs`
- `docs/progress.md`

Verification:

- `npx vitest run scripts/error-report-privacy.test.mjs --coverage --reporter=dot` — passed, 11 tests.

Next:

- Run the full gates, commit the coverage batch, then continue auditing the remaining operational scripts and API boundary tests.

## 2026-09-19 — Content-gap ranking boundary coverage

Status: in progress on `codex/coverage-batch-17`.

Completed:

- Added regression coverage for non-empty Markdown table rendering and non-numeric score normalization in the content-gap ranking library.
- Focused coverage reached 100% statements, branches, functions, and lines for `scripts/content-gap-ranking-lib.mjs`.

Changed files:

- `src/lib/content-gap-ranking.test.ts`
- `docs/progress.md`

Verification:

- `npx vitest run src/lib/content-gap-ranking.test.ts --coverage --reporter=dot` — passed, 4 tests; 100% focused coverage.

Next:

- Run the full suite and commit this small coverage topic, then continue the coverage audit.

## 2026-09-19 — Growth-event privacy boundary coverage

Status: in progress on `codex/coverage-batch-18`.

Completed:

- Added adversarial coverage for every prohibited browser sink, including `sendBeacon`, `XMLHttpRequest`, session storage, and IndexedDB.
- Added coverage for duplicate logger sinks and malformed/empty event catalogs.
- Kept all new cases inside the existing audit suite and verified the production fixture remains compliant.

Changed files:

- `scripts/growth-event-privacy.test.mjs`
- `docs/progress.md`

Verification:

- `npx vitest run scripts/growth-event-privacy.test.mjs --reporter=dot` — passed, 9 tests.
- `git diff --check` — passed.

Next:

- Run the repository gates, commit this atomic coverage topic, then continue the lowest-coverage script audit.

## 2026-09-19 — Bundle-budget validation boundary coverage

Status: in progress on `codex/coverage-batch-18`.

Completed:

- Added malformed-manifest coverage for invalid roots, versions, empty budgets, malformed entries, duplicate IDs, invalid regexes, incomplete metrics, and unknown metrics.
- Added compile failure, ambiguous route matching, unsupported asset extension, and unsafe asset-path coverage.
- Focused `scripts/bundle-budget.mjs` coverage now reaches 96.1% statements, 98.21% branches, 93.75% functions, and 96% lines.

Changed files:

- `scripts/bundle-budget.test.mjs`
- `docs/progress.md`

Verification:

- `npx vitest run scripts/bundle-budget.test.mjs --reporter=dot` — passed, 27 tests.
- Focused coverage command — passed tests and reported the coverage above.
- `git diff --check` — passed.

Next:

- Run the full gates for this batch, commit the bundle-budget coverage topic, then continue with the next lowest-coverage library.

## 2026-09-19 — Content-inventory edge coverage

Status: in progress on `codex/coverage-batch-18`.

Completed:

- Added empty-inventory coverage to guarantee 100% coverage without division-by-zero behavior.
- Added deterministic rendering coverage for missing chapters and sorted missing documents.

Changed files:

- `src/lib/content-inventory.test.ts`
- `docs/progress.md`

Verification:

- `npx vitest run src/lib/content-inventory.test.ts --reporter=dot` — passed, 4 tests.
- `git diff --check` — passed.

Next:

- Run the full gates, commit this coverage topic, then continue the operational-script coverage audit.

## 2026-09-19 — Dark-pattern parser boundary coverage

Status: in progress on `codex/coverage-batch-18`.

Completed:

- Added parser boundary coverage for missing locale/section blocks and empty entry extraction.
- Added a neutral-copy regression ensuring the blacklist does not report safe educational wording.

Changed files:

- `scripts/check-dark-pattern-copy.test.mjs`
- `docs/progress.md`

Verification:

- `npx vitest run scripts/check-dark-pattern-copy.test.mjs --reporter=dot` — passed, 15 tests.
- `git diff --check` — passed.

Next:

- Run the full gates, commit this coverage topic, then continue the coverage audit.

## 2026-09-19 — Coverage batch 18 gate verification

Status: in progress on `codex/coverage-batch-18`.

Verification:

- `npm test` — passed, 254 files / 2176 tests.
- `npm run lint -- --quiet` — passed.
- `npm run typecheck` — passed.

Next:

- Continue the coverage audit with the next lowest-coverage component/library, then consolidate the batch for review.

## 2026-09-19 — Invite-banner interaction coverage

Status: in progress on `codex/coverage-batch-18`.

Completed:

- Added regression coverage for previously dismissed invites.
- Added multi-tab storage-event coverage for clearing an active invite and hiding the banner.

Changed files:

- `src/components/invite-banner.test.tsx`
- `docs/progress.md`

Verification:

- `npx vitest run src/components/invite-banner.test.tsx --reporter=dot` — passed, 9 tests.

Next:

- Continue the coverage audit after committing this topic.

## 2026-09-19 — Coverage batch 18 full report

Status: completed locally on `codex/coverage-batch-18`.

Completed:

- Raised repository coverage to 93.46% statements, 87.61% branches, 93.05% functions, and 95.86% lines.
- Covered growth-event privacy, bundle-budget validation, content inventory, dark-pattern parsing, and invite-banner persistence/storage synchronization boundaries.

Verification:

- `npm run test:coverage -- --reporter=dot` — passed, 254 files / 2178 tests.
- Coverage: 8449/9040 statements, 5845/6671 branches, 1714/1842 functions, 7486/7809 lines.

Blockers / risk / rollback:

- No runtime behavior changed; rollback is limited to reverting the test and progress commits in this batch.

Next:

- Open and merge the batch PR after CI, synchronize `main`, and continue with the next lowest-coverage production boundary.

## 2026-09-19 — Cross-tab invite dismissal correctness

Status: completed locally on `codex/invite-storage-sync`.

Completed:

- Fixed the invite banner's stale dismissal key after another tab replaces the referral; the dismiss action now targets the displayed ref.
- Synchronized cross-tab dismissal events and avoided rendering refs previously dismissed in another tab.
- Added four regression tests covering replacement, dismissal, previously dismissed replacements, and dismissal after replacement.

Changed files:

- `src/components/invite-banner.tsx`
- `src/components/invite-banner.test.tsx`
- `docs/progress.md`

Verification:

- Initial regressions failed on the old implementation (2 failures); fixed implementation passes all 13 focused tests.
- `npm test` — 254 files / 2182 tests passed.
- `npm run lint -- --quiet`, `npm run typecheck`, `npm run build`, `git diff --check` — passed.

Blockers / risk / rollback:

- No external dependencies. The change is confined to client-side referral display/dismissal; rollback by reverting this commit.

Next:

- Review this fix through CI, merge, and continue the next highest-priority quality issue.

## 2026-09-19 — Quiz source mount parser boundary

Status: completed locally on `codex/coverage-batch-19`.

Completed:

- Restricted computed quiz mount keys to literal string/template values rather than treating a variable identifier as its actual chapter key.
- Covered identifier object keys, template literals, unrelated assignments, and malformed chapter/document/question fields.

Changed files:

- `scripts/quiz-source-lib.mjs`
- `scripts/quiz-source-lib.test.mjs`
- `docs/progress.md`

Verification:

- `npx vitest run scripts/quiz-source-lib.test.mjs --reporter=dot` — 5 tests passed.
- `npm run check:quiz-mounts` — 27 production mounts verified.
- `npm test` — 254 files / 2184 tests passed.
- `npm run lint -- --quiet`, `npm run typecheck`, `git diff --check` — passed.

Risk / rollback:

- This is a parser-only contract correction. Revert the commit to restore previous parsing if an intentional dynamic key is introduced; production mounts remain literal.

Next:

- Continue the coverage and core-boundary audit, then submit the batch for CI review.

## 2026-09-19 — Bundle asset path containment

Status: completed locally on `codex/coverage-batch-19`.

Completed:

- Prevented `staticAssetRepoPath` from resolving traversal paths outside `.next/static` and rejected backslash path separators.
- Added a regression demonstrating that `/_next/static/../../package.json` previously resolved to the repository package file.

Changed files:

- `scripts/bundle-budget.mjs`
- `scripts/bundle-budget.test.mjs`
- `docs/progress.md`

Verification:

- Regression failed on the old implementation, then `npx vitest run scripts/bundle-budget.test.mjs --reporter=dot` passed, 27 tests.
- `npm run check:bundle` — all 454 zh/en routes and AI chunk isolation passed.
- Full batch gate after both fixes: `npm test` — 254 files / 2184 tests passed; `npm run lint -- --quiet`, `npm run typecheck`, `npm run build` — passed (474 static pages).
- `git diff --check` — passed.

Risk / rollback:

- Only build-audit asset path resolution changes; existing production bundle assets remain under `.next/static`. Roll back by reverting this commit.

Next:

- Run full quality gates and submit the batch for CI review.

## 2026-09-19 — Streak grace window rejects future timestamps

Status: completed locally on `codex/coverage-batch-20`.

Completed:

- Unified the 36-hour grace check across streak update, current display, and break detection.
- Reject future `lastTs` values so clock skew or corrupted storage cannot indefinitely preserve a streak or increase it after an actual break.
- Added a regression for all three paths while retaining the historical longest streak.

Changed files: `src/lib/streak.ts`, `src/lib/streak.test.ts`, `docs/progress.md`.

Verification: focused Vitest 17 passed; `npm run lint -- --quiet`, `npm run typecheck`, `git diff --check` passed.

Blockers / risk / rollback: no external dependency; existing within-window grace remains unchanged. Revert this commit if future timestamps need a distinct tolerance policy.

Next: audit further core data boundaries, run full gates before PR.

## 2026-09-19 — Reading duration display boundary

Status: completed locally on `codex/coverage-batch-21`.

Completed: rounded elapsed seconds before selecting seconds/minutes/hours presentation, preventing `60s` and `59m 60s` at unit boundaries. Added fractional-boundary regressions.

Changed files: `src/lib/reading-time.ts`, `src/lib/reading-time.test.ts`, `docs/progress.md`.

Verification: focused Vitest 15 passed; lint, typecheck, diff whitespace passed.

Blockers / risk / rollback: none; display-only behavior, revert commit if presentation policy changes.

Next: full quality gates, CI review, then audit next core boundary.

## 2026-09-19 — Offline sync queue identifier recovery

Status: completed locally on `codex/coverage-batch-22`.

Completed:

- Recover the next offline-write ID from the greatest persisted queue ID when the separate counter is missing or stale, preventing duplicate IDs after interrupted storage writes.
- Reject partial, fractional, unsafe counters and malformed queue entries (invalid ID/kind/payload/timestamp) before replay.
- Added regression tests for stale/missing counters and corrupted entries.

Changed files: `src/lib/sync-queue-store.ts`, `src/lib/sync-queue-store.test.ts`, `src/lib/sync-queue.ts`, `src/lib/sync-queue.test.ts`, `docs/progress.md`.

Verification: focused Vitest 36 passed; typecheck and lint passed; full gate pending.

Risk / rollback: invalid persisted queue entries are omitted rather than replayed; valid entries remain unchanged. Revert this commit if a retired queue kind must be migrated instead of discarded.

Next: full test/build, submit for CI, then continue data-isolation audit.

## 2026-09-19 — Preserve writes during asynchronous queue replay

Status: completed locally on `codex/coverage-batch-22`.

Completed: reconcile successful replay items against the latest persisted queue instead of writing a pre-await snapshot. New entries and updates to an in-flight item survive replay; regression exercises both cases.

Changed files: `src/lib/sync-queue-store.ts`, `src/lib/sync-queue-store.test.ts`, `docs/progress.md`.

Verification: focused Vitest 17 passed; typecheck and diff whitespace passed. Full gate pending.

Risk / rollback: replay result now reflects current queue. Roll back this commit independently if backend execution semantics change; concurrent-write loss would return.

Next: complete full gate and CI review, then audit remaining synchronization boundaries.

## 2026-09-19 — Offline write queue account isolation

Status: completed locally on `codex/coverage-batch-23`.

Completed:

- Bound production offline writes and replay to the authenticated user ID; a queue from another account is never replayed to the current account.
- Discard legacy unowned pending entries rather than risking cross-account writes. A new enqueue after account switch starts a fresh owned queue.
- Capture the initiating account for Supabase writes and reject delayed failures after sign-out/account switch, including after the lazy queue module resolves.
- Prevent an in-flight replay from overwriting a different account's queue. Added cross-account, legacy, and async interleaving regressions.

Changed files: `src/lib/sync-queue-store.ts`, `src/lib/sync-queue-store.test.ts`, `src/lib/sync-layer.ts`, `src/lib/sync-layer-queue-fallback.ts`, `src/lib/sync-layer-queue-fallback.test.ts`, `src/components/auth-provider.tsx`, `docs/progress.md`.

Verification: four focused test files / 41 tests plus extra replay-race test passed; lint, typecheck, diff whitespace passed. Full gate pending.

Risk / rollback: pre-existing unowned offline writes are intentionally discarded on first authenticated replay because ownership cannot be proven. Export local data before upgrade if preserving unsynced legacy data is required. Revert this commit to restore previous behavior, but doing so reintroduces cross-account replay risk.

Next: full gate and CI, then inspect related account-isolation paths.
