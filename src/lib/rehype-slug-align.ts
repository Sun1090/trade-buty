/**
 * 把标题 id 对齐到**知识库自己的 slug 规则**（R16.114）。
 *
 * 同一批课文有两个渲染器，两边的 id 规则不一样：
 *  - kline-buty 的 `scripts/kb-anchor-check.mjs` 用自己的 `slugify()`，末尾有一步
 *    `.replace(/^-|-$/g, '')` —— **去掉首尾的连字符**；
 *  - 本站的 `rehype-slug`（GitHub 规则）没有这一步。
 *
 * 于是标题里以标点开头的（例如 `## ⑤ 金银比与油金比：…`）在两处得到不同的 id：
 * 知识库给 `金银比与油金比…`，`rehype-slug` 给 `-金银比与油金比…`（多一个前导 `-`）。
 * 而课文里的锚点是**按知识库那套手抄的**（作者对着 VitePress 的实际 id 抄），
 * 于是 `[⑤](#金银比与油金比…)` 在本站点不动 —— 这就是 R16.114 那两条。
 *
 * **为什么改渲染器而不是改课文**：内容是 `content/kline-buty` 子模块，本仓明文规定
 * 「never edit its content in-place」（AGENTS.md「Non-reversible Product Decisions」），
 * 改上游就得为两个站点的取舍做跨仓拍板；而本站渲染器本来就该按内容契约对齐。
 *
 * 只做「剥掉首尾连字符」这一步，**不重写 slug 算法**：其余差异（`·` → `--` vs `-` 等）
 * 全库有 2264 处标题，但**没有任何一条锚点链接指向它们**（全库 `](#…)` 链接只有 8 条，
 * 见同批的 `kb-anchor-links.test.mjs`），改了只会扩大影响面而无收益。
 * 哪天真要用上「按标题生成目录」，再连算法一起对齐，那时该由那条需求来驱动。
 */
import type { Root } from "hast";

/** rehype 插件：标题 id 剥掉首尾连字符，与知识库 slugify 的最后一步一致 */
export function rehypeSlugAlign() {
  return (tree: Root) => {
    const visit = (node: { type: string; tagName?: string; properties?: Record<string, unknown>; children?: unknown[] }) => {
      if (node.type === "element" && node.tagName && /^h[1-6]$/.test(node.tagName)) {
        const id = node.properties?.id;
        if (typeof id === "string") {
          const trimmed = id.replace(/^-+/, "").replace(/-+$/, "");
          // 全剥光时（标题非拉丁字符且被剥净）保留原值，避免出现空 id
          if (trimmed) node.properties = { ...node.properties, id: trimmed };
        }
      }
      for (const child of (node.children ?? []) as typeof node[]) visit(child);
    };
    visit(tree as unknown as { type: string; children?: unknown[] });
  };
}