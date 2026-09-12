# 新章节上线清单（Q1.7）

新章节合入 `kline-buty` 前先运行 dry-run；脚本会按以下四项输出 `✅ / ⚠️ / ❌`，而不是只检查目录结构。

```bash
npm run kb:dry-run -- --draft /path/to/new-chapter
```

## 1. 搜索索引

- dry-run 要求章节有 `README.md`，并统计草稿课程数。
- 合入后由 `prebuild` 执行 `generate-search-index.mjs`，章节导读和全部课程必须进入 `public/search-index.json`。
- 发布前在干净构建后运行：

```bash
npm run build
npm run check:search-index
```

失败通常表示新课程没有进入索引，或索引里残留了已删除页面。不要手工改 JSON；修正知识库输入后重新生成。

## 2. sitemap

- sitemap 从同一套知识库内容枚举章节页与课程页，dry-run 确认草稿具备生成条件。
- 发布前在干净构建后运行：

```bash
npm run build
npm run check:sitemap
```

失败会分别列出「KB 有但 sitemap 缺」和「sitemap 有但 KB 已删」。两类都阻断发布。

## 3. 测验挂载点

- 若使用站方固定题，必须在 `src/lib/quizzes.ts` 增加 `QUIZZES["<chapter>"]`，并让 `docSlug` 指向草稿内真实课程；dry-run 会直接校验。
- 若暂不提供固定题，dry-run 显示 `⚠️`，课末使用 AI 出题回退；这是一个显式决策，不应误当成固定题已上线。
- 校验命令：

```bash
npm run check:quiz-mounts
npm run check:quiz-coverage
```

## 4. 路径分组

- `/path` 与知识图谱只展示 `src/lib/path.ts` 的 `STAGES.chapterNums` 中登记的章节；仅加入 `CHAPTER_ORDER` 不足以让新章出现在路径页。
- 固定章节序还需同步 `src/lib/kb-order.ts` 与 `scripts/nav-chain-lib.mjs` 两张顺序表。
- 若新章按字母序兜底，dry-run 会警告而不是放行一个「看似已展示」的章节。
- 发布前额外确认路径页：

```bash
npm run build
npm run e2e -- --grep '学习路径'
```

## 合入与发布顺序

1. 在 `kline-buty` 仓库完成 zh/en 内容，不在本站 submodule 内直接编辑。
2. 运行 dry-run，逐项处理四项核对；固定题和路径分组若选择不配置，必须确认是可接受的产品行为。
3. 回到本站运行 `npm run kb:update`，提交 submodule 指针、相关派生文件与变更记录。
4. 运行完整发布门禁：`npm test`、`npm run lint`、`npm run typecheck`、`npm run build`，以及上表内容产物命令和 `npm run e2e`。
5. 远端 CI、Vercel 预览与线上 smoke 全部通过后才视为上线完成；仅有本地 dry-run 不等于发布完成。
