# 知识库新增课程验收清单报告

> 自动生成于 2026-09-06（npm run kb:accept），勿手改。

- 课程：346 | ✅ ok：340 | ⚠️ warn：0 | ❌ fail：6

> blocking 项（slug/frontmatter/风险块/zh 序号）破坏契约，新增课程必须通过；
> advisory 项（description 质量/H1）为提示。存量不达标项见下表，需在 kline-buty 上游整改。

- zh：173 篇 | ✅ ok 167 | ⚠️ warn 0 | ❌ fail 6
- en：173 篇 | ✅ ok 173 | ⚠️ warn 0 | ❌ fail 0

## 非 ok 清单

| 状态 | 语言 | 章节 | 课程 | 未过项 |
|---|---|---|---|---|
| ❌ fail | zh | forex-trading | central-bank-trading | zh title 带「NN · 」前导序号（央行政策与事件交易 — 无前导序号，将排在 999 位） |
| ❌ fail | zh | forex-trading | forex-technicals | zh title 带「NN · 」前导序号（外汇技术分析与实战形态 — 无前导序号，将排在 999 位） |
| ❌ fail | zh | spot | crypto-spot | zh title 带「NN · 」前导序号（加密现货专题 — 无前导序号，将排在 999 位） |
| ❌ fail | zh | spot | spot-basics | zh title 带「NN · 」前导序号（现货交易基础 — 无前导序号，将排在 999 位） |
| ❌ fail | zh | spot | spot-intermediate | zh title 带「NN · 」前导序号（现货实务进阶 — 无前导序号，将排在 999 位） |
| ❌ fail | zh | spot | spot-strategies | zh title 带「NN · 」前导序号（现货交易策略 — 无前导序号，将排在 999 位） |

## 检查项

- blocking：文件名英文 slug、frontmatter 围栏、title、description、zh「NN · 」序号、⚠️ 风险提示块；
- advisory：description 质量分（R10.4）、正文 H1。完整明细见 docs/new-course-acceptance.json。

