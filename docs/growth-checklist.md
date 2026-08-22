# 收录与增长清单（P1 → 运营过渡）

> 技术侧已就绪：sitemap（416 URL）、robots、OG 卡片、双语路由、全站 SSG。
> 以下按顺序执行，**标 [手动] 的需要你的账号，[自动] 的我可以直接做**。

## 1. 搜索引擎收录

- [手动] **Google Search Console**：https://search.google.com/search-console → 添加资源 `trade-buty.vercel.app`（DNS 验证走 Cloudflare）→ 提交 sitemap：`https://trade-buty.vercel.app/sitemap.xml`
- [手动] **Bing Webmaster**：https://www.bing.com/webmasters → 可从 GSC 一键导入
- [手动] **百度站长平台**：大陆用户能搜到才谈转化；Vercel 在大陆可访问性一般，优先级最低，最后做
- [自动] ✅ 每次推送后 Vercel 自动部署，sitemap 随构建更新

## 2. 内容分发（冷启动主渠道）

知识库 201 篇 = 天然的选题库。每个渠道的打法：

### 知乎
- 找高流量问题回答：「新手如何学炒股」「什么是止损」等（调研轮已确认这些是流量入口）
- 回答末尾放深度链接：「完整体系见 trade-buty.vercel.app」
- 频率：每周 2-3 答，先答已有知识储备的章节主题

### B 站
- 把「回放训练器」做成 60 秒演示短视频——这是最容易被截图传播的功能
- 「03 · K线与图表入门」适合改成系列入门视频

### 雪球 / 即刻
- 雪球专栏发章节精讲（注意：只发知识内容，绝不提个股）
- 即刻「一起做产品」圈子发建站过程，开发者社区引流

## 3. 数据观测

- [手动] GSC 上线两周后看：收录量、曝光关键词（验证长尾词策略）
- [自动] 待接 PostHog（P4）：当前先用 Vercel Analytics（[手动] Vercel 项目页开启即可，免费）

## 4. 迭代节奏建议

```
第 1 周   提交收录 + 注册 Vercel Analytics + 发第一批知乎回答（3 条）
第 2-4 周 每周 2-3 条知乎 + 1 条雪球；观察 GSC 曝光
第 5 周起 有真实用户数据后 → 验证 P2 留存效果
```

> P2 已上线（Supabase Auth + 云端进度存档）。以上原则转向：观察登录转化与跨设备留存。
