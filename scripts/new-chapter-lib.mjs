import ts from "typescript";

/**
 * @typedef {{
 *   chapter?: string,
 *   lessons?: Array<string | { slug?: string, title?: string }>,
 *   hasReadme?: boolean,
 *   chapterOrder?: string[],
 *   stageSlugs?: string[],
 *   quizMount?: { docSlug?: string | null } | null,
 * }} ReleaseChecklistInput
 */

/**
 * R10.16 / Q1.7 新章节 dry-run 纯函数库。
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


/** 从 src/lib/path.ts 提取三阶段已登记章节 slug（返回顺序保持 STAGES 顺序）。 */
export function parseStageSlugs(source, fileName = "path.ts") {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const slugs = [];

  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== "STAGES") continue;
      if (!declaration.initializer || !ts.isArrayLiteralExpression(declaration.initializer)) continue;
      for (const element of declaration.initializer.elements) {
        if (!ts.isObjectLiteralExpression(element)) continue;
        for (const property of element.properties) {
          if (!ts.isPropertyAssignment(property)) continue;
          if (!ts.isIdentifier(property.name) || property.name.text !== "chapterNums") continue;
          if (!ts.isArrayLiteralExpression(property.initializer)) continue;
          for (const chapter of property.initializer.elements) {
            if (ts.isStringLiteral(chapter) || ts.isNoSubstitutionTemplateLiteral(chapter)) {
              slugs.push(chapter.text);
            }
          }
        }
      }
    }
  }

  return [...new Set(slugs)];
}

/**
 * Q1.7 四项上线核对：搜索索引、sitemap、测验挂载、/path 阶段分组。
 * 返回项里的 blocking=true 才应阻断 dry-run；未挂固定题等显式决策项用 action 提示。
 * @param {ReleaseChecklistInput} [input]
 */
export function buildReleaseChecklist({
  chapter,
  lessons = [],
  hasReadme = false,
  chapterOrder = [],
  stageSlugs = [],
  quizMount = null,
} = {}) {
  const lessonSlugs = lessons.map((lesson) =>
    typeof lesson === "string" ? lesson : lesson.slug,
  );
  const artifactDetail = hasReadme
    ? `README + ${lessonSlugs.length} 篇课程将由 prebuild 写入索引，并由 sitemap 内容枚举生成 URL`
    : "缺少 README.md，无法进入索引 / sitemap";

  const items = [
    {
      id: "search-index",
      label: "搜索索引",
      status: hasReadme ? "ready" : "block",
      blocking: !hasReadme,
      detail: artifactDetail,
      verify: "npm run build && npm run check:search-index",
    },
    {
      id: "sitemap",
      label: "sitemap",
      status: hasReadme ? "ready" : "block",
      blocking: !hasReadme,
      detail: artifactDetail,
      verify: "npm run build && npm run check:sitemap",
    },
  ];

  const quizDocSlug = quizMount?.docSlug ?? null;
  const quizValid = Boolean(quizDocSlug && lessonSlugs.includes(quizDocSlug));
  const quizMissingDoc = Boolean(quizMount && !quizValid);
  items.push({
    id: "quiz-mount",
    label: "测验挂载点",
    status: quizValid ? "ready" : quizMissingDoc ? "block" : "action",
    blocking: quizMissingDoc,
    detail: quizValid
      ? `QUIZZES["${chapter}"].docSlug=${quizDocSlug} 指向草稿课程`
      : quizMissingDoc
        ? `QUIZZES["${chapter}"].docSlug=${quizDocSlug ?? "缺失"} 不在草稿课程中`
        : `未发现 QUIZZES["${chapter}"]；课末将使用 AI 出题回退，若要求固定题需按章节挂载`,
    verify: "npm run check:quiz-mounts && npm run check:quiz-coverage",
  });

  const inOrder = chapterOrder.includes(chapter);
  const inStage = stageSlugs.includes(chapter);
  items.push({
    id: "path-group",
    label: "路径分组",
    status: inStage ? "ready" : "action",
    blocking: false,
    detail: inStage
      ? inOrder
        ? "已在 CHAPTER_ORDER 与 /path 三阶段分组中"
        : "已出现在 /path 阶段分组，但 CHAPTER_ORDER 未登记（章节序将按字母序兜底）"
      : inOrder
        ? "已在 CHAPTER_ORDER，但未加入 STAGES；/path 与知识图谱不会展示该章"
        : "未加入 CHAPTER_ORDER 与 STAGES；/path 与知识图谱不会展示该章",
    verify: "npm run build && npm run e2e -- --grep '学习路径'",
  });

  return items;
}
