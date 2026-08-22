# AGENTS.md

本文件是 Agent 工作入口，负责路由到具体规则；不要把所有细则堆在这里。

## 项目一句话

Trade Buty 是面向全球中文用户的免费中立交易教育平台：分级课程（学）× 真实行情图表与回放（练）。内容源复用 [kline-buty](https://github.com/sun1090/kline-buty) 的交易知识库。

## 必读顺序

1. [`docs/plan.md`](docs/plan.md)：产品定位、分期路线、内容宪法红线
2. [`docs/research.md`](docs/research.md)：六轮市场调研结论
3. 改代码前：读本页全部小节；Next.js 相关见下方自动生成块

## 当前不可回退的产品决策

- **内容宪法**：不承诺收益、不荐股荐基、不做券商导流；每篇内容必须有「⚠️ 风险提示」块
- P0–P3 全程免费；基础课程永远免费
- 面向全球中文用户，Vercel 免备案部署；不做大陆 ICP 备案路线
- 知识库是 submodule 引用（`content/kline-buty`），**禁止在站内修改其内容**；改动一律去 kline-buty 仓库
- Markdown 渲染必须宽容模式：缺 frontmatter / 缺资产的文档告警跳过，不允许打挂构建
- 框架定为 Next.js（App Router），不再讨论 Astro / VitePress 迁移

## 常用命令

```bash
npm run dev          # 开发服务器（localhost:3000）
npm run build        # 生产构建（必须在仓库根目录跑）
npm run lint         # ESLint
npm run typecheck    # 类型检查（tsc --noEmit）
```

## 命名约定（本仓库）

- 本仓库自建文件（组件、脚本、文档、题库等）一律**英文命名，不加序号前缀**
- 知识库 submodule 内容不适用本条（其命名由 kline-buty 仓库决定）

## 知识库契约（构建依赖，改动需同步）

本站解析依赖 kline-buty 的以下结构（2026-08 双语重构版），kline-buty 侧重构时必须评估影响：

1. 根目录按语言分根：`docs/knowledge/{zh,en}/`；zh 应完整 27 篇章，en 允许逐步补齐
2. 每个篇章为英文 slug 目录（如 `getting-started/`），内含 `README.md`（篇章导语，标题在 H1，格式 `NN · 名称`）
3. 课程文件名为英文 slug（如 `candlestick-basics.md`），排序依据 frontmatter `title` 的前导数字
4. frontmatter 字段：`title`、`description`
5. 篇章间相对链接使用 slug：`(../futures/)`、`(../futures/margin.md)`
6. 资产在各篇章 `_assets/` 下
7. VitePress 遗留：`## 篇目一览` + `<DocCards/>` 由本站渲染管线过滤

站点 URL 直接使用 slug：`/[locale]/knowledge/{chapter}/{doc}`。旧数字路由已废弃。

## Submodule 操作规范

- 首次 clone 后需要 `git submodule update --init` 才有内容
- 更新知识库：`npm run kb:update`（拉取 + 契约校验 + 资产/索引同步 + 构建回归，一条龙）
- 提交包含 submodule 指针变更时，commit message 说明同步到了哪个知识库版本
- 构建前确认 `content/kline-buty/docs/knowledge/` 存在，缺失时给出明确报错而不是空页面

## 内容渲染约定（与知识库的契约）

- 篇章目录：`docs/knowledge/NN-*/`，篇章导语为目录内 `README.md`，正文为编号 `.md` 文件
- frontmatter 契约字段：`title`（`NN · 标题`）、`description`；缺字段降级用文件名/首行标题
- VitePress 容器语法（`::: warning 标题 ... :::`）在渲染管线中转换为 callout 块
- 相对链接与 `_assets/` 图片路径需重写为站内路由；资产由 prebuild 脚本拷贝到 `public/knowledge-assets/`
- 锚点链接必须让页面真实滚动到目标标题

## 提交规范

- Angular Convention（`feat(scope): ...`）
- 不加 `Co-Authored-By` 等任何 AI 署名
- 提交只含一个逻辑主题
