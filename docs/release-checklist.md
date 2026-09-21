# 发布检查单（Release Checklist）

> 任何一次发布都按本清单从上到下执行，不靠记忆。`npm run check:docs` 会断言本文件存在且
> 关键步骤（判级、release-notes、CHANGELOG、版本号、tag、全量门禁、部署、生产冒烟、回滚）
> 仍在，缺段落即 CI 变红。
>
> 权威门禁清单以 [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) 为准，逐条释义见
> [`docs/ops.md`](ops.md)（二者的对应关系由 `scripts/ci-workflow.test.mjs` 契约测试强制）。

## 0. 判级

- **patch `X.Y.Z+1`**：只有缺陷修复、门禁/工具链加固、文案与文档，没有新增产品能力。
- **minor `X.Y+1.0`**：新增或完整交付一个功能阶段（一个 roadmap milestone 关账）。
- **major `X+1.0.0`**：内容契约、数据结构、鉴权/数据隔离语义发生不兼容变更。

判级只看已合入 `main` 且尚未发布的提交，不看计划中的工作。

## 1. 冻结前检查（RELEASE_FREEZE）

```bash
git fetch origin
npm run ops:work-audit      # 必须无悬空提交、无未确认的关闭 PR
git log --oneline origin/main..HEAD   # 应为空：发布内容只能来自 main
```

发布分支从最新 `origin/main` 切出（本仓库禁止直接向 `main` 推送，发布也走 PR）。

## 2. 发布记录与版本号

1. 在 `src/data/release-notes.json` 追加本次版本条目：**zh / en 双语齐全、highlights 条数相等、
   按日期排序**。`CHANGELOG.md` 只由该文件生成，不要手改生成物。
2. `npm run changelog:generate` 后跑 `npm run check:changelog`。
3. 把 `package.json` 的 `version` 同步到新版本号，并用仓库钉住的 npm 重算锁文件：

```bash
npx --yes npm@10.9.4 install --package-lock-only
npm run check:lockfile-repro   # npm 版本不一致会产出不稳定 diff
npm run check:docs             # 版本号与最新已发布版本绑定
```

`npm run check:release-tag` 此时应打印「最新发布版本待合并后补打」而**不判失败**——
rebase 合并会改写 SHA，tag 只能在合并后打到 `main`。

## 3. 全量验证（顺序有耦合，不可打乱）

```bash
npm run test
npm run test:coverage     # 阈值只许上调，不许为过门禁下调（R14.12）
npm run lint
npm run typecheck
npm run build
npm run check:mobile
# 构建产物门禁必须在 e2e 之前：e2e 会往 .next 写兜底页
npm run check:seo-surface
npm run check:search-index
npm run check:structured-data
npm run check:risk-warning
npm run check:constitution
npm run check:docs
npm run db:test
npm run e2e               # 放最后
```

判据：无随机红灯、`git status` 干净（报告类产物内容未变时不得产生纯日期 diff）、
无需要人工判断的顺序耦合。

## 4. 发布提交与合并

- 提交信息用 Angular Convention，一个提交一件事；发布提交形如 `chore(release): ship vX.Y.Z`。
- 推送发布分支 → 开 PR → 等 `ci` 与 `db-tests` 两项必需检查变绿（二者为 strict 必需检查）。
- 合并只能用 rebase：`gh pr merge <n> --rebase`。禁止 merge commit、force push、改写共享分支。

## 5. 合并后：tag、部署、生产冒烟

```bash
git fetch origin && git switch main && git merge --ff-only origin/main
git tag -a vX.Y.Z origin/main -m "vX.Y.Z"
git push origin vX.Y.Z
npm run check:release-tag          # 必须不再打印待办
```

Vercel 由 `main` 的推送自动触发生产构建（账号有 24h 构建配额，连续触发会被限流；
被限流时记录原因，不要为了「绿」重复空跑）。部署完成后对**生产域名**冒烟：

```bash
node -e '
const base = "https://trade-buty.vercel.app";
const paths = ["/zh", "/en", "/zh/knowledge/getting-started",
  "/zh/knowledge/getting-started/candlestick-basics", "/sitemap.xml", "/robots.txt"];
(async () => {
  for (const p of paths) {
    const r = await fetch(base + p);
    const html = await r.text();
    console.log(p.padEnd(52), r.status, "risk=" + html.includes("⚠️"));
  }
})();'
```

必须逐条确认（这些是历史上真出过问题的入口）：

- `GET /api/auth/session` 匿名访问返回 `200 {"user":null}`，不是 500（游客判定回归，PR #107）。
- 未登录状态下 AI 问答可用，不返回 502。
- 页面 HTML 里带 `⚠️` 风险提示；`/share/*` 落地页同样要带（R14.7）。
- 预览域受 Vercel Deployment Protection 保护，未授权请求 302 到 SSO，因此自动化冒烟走生产域名
  （见 R14.9，需账号级 protection-bypass 密钥才能真正覆盖预览）。

## 6. 记录与收尾

- `docs/progress.md` 追加发布条目：版本、判级理由、tag SHA、部署结果、生产冒烟逐条结论、
  回滚方案、下一里程碑与更新时间。
- 远端临时分支是 PR 的运输工具而非存储：PR **确实合并后**立即删除其远端分支并 `git remote prune origin`。
- 关闭对应 milestone 的 roadmap 勾选（`docs/roadmap.md`），随即进入下一个里程碑的盘点。

## 7. 回滚

1. 站点回滚优先 `git revert` 发布提交（或其中单个逻辑提交）后重新部署；不要用 `reset --hard` 改写 `main`。
2. Vercel 亦可直接把 Production Deployment 切回上一个正常构建，作为止血手段，随后仍需用 revert 收敛历史。
3. 含数据库迁移的发布：先确认 down 迁移与数据回滚路径已演练（`npm run db:test`、`npm run backup:drill`），
   未演练不得发布。
4. 在 `docs/progress.md` 写清回滚边界与触发条件，避免回滚把线上回归一起带回。

## 已知陷阱

- `npm run e2e` 会向 `.next` 写入兜底页面；先跑 e2e 再跑产物门禁会出现假失败。
- `docs/progress.md` 为追加式长文件，多分支并行时 rebase 必然冲突；解决时**两侧都保留**，
  新条目放文件末尾。
- Vercel 构建配额（24h）耗尽时 PR 上的 Vercel 检查会红，但它不是必需检查，不阻塞合并。
