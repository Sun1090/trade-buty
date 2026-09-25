# Scan-count baseline

<!-- 由 `npm run check:scan-counts` 重算，勿手改。要有意缩小：跑 `npm run check:scan-counts -- --update-baseline` 并把理由写进提交信息。 -->

这一份记的是**各计数型门禁上一次入库时实际扫到的数量**。各门禁自己的硬地板（`scanFloorViolation`）
只卡跌破地板的那部分少扫，地板与实测之间那点余量归这张表管：任何一键比入库时小，
`check:scan-counts` 就红——「删掉一批文件」从此必须显式认账，而不是靠人自己想起来改数。

| key | 数量 | 硬地板 | 数的是什么 |
| --- | ---: | ---: | --- |
| api-route-files | 12 | 11 | route.ts 接口文件 |
| db-audited-docs | 2 | 2 | 对账用的现行文档 |
| kb-en-md-files | 209 | 200 | en 树 md 文件 |
| kb-md-files | 419 | 400 | 知识库 md 文件 |
| kb-zh-md-files | 209 | 200 | zh 树 md 文件 |
| secrets-listed-files | 802 | 700 | git 列出的待扫文件 |
