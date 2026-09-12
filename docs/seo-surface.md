# 可索引表面（sitemap / robots / robots meta）

> R13.17 发布复核结论 + 长期契约。声明文件：`src/lib/seo-surface.json`；
> 产物复核门禁：`npm run check:seo-surface`（CI 每次推送运行，需先 `npm run build`）。

## 一句话规则

**robots.txt 管「不要抓取什么」，页面 `noindex` 管「不要收录什么」，sitemap 只放「可以被收录的页面」。**
三者必须由同一份声明生成，任何一组出现矛盾都会被搜索引擎直接报错。

## 声明（唯一事实来源）

`src/lib/seo-surface.json` 三组数据：

| 键 | 含义 | 谁在用 |
|---|---|---|
| `indexable` | 允许收录的静态路径（locale 相对）+ `changefreq` / `priority` | `src/app/sitemap.ts` |
| `noindex` | 页面显式声明 `noindex` 的静态路径，不进 sitemap | 页面各自的 `generateMetadata` |
| `robotsDisallow` | 只放「不该被抓取」的东西 | `src/app/robots.ts` |

应用侧通过 `src/lib/seo-surface.ts` 读取，脚本侧通过 `scripts/seo-surface-lib.mjs` 读取同一份 JSON。

## 当前收录策略

| 分类 | 路径 | 处理 |
|---|---|---|
| 入口与工具 | `/`、`/path`、`/chart`、`/replay`、`/review`、`/search` | 可索引，进 sitemap |
| 知识库 | `/{locale}/knowledge/{chapter}[/{doc}]` | 可索引，全部进 sitemap（418 页） |
| 个人数据 | `/stats`、`/bookmarks` | `noindex`（内容只存在于访客本地存储，爬虫只能看到空壳） |
| 法律/说明 | `/privacy`、`/terms`、`/about`、`/changelog` | `noindex`（站内信任页，无需搜索流量） |
| 内容索引页 | `/faq`、`/glossary`、`/calendar` | `noindex`（避免与课程页争同一批长尾词） |
| 功能页 | `/ai`、`/auth`、`/auth/callback` | `noindex` |

### 为什么 auth 是唯一「既 noindex 又 Disallow」的路径

`/*/auth` 同时出现在 `robotsDisallow` 与 `noindex` 集合里，这是唯一的例外：OAuth 回调 URL 带一次性凭据，
宁可让爬虫整个抓不到，也不要让它进入抓取与索引队列。其余所有 `noindex` 页面都必须保持可抓取——
被 `Disallow` 挡住的 URL，爬虫读不到 `noindex`，反而可能以「无标题、无描述」的形式出现在结果里。

## 软 404

未知章节 slug / 未知课程 slug 会渲染带推荐的 404 文案，但 HTTP 状态仍是 200（App Router 在
动态段内 `notFound()` 之外的软 404 分支无法改状态码）。这类页面通过
`buildSoftNotFoundMetadata()` 自报 `noindex, follow`：

- `noindex`：避免搜索引擎把这些 URL 当真实页面收录；
- `follow`：保留推荐位的内链权重；
- **不产出 canonical**：指向一个不存在的 URL 只会制造重复信号。

## sitemap 的 `lastmod`

知识库页面的 `lastmod` 取知识库子模块 HEAD 的提交时间（`src/lib/kb-freshness.ts`），
内容没动就不会变；拿不到 git 信息（打包部署、浅克隆、非子模块目录）时退回构建时间，
保证 sitemap 永远可生成。此前「所有页面都标成构建时间」等于告诉搜索引擎全站天天在变，
Google 会直接忽略该信号。

非知识库入口页不声明 `lastmod`——它们的更新时间没有可信来源，宁可不写。

## 门禁检查内容（`check:seo-surface`）

1. `robots.txt` 声明绝对 `Sitemap`，`Disallow` 与声明文件逐条一致；
2. sitemap URL 为 https 绝对地址、无重复、`lastmod` 合法且不在未来；
3. sitemap 中不存在被 `Disallow` 命中的路径（两份产物互相打架）；
4. 声明为可索引的页面：存在于产物、在 sitemap 内、无 `noindex`、canonical 指向自身；
5. 声明为 `noindex` 的页面：不在 sitemap 内、确实带 `noindex`；
6. 知识库页面全部可索引、全部进 sitemap、canonical 指向自身；
7. 构建产物里不存在未归类的页面——新增页面必须显式声明收录策略。

> 门禁读 `.next` 产物，必须在 `npm run build` 之后、Playwright 之前运行（E2E 会写入动态 fallback 页）。
> 若刚跑过 E2E，请先重新构建；门禁报错信息里也带这句提示。

## 新增页面 checklist

1. 在 `src/lib/seo-surface.json` 的 `indexable` 或 `noindex` 里登记路径；
2. `noindex` 页面在 `generateMetadata` 里传 `noindex: true`（用 `buildPageMetadata`）；
3. 可索引页面用 `buildPageMetadata` 保证 canonical + OG 完整；
4. `npm run build && npm run check:seo-surface`。
