/**
 * R10.10：章节导航与上一篇/下一篇链路回归——纯计算。
 *
 * 站点导航语义（src/lib/content.ts / kb-order.ts）：
 * - 章节顺序 = 固定表 CHAPTER_ORDER（未登记新章节排末尾 1000+）。
 * - 章内课程顺序 = zh 版 frontmatter title 前导序号（NN ·）为基准；
 *   en 镜像 zh 的同名 slug 顺序，en 独有 slug 排后（titleOrder/slug 兜底）。
 * 本库校验三条不变量（页面可正常渲染但链路语义错乱时，死链检查看不见）：
 *   1. 每章课程序列成一条无环链：从首篇沿 next 能走完且恰好覆盖全部（无分叉/自环）。
 *   2. zh 章内前导序号不重复（重复 → 实际排序回退 slug 字母序，与 NN 意图冲突）。
 *   3. zh↔en 共享 slug 的相对顺序一致（en 镜像 zh）。
 * I/O（读 KB）留在 scripts/check-nav-chain.mjs。
 */

/** 与 src/lib/kb-order.ts 同步的篇章规范顺序（zh 01–27；新章节须在此登记）。 */
export const CHAPTER_ORDER = [
  "getting-started",
  "spot",
  "stocks",
  "futures",
  "crypto-perpetuals",
  "markets-instruments",
  "technical-analysis",
  "trading-system",
  "pitfalls",
  "trading-practice",
  "system-integration",
  "market-ecosystem",
  "financial-history",
  "wealth-allocation",
  "quant-practice",
  "data-interpretation",
  "global-markets",
  "regulation-compliance",
  "tools-platforms",
  "financial-statements",
  "industry-research",
  "reading-list",
  "behavioral-finance",
  "bonds-rates",
  "forex-trading",
  "career",
  "options-strategies",
];

/** 由有序 slug 列表构造 prev/next 链（首篇 prev=null，末篇 next=null）。 */
export function chainFromSorted(slugs = []) {
  const prev = new Map();
  const next = new Map();
  slugs.forEach((slug, i) => {
    prev.set(slug, i > 0 ? slugs[i - 1] : null);
    next.set(slug, i < slugs.length - 1 ? slugs[i + 1] : null);
  });
  return { head: slugs.length > 0 ? slugs[0] : null, tail: slugs.length > 0 ? slugs[slugs.length - 1] : null, prev, next };
}

/**
 * 从 head 沿 next 走链。返回 { order, ok, cycle }：
 *   ok=false 当遇到环或访问数 ≠ 预期总数（分叉/重复）。
 */
export function walkChain(head, next, total) {
  const seen = new Set();
  let cursor = head;
  const order = [];
  while (cursor !== null) {
    if (seen.has(cursor)) return { order, ok: false, cycle: true };
    seen.add(cursor);
    order.push(cursor);
    cursor = next.get(cursor) ?? null;
  }
  return { order, ok: seen.size === total, cycle: false };
}

/** 找出共享同一前导序号的 zh 课程（重复序号 → 排序歧义）。
 * 只关心显式编号（1–998）：titleOrder 对无前导数字的标题统一回退 999，
 * 999 重复走 slug 字母序兜底是设计内行为（content.ts 同序回退），不构成歧义。
 * docs: [{slug, order}] */
export function duplicateOrders(docs = []) {
  const byOrder = new Map();
  for (const d of docs) {
    const key = d.order;
    if (!Number.isFinite(key) || key >= 999) continue;
    if (!byOrder.has(key)) byOrder.set(key, []);
    byOrder.get(key).push(d.slug);
  }
  return [...byOrder.entries()]
    .filter(([, slugs]) => slugs.length > 1)
    .map(([order, slugs]) => ({ order, slugs }))
    .sort((a, b) => a.order - b.order);
}

/**
 * zh↔en 共享 slug 相对顺序一致性。
 * zh/en 为各自章内有序 slug 数组；返回相对顺序与 zh 冲突的 slug 对。
 * @param {{ zh: string[], en: string[] }} [chains]
 * @returns {[string, string][]}
 */
export function sharedOrderViolations({ zh = [], en = [] } = {}) {
  const zhIndex = new Map(zh.map((slug, i) => [slug, i]));
  const shared = en.filter((slug) => zhIndex.has(slug));
  const violations = [];
  for (let i = 0; i < shared.length; i++) {
    for (let j = i + 1; j < shared.length; j++) {
      const a = shared[i];
      const b = shared[j];
      if (zhIndex.get(a) > zhIndex.get(b)) violations.push([a, b]);
    }
  }
  return violations;
}
