# Trade Buty · 产品规划

> 依据：[市场调研报告](research.md)。定位：全球中文用户的免费中立交易教育平台。

## 产品一句话

把「读知识」变成「练交易」：分级课程（学）+ 真实行情图表与历史回放（练），中文世界的 BabyPips × ChartMini。

## 内容宪法（不可回退红线）

1. 不承诺、不暗示任何收益；数字示例一律虚构并注明
2. 不荐股荐基，不做投顾业务
3. 不做券商开户导流
4. 每篇内容必须带「⚠️ 风险提示」块（继承 kline-buty 知识库规范）
5. P0–P3 全程免费；未来变现仅限 Affiliate / 高阶订阅，且基础课程永远免费

## 分期路线

### P0 骨架（1–2 周）

- Next.js + TypeScript + Tailwind CSS + shadcn/ui 初始化
- kline-buty 知识库以 git submodule 接入，Markdown 渲染（宽容模式：缺字段告警不构建失败）
- 学习路线图首页（27 篇章分级导航）
- Pagefind 站内搜索
- GitHub Actions CI + Vercel 自动部署

验收标准：有一个能看、能搜、能学的完整站点上线。

### P1 边学边练

- 概念页内嵌真实 K 线图表（移植 kline-buty `src/chart` + `src/data/binance`）
- 市场回放练习：历史行情逐根回放，结合章节出题（如"在这次暴跌中你会怎么止损？"）
- 每章小测验，进度存 localStorage
- SEO 基建：每篇文档一个长尾词落地页、sitemap、OG 标签

验收标准：差异化立住——用户能在一个站里完成"读概念 → 看真图 → 做练习"闭环。

### P2 账号与进度

- ~~Clerk 注册登录~~ → 改用 Supabase Auth（邮箱魔法链接），砍掉 Clerk 依赖 ✓
- ~~Supabase + Drizzle~~：云端学习进度存档、错题本、学习统计 ✓
  - 5 张表（progress / wrongbook / quiz_scores / replay_history / replay_best）+ RLS
  - 双写同步层：localStorage 仍为即时真相，登录后 fire-and-forget 写云端
  - 登录时合并：云端拉取 + 本地取并集（进度并集、错题并集、测验取最高分、回放记录并集去重）
  - 12 个合并算法单元测试
- ~~章节解锁机制（闯关式路径）~~ → 改为软进度标记：学习路线页显示每章已读进度，不做硬性锁定（保全 SEO 与免费访问体验）✓

前置条件：P1 上线后有一定留存数据再动工。~~已满足，P2 上线~~

### P3 AI 陪学

- ~~RAG 检索知识库~~ Supabase pgvector ✓
- AI 对话：流式 + RAG context + 来源引用 ✓
- 错题驱动的自适应出题（针对薄弱概念生成变体题）——进行中
- 通用 LLM 客户端：原生 fetch，兼容任何 OpenAI 格式端点（不锁厂商）✓

设计原则：AI 出题判答，不是通用聊天机器人。

### P4 打磨与增长

- PostHog 分析、Sentry 监控（按流量决定）
- @vercel/og 分享卡片
- 冷启动分发：知乎回答、B站视频、雪球专栏引流
- 社区形态评估（Discord / 论坛）——放最后

## 架构决策记录

| 决策 | 结论 | 理由 |
|---|---|---|
| 框架 | Next.js | P1 起全是真交互，避免中途迁移 |
| 知识库接入 | git submodule 引用 kline-buty | 内容源唯一，两边节奏解耦 |
| 渲染解析 | 宽容模式 | 吸取 SVG 未落盘打挂构建的教训，半成品不打挂站点 |
| 向量检索 | Supabase pgvector | 201 篇量级不需要独立向量库 |
| 部署受众 | 全球中文用户，Vercel 免备案 | 金融内容备案风险高 |
| 图表能力 | 直接复用 kline-buty 数据层/渲染层解耦架构 | 最大资产复用 |

## 技术栈清单（按需引入）

| 层 | 选择 | 引入时机 |
|---|---|---|
| 框架 | Next.js + TypeScript | P0 |
| UI | Tailwind CSS + shadcn/ui + lucide-react | P0 |
| 搜索 | Pagefind | P0 |
| 测试 | Vitest + Playwright | P0 |
| CI/CD | GitHub Actions + Vercel | P0 |
| 行情数据 | 币安公开 API（复用 kline-buty 封装） | P1 |
| 认证 | Supabase Auth（邮箱魔法链接） | P2（砍掉 Clerk，少一个服务） |
| 数据库 | Supabase PostgreSQL + Drizzle ORM | P2 |
| LLM | Claude API + pgvector | P3 |

## 成功指标（参考）

- P0：站点上线、核心页面可索引
- P1：完课率 > 30%，练习功能使用率
- P2：注册转化、周留存
- P3：AI 出题参与率、错题重做率
- P4：自然搜索流量曲线（对标 content cluster 案例：6 个月关键词覆盖 600+）

## 关联项目

- [kline-buty](https://github.com/sun1090/kline-buty)：知识库源 + 图表/回放引擎来源
- [调研报告](research.md)：本规划的全部依据
