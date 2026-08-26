# Trade Buty

[English](README.md) | **中文**

面向全球中文用户的**免费中立交易教育平台**：分级课程（学）× 真实行情图表与历史回放（练）。

> 不荐股 · 不导流 · 不承诺收益 · 基础课程永久免费

**在线访问**：<https://trade-buty.vercel.app>

## 产品形态

- **学**：27 篇章 / 173 篇课程的系统化交易知识库（源自开源项目 [kline-buty](https://github.com/sun1090/kline-buty)），三站式学习路线
- **练**：真实行情 K 线图（币安 REST + WebSocket）、盲盒式历史回放训练、猜涨跌考核
- **测**：27 章随堂测验（81 题全解析）、阅读进度追踪
- **双语**：中英 UI 全覆盖（`/zh` `/en`），移动端 320px 适配

## 技术栈

| 层 | 选择 |
|---|---|
| 框架 | Next.js 16 (App Router, SSG) · TypeScript · React 19 |
| 样式 | Tailwind CSS v4（CSS-first 主题 token，暗色终端风） |
| 图表 | lightweight-charts v5 |
| 内容 | kline-buty 知识库以 git submodule 引用，宽容模式渲染管线 |
| 搜索 | 构建时 JSON 索引 + 客户端检索 |
| 质量 | ESLint · tsc · Vitest-ready · Playwright 视觉审计 · GitHub Actions CI |

## 快速开始

```bash
git clone https://github.com/Sun1090/trade-buty.git
cd trade-buty
git submodule update --init   # 拉取知识库内容
npm install
npm run dev                   # http://localhost:3000
```

## 常用命令

```bash
npm run dev         # 开发服务器
npm run build       # 生产构建（prebuild 会同步资产/索引/契约校验）
npm run lint        # ESLint
npm run typecheck   # next typegen + tsc --noEmit
```

## 项目结构

```
src/
├── app/
│   ├── [locale]/          # zh/en 双语路由（页面全部 SSG）
│   │   ├── knowledge/     # 课程页：/[locale]/knowledge/{篇}/{节}
│   │   ├── chart/         # 实时行情
│   │   ├── replay/        # 回放训练器
│   │   ├── path/          # 学习路线
│   │   └── search/        # 站内搜索
│   └── sitemap.ts robots.ts
├── components/            # 图表 / 测验 / 进度等组件
├── lib/                   # content(渲染管线) i18n quizzes progress binance
├── middleware.ts          # 语言重定向
scripts/                   # 资产同步 / 搜索索引 / 契约校验
docs/                      # plan.md research.md p2-research.md
content/kline-buty/        # 知识库 submodule（只读）
```

## 文档

- [`docs/plan.md`](docs/plan.md)：产品定位、内容宪法、分期路线（P0–P4）
- [`docs/research.md`](docs/research.md)：六轮市场调研
- [`docs/p2-research.md`](docs/p2-research.md)：账号与云端进度预研
- [`AGENTS.md`](AGENTS.md)：Agent 工作规范与知识库契约

## 路线图

- ✅ P0 骨架：站点上线、搜索、SEO、CI/CD
- ✅ P1 边学边练：行情图表、回放训练、测验体系、双语
- ⬜ P2 账号与云端进度（见 `docs/p2-research.md`）
- ⬜ P3 AI 陪学（错题驱动出题 + RAG）
- ⬜ P4 打磨与增长

## 免责声明

本站全部内容仅用于学习与研究，不构成任何投资建议。加密货币及金融衍生品交易风险极高，据此操作风险自负。行情数据来自[币安公开 API](https://binance.com)，使用时请遵守其服务条款。

## 许可

MIT © sun1090（知识库内容版权归 kline-buty 项目所有）

## 赞助

如果这个项目对你有帮助，可以请作者喝杯咖啡，支持持续更新 ☕

<table>
  <tr>
    <td align="center"><img src="public/donate-alipay.jpg" width="200" alt="支付宝赞赏码" /><br/>支付宝</td>
    <td align="center"><img src="public/donate-wechat.jpg" width="200" alt="微信赞赏码" /><br/>微信</td>
  </tr>
</table>
