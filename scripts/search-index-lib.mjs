/**
 * R10.9：搜索索引新增文档回归——纯计算。
 *
 * 生成器 generate-search-index.mjs 直接遍历知识库，理论上每篇文档都有条目；
 * 但「索引 ↔ 构建页面 1:1」对账存在盲区：一篇新文档若既没被索引、页面又没建出
 * （渲染链路静默跳过），两侧一致会误报通过。本库补上 KB 期望 → 索引的覆盖维度：
 *   - notIndexed：KB 有文档而索引无条目（新增文档漏收录 → 回归）
 *   - orphanIndex：索引条目没有对应构建页面（指向死链）
 *   - unindexed：构建页面没有索引条目（页面漏索引）
 * I/O（读 KB、读索引、扫构建产物）留在 scripts/check-search-index.mjs。
 */
import { diffSitemapCoverage, isKnowledgeUrl } from "./sitemap-lib.mjs";

/**
 * @param {{ expected: string[], indexUrls: string[], builtUrls: string[] }}
 * @returns {{ notIndexed: string[], orphanIndex: string[], unindexed: string[] }} 各按字典序
 */
export function classifyIndexDeltas({ expected = [], indexUrls = [], builtUrls = [] } = {}) {
  const indexSet = new Set(indexUrls);
  const builtSet = new Set(builtUrls);
  const { missing: notIndexed } = diffSitemapCoverage({ expected, actual: indexUrls });
  const orphanIndex = [...indexSet].filter((url) => !builtSet.has(url)).sort();
  const unindexed = [...builtSet].filter((url) => isKnowledgeUrl(url) && !indexSet.has(url)).sort();
  return { notIndexed, orphanIndex, unindexed };
}
