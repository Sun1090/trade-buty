# Roadmap v0.3「运营与硬化」（下一版本 · 36 项）

> 前版本状态（已核验）：P0 骨架、P1 边学边练、双语 UI、回放训练、测验/错题本地版、
> 云端同步（sync-layer + RLS + auth 全链路已在树内）、AI 功能（/api/ai）、PWA manifest、
> sitemap/robots、阅读工具链 —— 235 单测全绿。
>
> v0.3 不做大功能，只做三件事：内容运营自动化、质量门禁、增长收尾。
> 每项标注验证方式；`[手动]` 需账号或人工操作。

## Q1 内容运营自动化（Q1.1–Q1.8）

- [x] Q1.1 `kb:update` 一条龙（拉取 + 契约校验 + 索引/资产同步 + 构建回归）
- [x] Q1.2 en 中英 parity 跟踪脚本（`npm run kb:parity`，--strict 可做门禁；当前 27/27 全齐）
- [x] Q1.3 死链检查脚本（`npm run check:links`，436 页/8052 链接零死链，CI 阻断；2 处 en 锚点告警已定位为上游翻译遗留）
- [x] Q1.4 搜索索引对账（`npm run check:search-index`，400/400 对账通过，CI 阻断）
- [ ] Q1.5 frontmatter 质量门禁已在 prebuild（缺 title/description 报警）——确认 CI 日志可见
- [ ] Q1.6 KB 更新演练月度化：每月跑一次 kb:update 并记录变更（docs 下 changelog 片段）
- [ ] Q1.7 新章节上线清单（索引/sitemap/测验挂载点/路径分组四项核对）
- [x] Q1.8 kline-buty 侧 en 翻译收官（27 章全齐，已上线）

## Q2 质量门禁（Q2.1–Q2.8）

- [x] Q2.1 i18n 深层 parity 测试（全字典递归比对，CI 常驻）
- [x] Q2.2 Bundle 体积预算（`npm run check:bundle`，内容页 280KB/chart 360KB，CI 阻断；基线 217KB 为框架固定成本）
- [x] Q2.3 Lighthouse CI（三页门禁：a11y/bp/seo≥90 error，性能≥70 warn；实测首页87/课程95/图表65）
- [ ] Q2.4 a11y 抽查：键盘全程可操作（测验答题、回放控制、灯箱 ESC）、焦点可见、表单 label
- [x] Q2.5 320px 回归（`npm run check:mobile`，12 关键页，CI 阻断；修掉 path/knowledge-graph 两处 grid truncate 溢出）
- [ ] Q2.6 错误边界覆盖率：图表/搜索/AI 三个外部依赖入口都有降级 UI
- [ ] Q2.7 [手动] Sentry（或同类）错误监控接入 + 告警通道
- [ ] Q2.8 [手动] RLS/越权/双设备同步线上联调（需 Supabase keys）

## Q3 增长收尾（Q3.1–Q3.6）

- [ ] Q3.1 [手动] Google Search Console 提交 sitemap + 请求编入索引
- [ ] Q3.2 [手动] Bing Webmaster（可从 GSC 导入）
- [ ] Q3.3 [手动] Vercel Analytics 开启（免费档）
- [ ] Q3.4 [手动] PostHog 事件埋点评审（P4 按流量决定是否接入）
- [ ] Q3.5 分享链路走查：OG 卡片在微信/X/Telegram 的实际渲染抽查
- [ ] Q3.6 [手动] 冷启动内容分发（知乎/B站/雪球，见 docs/growth-checklist.md）

## Q4 体验 backlog（按需认领，非阻塞）

- [ ] Q4.1 回放自定义窗口：自选币种/周期/起点（当前盲盒随机）
- [ ] Q4.2 回放训练自定义窗口：自选币种/周期/起点（当前为随机盲盒）
- [ ] Q4.3 搜索建议词与热门搜索（基于索引词频，无后端）
- [ ] Q4.4 课程页「预计阅读时长」多语言文案复核
- [ ] Q4.5 深色/浅色主题对比度抽查（WCAG AA 关键文字）
- [ ] Q4.6 长文档 TOC 移动端抽屉版评审（当前仅桌面端展示）

## Q5 工程卫生（Q5.1–Q5.4）

- [ ] Q5.1 docs 与实现一致性走查（plan/research/p2-research 过时段落更新）
- [ ] Q5.2 AGENTS.md 契约段复核（KB 结构若再变，同步更新）
- [ ] Q5.3 依赖月度审计（npm outdated + 安全通告）
- [ ] Q5.4 [手动] 备份演练：Supabase 数据导出 + 仓库镜像确认

## 版本关账标准

1. Q1–Q2 全绿（含新增 CI 门禁三次连续通过）
2. Q3 手动项由维护者确认完成或明确延期
3. 线上抽查：首页/课程/图表/回放/搜索 5 条核心路径 200
