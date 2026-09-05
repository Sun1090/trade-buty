# 运营手册（Content Ops）

> v0.4 R6 内容运营自动化的脚本总览。所有脚本在仓库根目录执行；
> `npm run check:*` 为质量门禁（CI 每次推送运行），`npm run ops:*` / `npm run kb:*` 为运营工具。

## 质量门禁（CI 自动运行，失败阻断合并）

| 命令 | 检查什么 | 失败处理 |
|---|---|---|
| `npm run check:constitution` | 内容宪法：导流/荐股黑话、收益承诺表述（R6.11） | 默认报告式（教育语境豁免）；内容整改后可在 CI 加 `--strict` 升级阻断 |
| `npm run check:frontmatter` | 每篇课程 title/description 齐全且 description ≥15 字符（R6.5） | 补齐 frontmatter；章节 README 按契约豁免 |
| `npm run check:image-alt` | 知识库图片 alt 文本（R6.6） | 为对应图片补描述 |
| `npm run check:quiz-mounts` | quizzes.ts 挂载的 chapter/docSlug 真实存在（R6.3） | 修正 chapterNum 或 docSlug |
| `npm run check:quiz-coverage` | 题库覆盖率：27 章均可出题（R6.4） | kb-titles 缺章时补元数据 |
| `npm run check:sitemap` | 构建产物 sitemap 收录全部 zh 课程（R6.2，需先 build） | 检查 lib/content 宽松渲染是否误跳过 |
| `npm run check:ai-copy` | en 字典无中文残留（R3.12） | 修正 i18n.ts en 值 |

## 知识库更新流水线（`npm run kb:update` 自动执行）

1. 拉取 submodule 最新内容
2. **kb diff 摘要 + changelog 草稿**（R6.1/R6.10）：输出新增/删除课程清单，草稿写入 `docs/kb-changelog-draft.md`，人工审后并入正式更新日志
3. 契约校验、资产与搜索索引同步、构建回归
4. 快照 `scripts/kb-manifest.json` 随本次更新刷新（下次 diff 的基线）

## 翻译进度（R6.7）

```bash
npm run kb:translation-status
```

生成 `docs/translation-status.md`：27 章的 zh/en 章节版本与课程覆盖对照表，翻译排期的数据源。

## 术语交叉覆盖（R6.8）

```bash
npm run check:glossary
```

生成 `docs/glossary-coverage.md`：glossary 词条在知识库正文的命中情况；「孤儿术语」（正文零出现）列为内容补充候选。

## FAQ 候选（R6.9）

```bash
npm run ops:faq-candidates
```

从 `ai_feedback` 表近 30 天 unhelpful 反馈聚类高频问题，生成 `docs/faq-candidates.md`。
需要 `SUPABASE_SERVICE_ROLE_KEY`（读 .env.local）；未配置时友好跳过。

## 外链巡检（R6.12）

```bash
npm run ops:link-patrol
```

HEAD（失败降级 GET）+ 10s 超时 + 一次重试；失效外链 exit 1。
CI 里是**每月定时任务**（`.github/workflows/link-patrol.yml`，每月 1 日 03:00 UTC），也支持手动 workflow_dispatch 触发。

## Supabase 迁移清单（控制台 SQL Editor 手动执行）

| 迁移 | 内容 |
|---|---|
| 0002_ai.sql | kb_embeddings / ai_conversations / ai_feedback |
| 0004_ai_citation_clicks.sql | 引用点击统计表（R1.13） |
| 0005_user_settings.sql | 用户设置（每日目标档位，R4.7） |
| 0006_wrongbook_srs.sql | 错题本 SRS 字段（R5.7） |
