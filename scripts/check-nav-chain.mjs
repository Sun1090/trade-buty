/**
 * R10.10：章节导航与上一篇/下一篇链路回归检查。
 *
 * 页面能渲染不表示导航链路正确——本检查直接对知识库验证站点导航语义
 * （src/lib/content.ts / kb-order.ts）的三条不变量，纯读 KB、无需构建：
 *   1. 每 locale 章节序列 + 每章课程序列都是一条无环链：从链首沿 next
 *      恰好走完全部节点（无自环/分叉/重复/缺失）。
 *   2. zh 章内前导序号（NN ·）不重复——重复会让实际排序退回 slug 字母序，
 *      与内容编写者意图的 NN 顺序冲突。
 *   3. zh↔en 共享 slug 的相对顺序一致（en 镜像 zh 排序；en 独有排后）。
 *
 * 排序语义与 content.ts 逐字段对齐：
 *   - 章节：kb-order.CHAPTER_ORDER 固定表 rank，未知章节 1000+（按首字符）。
 *   - 章内：zh 全部 doc 的 zhOrder（titleOrder(title)）基准 → 同序回退 slug
 *     字母序（重复序号因此被本检查拦截）；en 用 zh 共享 slug 排序基准
 *     （缺失 9999）→ 自身 titleOrder → slug 字母序。
 * 用法：npm run check:nav-chain
 */
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import {
  CHAPTER_ORDER,
  chainFromSorted,
  walkChain,
  duplicateOrders,
  sharedOrderViolations,
} from "./nav-chain-lib.mjs";

const root = process.cwd();
const KB = path.join(root, "content/kline-buty/docs/knowledge");
const CHAPTER_RANK = new Map(CHAPTER_ORDER.map((slug, i) => [slug, i]));

if (!fs.existsSync(KB)) {
  console.error("[nav-chain] 知识库缺失：请先 git submodule update --init");
  process.exit(1);
}

function chapterRank(slug) {
  const idx = CHAPTER_RANK.get(slug);
  return idx !== undefined ? idx : 1000 + slug.charCodeAt(0);
}

/** 与 content.ts parseFrontmatter 同口径：frontmatter title → H1 → slug 兜底。 */
function docTitle(raw, fallback) {
  let title = fallback;
  try {
    const { data, content } = matter(raw);
    if (typeof data.title === "string" && data.title.trim()) title = data.title.trim();
    else {
      const h1 = content.match(/^#\s+(.+)$/m);
      if (h1) title = h1[1].trim();
    }
  } catch {
    // 宽容：frontmatter 解析失败按 fallback 走（titleOrder 无前导数字 → 999）
  }
  return title;
}

function titleOrder(title) {
  const m = String(title).match(/^(\d+)/);
  return m ? Number(m[1]) : 999;
}

function listChapters(localeRoot) {
  return fs
    .readdirSync(localeRoot, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
}

/** 读取某 locale 章节目录下的全部课程：{slug, title, order}。 */
function listDocs(dir) {
  const out = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".md") || f === "README.md") continue;
    const slug = f.replace(/\.md$/, "");
    try {
      const title = docTitle(fs.readFileSync(path.join(dir, f), "utf8"), slug);
      out.push({ slug, title, order: titleOrder(title) });
    } catch {
      // 宽容：解析失败该篇不参与链校验（与渲染管线跳过一致）
    }
  }
  return out;
}

/** zh 章内排序（docOrderMap 的完整有序 slug 列表，与 content.ts 对齐）。 */
function zhSortedDocs(zhChapterDir) {
  const docs = listDocs(zhChapterDir);
  docs.sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug));
  return docs.map((d) => d.slug);
}

/** 章内有序 slug：zh 用 titleOrder 基准；en 用 zh 共享序基准 + 自身 order 兜底。 */
function sortedDocs(dir, zhIndex) {
  const docs = listDocs(dir);
  docs.sort(
    (a, b) =>
      (zhIndex.get(a.slug) ?? 9999) - (zhIndex.get(b.slug) ?? 9999) ||
      a.order - b.order ||
      a.slug.localeCompare(b.slug)
  );
  return docs.map((d) => d.slug);
}

