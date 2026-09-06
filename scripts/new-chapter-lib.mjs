/**
 * R10.16 新章节 dry-run 纯函数库。
 * 校验一个"草稿章节目录"在成为 KB 第 28（或某）个章节前必须满足的站点契约，
 * 以及它与站点静态表（kb-order.CHAPTER_ORDER、i18n、章数约束）的集成缺口。
 */

/** 章节目录名必须是合法英文 slug。 */
export function chapterNameIssue(name) {
  if (!/^[a-z0-9-]+$/.test(name)) return "章节名应为小写英文 slug（a-z0-9-）";
  return null;
}

/** README 契约：frontmatter title（NN · 名称）+ description；正文 H1 同题。 */
export function validateReadme({ title, description, h1 } = {}) {
  const problems = [];
  if (!title || !String(title).trim()) problems.push("README frontmatter 缺 title");
  else if (!/^\d+\s*[·.]/.test(String(title).trim()))
    problems.push(`README title 应为「NN · 名称」格式：${title}`);
  if (!description || !String(description).trim())
    problems.push("README frontmatter 缺 description");
  if (h1 && title && String(h1).trim() !== String(title).trim())
    problems.push("README 正文 H1 应与 frontmatter title 一致");
  return problems;
}

/** 课程文件契约：slug 合法 + frontmatter title/description 齐全。 */
export function validateLesson({ slug, title, description } = {}) {
  const problems = [];
  if (!/^[a-z0-9-]+$/.test(slug)) problems.push(`课程 slug 非法：${slug}`);
  if (!title || !String(title).trim()) problems.push(`${slug}：frontmatter 缺 title`);
  if (!description || !String(description).trim())
    problems.push(`${slug}：frontmatter 缺 description`);
  return problems;
}

/** 显式前导序号（NN ·）重复会让排序退回 slug 字母序，阻断。 */
export function findOrderDuplicates(lessons) {
  const byOrder = new Map();
  for (const l of lessons) {
    const m = String(l.title || "").match(/^(\d+)\s*[·.]/);
    if (!m) continue;
    const n = Number(m[1]);
    if (n > 998) continue;
    if (!byOrder.has(n)) byOrder.set(n, []);
    byOrder.get(n).push(l.slug);
  }
  return [...byOrder.entries()]
    .filter(([, slugs]) => slugs.length > 1)
    .map(([n, slugs]) => ({ order: n, slugs }));
}

/**
 * 集成缺口盘点（不阻断，作为上线前注意清单）：
 * - 新章节不在站点 CHAPTER_ORDER 表内 → 章节序会排到末位按字母序
 * - zh 章节数将离开 27（契约检查宽容报警）
 */
export function planIntegration({ chapter, existingOrder, zhChapterCount }) {
  const notes = [];
  const rank = existingOrder.indexOf(chapter);
  if (rank === -1) {
    notes.push(
      `章节 ${chapter} 未收录 kb-order.CHAPTER_ORDER → 将排在末位（字母序兜底）；如需固定位置请同步更新 kb-order.ts 与 nav-chain-lib.mjs 两张表`,
    );
  } else {
    notes.push(`章节 ${chapter} 已在 CHAPTER_ORDER 第 ${rank + 1} 位`);
  }
  notes.push(`zh 章节数将由 ${zhChapterCount} 变为 ${zhChapterCount + 1}（validate-knowledge-contract 会提示非 27，属预期）`);
  return notes;
}
