# 课程风险提示块覆盖率报告

> 自动生成于 2026-09-06（npm run check:risk-warning），勿手改。

> 产品红线（docs/plan.md）：每篇内容必须带「⚠️ 风险提示 / Risk Warning」块。
> pass = 有合规块；review = 仅提及「风险提示」字样或存在未装箱风险句，需人工补成标准块；
> gap = 完全缺失。报告不阻断（知识库内容改动需在 kline-buty 仓库进行）。

## 课程正文（lesson）
- zh：173 篇课程 | ✅ pass：173 | 🔎 review：0 | ⚠️ gap：0
- en：173 篇课程 | ✅ pass：173 | 🔎 review：0 | ⚠️ gap：0

## 章节导语（README）
- 共 54 篇 | ✅ pass：40 | 🔎 review：12 | ⚠️ gap：2

## 待处理清单

| 状态 | 语言 | 章节 | 文档 | 类型 | 容器块 | 行内块 | 原因 |
|---|---|---|---|---|---|---|---|
| review | en | crypto-perpetuals | README | readme | 0 | 0 | mention-only |
| review | en | financial-statements | README | readme | 0 | 0 | mention-only |
| review | en | getting-started | README | readme | 0 | 0 | mention-only |
| review | en | industry-research | README | readme | 0 | 0 | mention-only |
| review | en | spot | README | readme | 0 | 0 | unboxed-risk-sentence |
| review | en | stocks | README | readme | 0 | 0 | mention-only |
| gap | en | technical-analysis | README | readme | 0 | 0 | — |
| review | zh | crypto-perpetuals | README | readme | 0 | 0 | mention-only、unboxed-risk-sentence |
| review | zh | financial-statements | README | readme | 0 | 0 | mention-only |
| review | zh | getting-started | README | readme | 0 | 0 | mention-only |
| review | zh | industry-research | README | readme | 0 | 0 | mention-only |
| review | zh | spot | README | readme | 0 | 0 | unboxed-risk-sentence |
| review | zh | stocks | README | readme | 0 | 0 | mention-only |
| gap | zh | technical-analysis | README | readme | 0 | 0 | — |

## 说明

- 检测规则：VitePress `::: warning ⚠️ 风险提示/Risk Warning` 容器（标题在开栏行）；
- 行内块引用 `> …⚠️ **风险提示/Risk Warning…**`（⚠️ 与风险提示语同在一个引用行）。
- 完整明细（含每篇计数）见 docs/risk-warning-coverage.json。

