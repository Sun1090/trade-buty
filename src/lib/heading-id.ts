/**
 * 标题 id 的**唯一**对齐口径（R16.114 / R16.301）。
 *
 * 同一批课文要喂三个互不相通的 slug 实现，任何一处各写各的都会漏：
 *
 * | 实现 | 位置 | 首尾连字符 |
 * |---|---|---|
 * | 知识库 `slugify()` | kline-buty `scripts/kb-anchor-check.mjs` | 剥掉 |
 * | `rehype-slug`（github-slugger） | 正文标题 id | 保留 |
 * | `github-slugger`（`extractHeadings`） | 本页目录 TOC | 保留 |
 *
 * 课文里的锚点是**按知识库那套手抄的**（作者对着 VitePress 的实际 id 抄），
 * 所以正文 id 与目录 href 都得按「剥首尾连字符」这一口径出。
 *
 * **为什么是共享函数而不是各自 `.replace()`**：
 * 第一版只改了渲染器（`rehype-slug-align`），没改 TOC —— 因为当时只量了正文里的
 * `](#…)` 链接，**没量目录**。上线后一查生产才发现「本页目录」里点不动的条目比正文
 * 那两条更多，且更显眼（目录是用户的主要入口）。两份各写各的口径必然再次走散，
 * 所以对齐逻辑只此一份，两个调用方都从这里取。
 *
 * **只做剥连字符，不重写整个 slug 算法**：其余差异（`·` → `--` vs `-` 等）全库有
 * 2264 处标题，但**没有任何一条锚点或目录条目指向它们**。真要用上「按标题生成目录」的
 * 完整对齐时，该由那条需求驱动，而不是顺手做。
 */

/**
 * 把一个 slug 对齐到本站对外承诺的口径：剥掉首尾连字符。
 *
 * 全剥光时（例如标题只有标点）返回原值，避免产生空 id —— 空 id 会让
 * `getElementById("")` 命中 null，目录点击静默失效。
 */
export function alignHeadingId(id: string): string {
  const trimmed = id.replace(/^-+/, "").replace(/-+$/, "");
  return trimmed || id;
}