# 错误上报端点（R7.6）

`POST /api/error-reports` 是全站唯一接收前端崩溃 / 可恢复错误诊断的入口。本文档记录它的
schema、隐私边界、日志格式、限流与告警口径，避免未来改动悄悄放宽隐私约束。

## 背景

R7.6 定义了 fatal / recoverable / silent 三档错误分级，但当时只写本机 `console`，
服务端看不到任何真实崩溃信号（`docs/progress.md` 里作为「统一上报端点」遗留项）。
本端点补齐这条链路，同时把隐私约束固化成代码而非口头约定。

## 客户端 → 服务端契约

客户端（`src/lib/error-report.ts`）**只**发送以下封闭字段，服务端逐字段复核：

| 字段 | 必填 | 约束 | 说明 |
| --- | --- | --- | --- |
| `level` | 是 | `fatal` \| `recoverable` | `silent` 档不上报（仅本机 console） |
| `scope` | 是 | ≤ 40，`[a-z0-9._:-]` | 固定范围名，如 `route-error`、`ai-chat` |
| `kind` | 是 | ≤ 40，`[a-z0-9._:-]` | 错误类型名（`Error`、`TypeError`…）；非 Error 用 `typeof` |
| `digest` | 否 | ≤ 64，`[a-z0-9._:-]` | Next.js 服务端异常的不透明摘要哈希 |

**绝不发送**：错误 `message`、`stack`、页面 URL、`referrer`、账号 / 用户身份、邀请码、
课程内容、以及调用方 `meta` 里除 `digest` 以外的任何字段。用户在输入框、AI 对话或
URL 里写的任何自由文本都不会离开浏览器。

## 服务端校验（`src/app/api/error-reports/route.ts`）

- **方法 / 媒体类型**：仅 `POST` + `Content-Type: application/json`，否则 `415`。
- **body 上限**：`MAX_ERROR_REPORT_BYTES = 2048`。有界读取，超限立即断流返回 `413`。
- **未知字段整包拒绝**：只要出现白名单外的 key（如 `message`、`url`）就返回 `400`，
  不记录、不透传。
- **字段级校验**：`level` 必须是两档之一；`scope`/`kind`/`digest` 必须是合法安全 token
  （无空白、无自由文本、限长），任一不合法返回 `400`。
- **限流**：复用 R7.12 的进程内限流器（`BoundedMap` 兜底），每 IP 每分钟 100 次，
  超限返回 `429` + `Retry-After`。
- **响应**：成功 `202 { ok: true }` + `Cache-Control: no-store`。

## 传输策略（客户端）

1. 优先 `navigator.sendBeacon`（页面卸载时也能送达）。
2. beacon 不可用 / 返回 `false` / 抛错时，回退 `fetch(..., { keepalive: true })`。
3. 两种传输都失败则静默放弃：**绝不重试、绝不抛错**，避免故障风暴放大。

## 日志格式与保留

服务端只写一行 sanitized 结构化日志，不含任何请求体原文：

```text
[error-report] fatal scope=route-error kind=Error digest=abc123
```

- 不落库：诊断信号不写入 Supabase，也不与用户账号关联。
- 只存在于平台（Vercel）短生命周期日志中，用于排障与聚合告警。
- 需要长期留存时应改为聚合计数（如按 `level+scope+kind` 的日频次），而不是原始行。

## 隐私披露

`src/app/[locale]/privacy/page.tsx` 中英文隐私政策已同步披露该端点：无身份、白名单
元数据、不进数据库、不用于追踪或广告。修改本端点的字段或行为时必须同步更新该页。

## 告警边界

本端点当前**不**产生主动告警；它只提供可被日志查询 / 未来监控消费的信号。若要加告警，
建议基于聚合频次（如 5 分钟内 `level=fatal` 超过阈值）而不是单条日志，且不得为了告警引入
新的用户标识字段。

## 已验证

- `src/app/api/error-reports/route.test.ts`：合法/畸形 JSON、未知字段、非法 level、
  非法 scope/kind/digest、超长 body、错误媒体类型、日志不含原始内容。
- `src/lib/error-report.test.ts`：白名单载荷不含 message/stack/URL/meta、silent 不上报、
  sendBeacon 优先与回退、两种传输抛错均不外抛。
- `scripts/error-report-privacy.test.mjs`：审计器对客户端载荷 / 服务端路由 / 隐私页漂移的失败用例。
- `npm run check:error-report-privacy`：CI 读取真实源码、路由与隐私页，验证白名单字段、有界读取与双语披露。
