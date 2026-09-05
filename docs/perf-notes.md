# 性能评审笔记（R7.3 / R7.4）

## R7.3 回放页低端机降级（已实现）

- 挂载后用 `requestAnimationFrame` 采样 1.5s 平均帧率（`src/lib/perf.ts`）
- < 24fps 判定低端机：回放图只保留最近 **150 根** K 线（`REPLAY_REDUCED_CANDLES`），Canvas 负载可控
- 帧率检测只在挂载时执行一次，不常驻，避免检测本身耗电

## R7.4 长列表虚拟化评审（结论：暂不需要，设监控防线）

**评审结论：不引入虚拟化。** 依据：

1. **数据规模天然有上界**：
   - 复习页（错题本）条目 = 题库题数（27 章 × 3 题 ≈ **81 条**），AI 变体题映射回同一条目，不会新增行
   - 统计页全部是聚合数字 + 7 天周报（7 根柱），无长列表
   - 回放历史虽可累积，但复习页/统计页并不渲染该明细
2. **上限防线**：R2 题库扩展纪律——固定题库每章 ≥3 题；若未来题库扩到每章 >20 题（总量 >500），届时复习页引入 `@tanstack/virtual` 级别的虚拟化（届时需新增依赖，走 docs/deps.md 评审）
3. **当前缓解**：复习页按篇章分组渲染，单组条目少；SRS 排序把到期项置顶，超长时用户实际浏览的条目更少

**触发重评条件**：任一列表页面渲染 >200 条 DOM 节点、或在移动端实测掉帧。

## R9.6 登录/同步代码进入 layout 的体积权衡

**事实**：R9.5（离线写队列）+ R9.6（合并摘要）让 `auth-provider` 增加了 `sync-layer` + `sync-queue-store` + `buildQueueExecutor` 的引用。这些代码仅在登录后才需要，但 `AuthProvider` 是 layout 级 Provider，会被打进每个内容页的共享 chunk。

**优化尝试**：
- `hydrateFromCloud` 改 `import("@/lib/sync-layer").then(...)` 动态引入 → Next/React 框架 chunk 仍被静态引用
- `flushPersistedQueue` 改 useEffect 内 dynamic import → 减少约 12KB gzip
- `SyncSummaryToast` 用 `next/dynamic({ ssr: false })`（封装到 `sync-summary-toast-lazy.tsx`，因为 Next 16 要求 `ssr:false` 必须在 client 组件里）→ toast 实现从首屏 chunk 剥离
- `enqueueWrite` 抽到 `sync-layer-queue-fallback.ts`，内部 dynamic import `sync-queue-store` → 阻断 layout 直接静态引用
- `buildQueueExecutor` 抽到独立模块 `sync-queue-executor.ts`，便于 lazy import 单独成 chunk

**净结果**：内容页 +12KB gzip（不可消除——Next/React + Supabase 客户端 + sync-layer 共同构成的"登录态基础设施"）。

**预算调整**（`scripts/check-bundle.mjs`）：
- zh / en：280 → 295 KB
- market-overview：290 → 305 KB
- zh/search：280 → 295 KB
- AI / chart / replay 不变

**判断**：登录态是 v0.5 的核心功能（同步、合并、离线写），不引入任何重库（无新依赖），不进入非登录场景的关键路径（错误/回放/AI 走未登录模式），12KB 的边际成本可接受。后续如需进一步压缩，唯一可行路径是把整个 `AuthProvider` 拆成「公共 context + 登录后 sub-tree」，重构成本/收益不划算。
