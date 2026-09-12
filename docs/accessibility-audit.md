# 核心交互无障碍审计（Q2.4）

日期：2026-09-12  
范围：课程阅读、随堂测、行情图、回放训练、搜索筛选、邮件订阅占位  
基线：`codex/r13-e2e-expansion`，`origin/main@abe8106`

## 结论

核心学习闭环已经可以用键盘完成，关键控件有稳定的可访问名称，键盘焦点使用全局 `:focus-visible` 焦点环。Q2.4 的自动化抽查关账；这不等于完整 WCAG 合规审计，屏幕阅读器和跨浏览器人工走查边界见下文。

## 交互契约

| 范围 | 键盘/辅助技术契约 | 回归证据 |
| --- | --- | --- |
| 课程图片灯箱 | 图片获得 `role="button"`、`tabindex=0`、`aria-haspopup="dialog"`；Enter/Space 打开；Escape 关闭；焦点归还图片 | `markdown.test.tsx`、`image-lightbox.test.tsx`、`e2e/full-site.spec.ts` |
| 随堂测 | A/B/C 选项可用 Enter 或 Space 选择，可完成三题并显示结果 | `e2e/full-site.spec.ts` |
| 回放训练 | 品种/周期有本地化名称；速度、难度、模式等按钮暴露 `aria-pressed`；难度与速度有分组标签；跳到末尾有稳定名称 | `e2e/full-site.spec.ts` |
| 行情图 | 交易对/周期按钮与自定义交易对输入有可访问名称；周期切换可被键盘触发 | `kline-chart.tsx`、`e2e/full-site.spec.ts` |
| 搜索筛选 | 篇章下拉框有本地化 `aria-label`，不依赖视觉位置 | `search-client.test.tsx` |
| 邮件订阅 | 邮箱输入有本地化可访问名称；保存仍保持本机存储约定 | `newsletter-signup.test.tsx` |
| 全站焦点样式 | `src/app/globals.css` 的 `:focus-visible` 提供 2px solid 主题色 outline 和 2px offset；组件不得用裸 `outline-none` 抑制 | Playwright 计算样式断言覆盖测验、回放、图表、订阅 |

## 验证

```bash
npx vitest run \
  src/components/markdown.test.tsx \
  src/components/image-lightbox.test.tsx \
  src/components/newsletter-signup.test.tsx \
  src/components/search-client.test.tsx \
  src/lib/i18n.test.ts

npm test
npm run lint
npm run typecheck
npm run build
npx playwright test e2e/full-site.spec.ts -g 'Q2.4'
npm run e2e
```

结果（2026-09-12）：

- 定向 Vitest：5 文件 / 32 用例通过。
- 全量 Vitest：164 文件 / 1286 用例通过。
- lint：0 error / 59 条既有 warning。
- typecheck、build：通过；构建 465 个静态页。
- Q2.4 Playwright：3/3 通过。
- 完整 Playwright：56/56 通过。

## 未覆盖边界

- 未做 NVDA / VoiceOver 真机屏幕阅读器走查。
- 未做 Safari / Firefox 的人工键盘焦点走查。
- Lighthouse 的 a11y 分数仍以既有 CI 阈值为准，本文件不把自动分数等同于人工合规结论。
- 本周期权限为 `LOCAL_ONLY`，远端 CI、PR 与部署不在本审计声明内。