function main() {
  const problems = [];
  let chapterCount = 0;
  let docChainCount = 0;
  let docTotal = 0;

  const zhChapters = listChapters(path.join(KB, "zh"));
  const enChapters = new Set(listChapters(path.join(KB, "en")));

  // 一、章节序列本身是一条无环链（zh 驱动章节集合，en 必须同集合）
  for (const [locale, slugs] of [
    ["zh", zhChapters],
    ["en", [...enChapters]],
  ]) {
    const sorted = [...slugs].sort(
      (a, b) => chapterRank(a) - chapterRank(b) || a.localeCompare(b)
    );
    const sortedSet = new Set(sorted);
    if (sortedSet.size !== slugs.length) {
      problems.push(`[${locale}] 章节 slug 重复`);
      continue;
    }
    const { head, next } = chainFromSorted(sorted);
    const { ok, cycle, order } = walkChain(head, next, sorted.length);
    if (!ok || cycle || order.length !== sorted.length) {
      problems.push(
        `[${locale}] 章节链断裂：总 ${sorted.length}、走完 ${order.length}${cycle ? "、成环" : ""}`
      );
      continue;
    }
    chapterCount += sorted.length;
    // rank 单调性（防止固定表改序后与 UI 章节顺序漂移）
    for (let i = 0; i + 1 < sorted.length; i++) {
      const cur = chapterRank(sorted[i]);
      const nextRank = chapterRank(sorted[i + 1]);
      if (cur >= nextRank) {
        problems.push(`[${locale}] 章节顺序漂移：${sorted[i]} (${cur}) ≥ ${sorted[i + 1]} (${nextRank})`);
      }
    }
  }

  const zhChapterSet = new Set(zhChapters);
  const extraEn = [...enChapters].filter((c) => !zhChapterSet.has(c));
  const missingEn = zhChapters.filter((c) => !enChapters.has(c));
  if (extraEn.length > 0) problems.push(`[en] 存在 zh 没有的章节（需先补 zh）：${extraEn.join(", ")}`);
  if (missingEn.length > 0) problems.push(`[en] 缺少 zh 已有章节：${missingEn.join(", ")}`);

  // 二、逐章：课程链 + 序号不变量
  for (const chapter of zhChapters) {
    const zhDir = path.join(KB, "zh", chapter);
    if (!fs.existsSync(path.join(zhDir, "README.md"))) {
      problems.push(`[zh] ${chapter} 缺少 README.md（不是合法章节）`);
      continue;
    }
    const zhSlugs = zhSortedDocs(zhDir);
    const zhIndex = new Map(zhSlugs.map((slug, i) => [slug, i]));

    const zhDocs = listDocs(zhDir);
    const dups = duplicateOrders(zhDocs);
    for (const { order, slugs } of dups) {
      problems.push(
        `[zh/${chapter}] 前导序号 ${order} 重复（排序会退回字母序）：${slugs.join(", ")}`
      );
    }

    // zh 课程序列链
    const zhChain = chainFromSorted(zhSlugs);
    const zhWalk = walkChain(zhChain.head, zhChain.next, zhSlugs.length);
    if (!zhWalk.ok || zhWalk.cycle) {
      problems.push(
        `[zh/${chapter}] 课程链断裂：总 ${zhSlugs.length}、走完 ${zhWalk.order.length}${zhWalk.cycle ? "、成环" : ""}`
      );
    } else {
      docChainCount += 1;
      docTotal += zhSlugs.length;
    }

    // en 镜像章：链 + 共享序一致性
    const enDir = path.join(KB, "en", chapter);
    if (fs.existsSync(enDir)) {
      const enSlugs = sortedDocs(enDir, zhIndex);
      const enChain = chainFromSorted(enSlugs);
      const enWalk = walkChain(enChain.head, enChain.next, enSlugs.length);
      if (!enWalk.ok || enWalk.cycle) {
        problems.push(
          `[en/${chapter}] 课程链断裂：总 ${enSlugs.length}、走完 ${enWalk.order.length}${enWalk.cycle ? "、成环" : ""}`
        );
      } else {
        docChainCount += 1;
        docTotal += enSlugs.length;
      }
      const violations = sharedOrderViolations({ zh: zhSlugs, en: enSlugs });
      for (const [a, b] of violations) {
        problems.push(`[en/${chapter}] 共享 slug 相对序与 zh 冲突：${a} 应排在 ${b} 之前`);
      }
    } else if (fs.existsSync(path.join(KB, "zh", chapter))) {
      // zh 有而 en 无的章节：不构成 nav 错误（en parity 由 R10.20 管），跳过
    }
  }

  if (problems.length > 0) {
    console.error(`❌ 导航链路回归发现 ${problems.length} 个问题：`);
    console.error(problems.join("\n"));
    process.exit(1);
  }
  console.log(
    `✅ 导航链回归通过：章节链 ${chapterCount} 个 · 课程链 ${docChainCount} 章 / ${docTotal} 篇（zh+en）`
  );
}

main();
