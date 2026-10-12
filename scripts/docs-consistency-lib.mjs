/**
 * Q5.1/Q5.2：文档与当前实现一致性纯检查。
 *
 * 这些断言只覆盖可机器验证、曾真实漂移过的契约，避免把普通文案评审误报为
 * 回归：双语 README 的课程数、AGENTS 的 locale/slug 结构、plan 的当前技术栈，
 * README 与 About 页的中立/不接受捐赠承诺，以及 package.json 与发布记录的版本号。
 */

import { newestReleaseVersion } from "./release-tag-lib.mjs";

export function extractReadmeCounts(markdown) {
  const text = String(markdown);
  const en = text.match(/\*\*Learn\*\*:\s*(\d+)\s+chapters?\s*\/\s*(\d+)\s+lessons?/i);
  const zh = text.match(/\*\*学\*\*：\s*(\d+)\s*篇章\s*\/\s*(\d+)\s*篇课程/);
  const toCounts = (match) =>
    match ? { chapters: Number(match[1]), lessons: Number(match[2]) } : null;
  return { en: toCounts(en), zh: toCounts(zh) };
}

export function auditReadmeCounts(readmes, expected) {
  const issues = [];
  const parsed = extractReadmeCounts(readmes.en ?? "");
  const parsedZh = extractReadmeCounts(readmes.zh ?? "");
  for (const [locale, counts] of [
    ["README.md", parsed.en],
    ["README.zh-CN.md", parsedZh.zh],
  ]) {
    if (!counts) {
      issues.push(`${locale}: 找不到可校验的章节/课程数量`);
      continue;
    }
    if (counts.chapters !== expected.chapters || counts.lessons !== expected.lessons) {
      issues.push(
        `${locale}: 写为 ${counts.chapters} 章 / ${counts.lessons} 篇，实际为 ${expected.chapters} 章 / ${expected.lessons} 篇`
      );
    }
  }
  return issues;
}

/**
 * README 那句「27 章随堂测验（81 题全解析）」里的题数。
 *
 * 章节数与课文数由 `auditReadmeCounts` 对着内容树核（R16.312 之前就有），
 * 但同一屏的**题数**没有任何东西对着：它由 `src/lib/quizzes.ts` 的固定题库决定，
 * 某一章补一道题，这句话就漂，而文档不会红。主人同样现成——
 * `check:quiz-coverage` 自己就在用 `parseQuizMounts()` 把 `totalQuestions` 数出来印在成功行里。
 */
export function extractReadmeQuizCounts(markdown) {
  const text = String(markdown);
  const en = text.match(
    /\*\*Test\*\*:\s*(\d+)\s+chapter (?:quiz|quizzes)\s*\((\d+)\s+questions?/i,
  );
  const zh = text.match(/\*\*测\*\*：\s*(\d+)\s*章随堂测验（(\d+)\s*题/);
  const toCounts = (match) =>
    match ? { chapters: Number(match[1]), questions: Number(match[2]) } : null;
  return { en: toCounts(en), zh: toCounts(zh) };
}

export function auditReadmeQuizCounts(readmes, expected) {
  const issues = [];
  const parsed = extractReadmeQuizCounts(readmes.en ?? "");
  const parsedZh = extractReadmeQuizCounts(readmes.zh ?? "");
  for (const [file, counts] of [
    ["README.md", parsed.en],
    ["README.zh-CN.md", parsedZh.zh],
  ]) {
    if (!counts) {
      issues.push(`${file}: 找不到可校验的测验章数/题数`);
      continue;
    }
    for (const [field, label] of [
      ["chapters", "章"],
      ["questions", "题"],
    ]) {
      if (!Number.isFinite(counts[field])) {
        issues.push(`${file}: 那句里的${label}数不是数字：${JSON.stringify(counts[field])}`);
      } else if (counts[field] !== expected[field]) {
        issues.push(
          `${file}: 写为 ${counts[field]} ${label}，实际为 ${expected[field]} ${label}`,
        );
      }
    }
  }
  return issues;
}

export function auditAgentsContract(markdown) {
  const text = String(markdown);
  const issues = [];
  for (const required of [
    "docs/knowledge/{zh,en}/",
    "English-slug directory",
    "Lesson filenames are English slugs",
  ]) {
    if (!text.includes(required)) issues.push(`AGENTS.md: 缺少当前知识库契约「${required}」`);
  }
  if (/docs\/knowledge\/NN-\*/.test(text)) {
    issues.push("AGENTS.md: 仍残留旧式 docs/knowledge/NN-* 目录契约");
  }
  return issues;
}

export function auditPlanContract(markdown, expectedLessons) {
  const text = String(markdown);
  const issues = [];
  for (const required of [
    `${expectedLessons} 篇`,
    "构建时 JSON 索引",
    "Supabase Auth",
    "任何 OpenAI 格式端点",
  ]) {
    if (!text.includes(required)) issues.push(`docs/plan.md: 缺少当前实现事实「${required}」`);
  }
  for (const stale of ["Pagefind", "shadcn/ui", "lucide-react", "Claude API + pgvector"]) {
    if (text.includes(stale)) issues.push(`docs/plan.md: 仍把历史选型当作当前方案「${stale}」`);
  }
  return issues;
}

export function auditReadmeImplementationReferences(readmes) {
  const issues = [];
  const required = ["proxy.ts", "CONTRIBUTING.md", "docs/architecture.md", "Vitest", "Playwright"];
  for (const [file, markdown] of Object.entries(readmes)) {
    const text = String(markdown);
    for (const marker of required) {
      if (!text.includes(marker)) issues.push(`${file}: 缺少当前实现/文档引用「${marker}」`);
    }
    for (const stale of ["middleware.ts", "Vitest-ready"]) {
      if (text.includes(stale)) issues.push(`${file}: 仍残留历史实现描述「${stale}」`);
    }
  }
  return issues;
}

export function auditContributingContract(markdown) {
  const text = String(markdown);
  const issues = [];
  for (const required of [
    "Node.js 22",
    "git submodule update --init",
    "npm ci",
    "npm run dev",
    "npm run lint",
    "npm run typecheck",
    "npm test",
    "npm run build",
    "npm run e2e",
    "npm run db:test",
    "npm run check:docs",
    "npm run check:secrets",
    "npm run kb:update",
    "Angular Convention",
    "Co-Authored-By",
    "禁止直接向 `main` 推送",
    "docs/release-checklist.md",
    "codex/",
    "content/kline-buty",
    "只读 git submodule",
    "⚠️ 风险提示",
    "不承诺收益",
    "不荐股荐基",
    "不做券商开户导流",
    "不接受广告或捐赠",
  ]) {
    if (!text.includes(required)) issues.push(`CONTRIBUTING.md: 缺少贡献契约「${required}」`);
  }
  return issues;
}

export function auditArchitectureContract(markdown) {
  const text = String(markdown);
  const issues = [];
  for (const required of [
    "Next.js 16",
    "App Router",
    "src/proxy.ts",
    "content/kline-buty",
    "npm run kb:update",
    "构建时 JSON 索引",
    "Supabase Auth",
    "RLS",
    "pgvector",
    "任意 OpenAI",
    "POST /api/error-reports",
    "/share/[kind]/[path]",
    "Playwright",
    "Lighthouse CI",
    "db-tests",
  ]) {
    if (!text.includes(required)) issues.push(`docs/architecture.md: 缺少当前架构事实「${required}」`);
  }
  for (const stale of ["Vitest-ready", "Pagefind", "Clerk 注册登录"]) {
    if (text.includes(stale)) issues.push(`docs/architecture.md: 仍残留历史架构描述「${stale}」`);
  }
  return issues;
}

export function auditNeutrality(readmes, aboutPage) {
  const issues = [];
  const about = String(aboutPage);
  if (!/(don't run ads|doesn't run ads|不接受广告)/.test(about) || !/(no donations|不接受任何形式的捐赠)/.test(about)) {
    issues.push("About 页未同时声明不接受广告与捐赠，无法校验 README 中立承诺");
  }
  for (const [file, markdown] of Object.entries(readmes)) {
    if (/(^##\s+(Sponsor|赞助)|\bdonate-|buying the author a coffee|请作者喝杯咖啡)/im.test(String(markdown))) {
      issues.push(`${file}: 存在与“不接受捐赠”承诺冲突的赞助入口`);
    }
  }
  return issues;
}

/** package.json 的 version 必须等于发布记录里的最新已发布版本。 */
export function auditReleaseVersion({ packageVersion, releases }) {
  const newest = newestReleaseVersion(releases);
  if (!newest) {
    return ["src/data/release-notes.json: 没有 x.y.z 形式的已发布版本"];
  }
  if (packageVersion !== newest) {
    return [
      `package.json: version 为 ${String(packageVersion)}，最新发布版本为 ${newest}；发布时必须同步 bump package.json`
    ];
  }
  return [];
}

/**
 * R14.8：发布检查单必须存在且关键步骤不缺。
 *
 * 发布是本项目最容易「记得做」的环节：tag 只能在 rebase 合并后打、e2e 会污染构建产物门禁、
 * 版本号与 release-notes 必须同步——漏掉任何一步都要靠事后盘点才发现。这里把步骤钉成断言。
 */
export const RELEASE_CHECKLIST_STEPS = Object.freeze([
  "判级",
  "RELEASE_FREEZE",
  "src/data/release-notes.json",
  "npm run changelog:generate",
  "npm run check:lockfile-repro",
  "npm run test:coverage",
  "npm run build",
  "npm run check:release-tag",
  "git tag -a vX.Y.Z",
  "gh pr merge",
  "trade-buty.vercel.app",
  "docs/progress.md",
  "## 7. 回滚",
]);

export function auditReleaseChecklist(markdown) {
  const text = String(markdown ?? "");
  const issues = [];
  for (const required of RELEASE_CHECKLIST_STEPS) {
    if (!text.includes(required)) {
      issues.push(`docs/release-checklist.md: 缺少发布步骤「${required}」`);
    }
  }
  return issues;
}

/**
 * R16.315：现行文档里每一个「由内容/题库决定的数字」都必须登记主人。
 *
 * 前四轮是撞一个修一个：R16.310 修 `kb:dry-run` 抄的 27、R16.311 修 `docs/seo-surface.md`
 * 抄的 418、R16.312 修 README 抄的 81、R16.313 修 `docs/growth-checklist.md` 抄的 430。
 * 每一次都是「有人读到那句话才发现它对不上」，而下一处手抄照旧不会红。这一节把制度换成
 * 登记制：扫描器在现行文档里数到的每一个「数字＋单位」，都必须在登记表里有一个对应的说法，
 * 或者在豁免表里写明它为什么不归内容管。新增一处无主人的手抄从此在提交时被拦，
 * 而不是等下一轮有人路过。
 *
 * 三种红：① 扫到了、既没登记也没豁免 → 无主人的手抄；② 登记了、锚点却在文档里打空 →
 * 说法被改写而登记表没跟上（判据不许空转）；③ 登记了、打到了、数却与主人不符 → 真的漂了。
 *
 * 单位表是**白名单**，这是它已知的边界：表外的写法扫不到，也就不会要求主人。探针 M1b 如实
 * 记录了这一点（往 `docs/plan.md` 追加「覆盖 12 个词条」，判据不响）。刻意不收的两类：
 * ① 泛用量词「个 / 条 / 次 / 组」——它们在现行文档里的多数命中是命令行为描述或写明日期的
 *    实测记录，收进来等于要求历史数字等于今天的产物；② 台账类单位（`docs/perf-notes.md`
 *    复测表里的「N 条路由」「N 文件」），同一族规矩见 `db-assertion-counts.mjs` 的
 *    `CURRENT_SECTIONS` 与 R16.268。
 * 扩这张表的前置条件：先给现有命中逐条找主人，而不是先扩表再补登记——顺序反了就是拿一批
 * 假红去逼自己写豁免，豁免表一旦变成垃圾桶，登记制就名存实亡。
 */
export const DOC_NUMBER_UNITS = Object.freeze([
  "篇章",
  "章",
  "课文",
  "课",
  "篇",
  "题",
  "页",
  "词条",
  "道",
  "chapters?",
  "lessons?",
  "questions?",
  "pages?",
  "URLs?",
]);

/** 扫描器：`182 篇` / `27 chapters` / `3 道` 这类「数字紧跟单位」的说法。 */
export const DOC_NUMBER_SCAN_RE = new RegExp(
  `(?<![\\w])(\\d{1,4})(?!\\d)(?:\\s*(?:${DOC_NUMBER_UNITS.join("|")}))(?![\\w])`,
  "g",
);

/**
 * 被扫的文档：会说「现在有多少内容/题/页」的现行说法载体。
 * 不在清单里的两类各有理由：追加式台账（`CHANGELOG.md`、`docs/progress.md`、
 * `docs/roadmap.md`、`docs/kb-changelog-*.md`、`docs/v*-release-review.md`）引用的是
 * 当时被改掉的旧数字；门禁重算的自动生成件（`docs/translation-status.md`、
 * `docs/content-inventory.md`、`docs/risk-warning-coverage.md` 等）由生产者自己保持新鲜。
 * 剩下的少量未列入文档（`docs/deps.md`、`docs/accessibility-audit.md`、
 * `docs/social-features-review.md`）只有带日期的实测记录与政策阈值，没有现行数量说法。
 */
export const DOC_NUMBER_SCAN_TARGETS = Object.freeze([
  "AGENTS.md",
  "README.md",
  "README.zh-CN.md",
  "CONTRIBUTING.md",
  "docs/plan.md",
  "docs/research.md",
  "docs/growth-checklist.md",
  "docs/ops.md",
  "docs/perf-notes.md",
  "docs/seo-surface.md",
  "docs/architecture.md",
  "docs/release-checklist.md",
  "docs/database-testing.md",
]);

/**
 * 登记表：每条锚点**只捕获它要对账的那一个数**，`owner` 指向调用点现读出来的量。
 * owner 的名字必须是 `auditDocNumberClaims` 收到的 `actual` 里的键——拼错、或调用点没把
 * 那一路读数接进来，都当场报错，不允许「解析不到就当作一致」。
 */
export const DOC_NUMBER_CLAIMS = Object.freeze([
  { file: "AGENTS.md", owner: "chapters", anchor: /must have all (\d+) chapters/ },
  { file: "README.md", owner: "chapters", anchor: /\*\*Learn\*\*: (\d+) chapters/ },
  {
    file: "README.md",
    owner: "lessons",
    anchor: /\*\*Learn\*\*: \d+ chapters \/ (\d+) lessons/,
  },
  { file: "README.md", owner: "chapters", anchor: /(\d+) chapter quizzes/ },
  { file: "README.md", owner: "questions", anchor: /\((\d+) questions, all explained\)/ },
  { file: "README.zh-CN.md", owner: "chapters", anchor: /\*\*学\*\*：(\d+) 篇章/ },
  {
    file: "README.zh-CN.md",
    owner: "lessons",
    anchor: /\*\*学\*\*：\d+ 篇章 \/ (\d+) 篇课程/,
  },
  { file: "README.zh-CN.md", owner: "chapters", anchor: /(\d+) 章随堂测验/ },
  { file: "README.zh-CN.md", owner: "questions", anchor: /（(\d+) 题全解析/ },
  { file: "docs/plan.md", owner: "chapters", anchor: /知识库 (\d+) 章 \/ \d+ 篇且中英对齐/ },
  { file: "docs/plan.md", owner: "lessons", anchor: /知识库 \d+ 章 \/ (\d+) 篇且中英对齐/ },
  { file: "docs/plan.md", owner: "chapters", anchor: /（(\d+) 篇章分级导航）/ },
  { file: "docs/plan.md", owner: "lessons", anchor: /\| (\d+) 篇量级不需要独立向量库 \|/ },
  {
    file: "docs/research.md",
    owner: "chapters",
    anchor: /当前内容为 (\d+) 章 \/ \d+ 篇且 zh\/en 对齐/,
  },
  {
    file: "docs/research.md",
    owner: "lessons",
    anchor: /当前内容为 \d+ 章 \/ (\d+) 篇且 zh\/en 对齐/,
  },
  {
    file: "docs/research.md",
    owner: "chapters",
    anchor: /，当前 (\d+) 章 \/ \d+ 篇）→ 课程内容草稿/,
  },
  {
    file: "docs/research.md",
    owner: "lessons",
    anchor: /，当前 \d+ 章 \/ (\d+) 篇）→ 课程内容草稿/,
  },
  { file: "docs/research.md", owner: "lessons", anchor: /（当前 (\d+) 篇量级足够/ },
  { file: "docs/research.md", owner: "lessons", anchor: /当前 (\d+) 篇知识库天然构成/ },
  {
    file: "docs/growth-checklist.md",
    owner: "lessons",
    anchor: /知识库 (\d+) 篇 = 天然的选题库/,
  },
  { file: "docs/ops.md", owner: "chapters", anchor: /固定题库覆盖率：(\d+) 章/ },
  { file: "docs/ops.md", owner: "minQuestionsPerChapter", anchor: /每章至少 (\d+) 道/ },
  { file: "docs/ops.md", owner: "dbAuditedDocs", anchor: /声明的 (\d+) 篇文档/ },
  { file: "docs/ops.md", owner: "chapters", anchor: /cover the same (\d+) chapters/ },
  { file: "docs/ops.md", owner: "chapters", anchor: /（(\d+) 章的 zh\/en 章节版本/ },
  { file: "docs/perf-notes.md", owner: "chapters", anchor: /（(\d+) 章 × \d+ 题/ },
  { file: "docs/perf-notes.md", owner: "minQuestionsPerChapter", anchor: /× (\d+) 题 ≈/ },
  { file: "docs/perf-notes.md", owner: "questions", anchor: /≈ \*\*(\d+) 条\*\*/ },
  { file: "docs/perf-notes.md", owner: "minQuestionsPerChapter", anchor: /每章 ≥(\d+) 题/ },
]);

/**
 * 扫到了、但**不该**由内容说了算的数：每条写明归属，扫描器就不再要求它进登记表。
 * 豁免必须是具体的（文件 + 那段话的形状），不接受「整份文档豁免」——那等于把判据关掉。
 */
export const DOC_NUMBER_EXEMPTIONS = Object.freeze([
  {
    file: "docs/research.md",
    span: /立项时 \d+ 篇章 \/ \d+ 篇/,
    reason: "立项期的规模是历史事实，由 kline-buty 当时的仓库状态决定，不随今天的内容树变",
  },
  {
    file: "docs/perf-notes.md",
    span: /若未来题库扩到每章 >\d+ 题/,
    reason: "引入虚拟化的政策触发线，不是内容量；改它等于改纪律，不需要任何东西重算",
  },
  {
    file: "docs/growth-checklist.md",
    span: /sitemap（\d+ URL，其中知识库 \d+）/,
    reason: "这两个数由构建产物说了算，`npm run check:seo-surface` 逐条对产物核（R16.311/R16.313）",
  },
  {
    file: "docs/seo-surface.md",
    span: /可索引，全部进 sitemap（\d+ 页）/,
    reason: "同上：`npm run check:seo-surface` 拿 `stats.knowledgePages` 核这一句（R16.311）",
  },
]);

/**
 * 两个地板各防一种空转：登记表被删空之后「所有命中都登记了」会退化成对空表成立；
 * 单位表或文档形状被改到扫不出东西时，红要出现在「判据自己失效」而不是「一致」。
 * 2026-10-11 实测：29 条登记、33 处命中。
 */
export const DOC_NUMBER_MIN_CLAIMS = 29;
export const DOC_NUMBER_MIN_HITS = 30;

/** 正文里每一处「数字＋单位」，只记数字本身的区间。 */
export function scanDocNumberHits(text) {
  const hits = [];
  let offset = 0;
  for (const line of String(text).split("\n")) {
    for (const match of line.matchAll(DOC_NUMBER_SCAN_RE)) {
      hits.push({
        start: offset + match.index,
        end: offset + match.index + match[1].length,
        value: Number(match[1]),
        text: match[0].trim(),
      });
    }
    offset += line.length + 1;
  }
  return hits;
}

/**
 * 某个正则在正文里占住的区间（可能有多个命中）。`group` 是第一捕获组（那个数）的位置，
 * 用它而不是整段区间去和扫描命中对齐——否则「知识库 27 章 / 182 篇」这种一句两个数的
 * 写法，只要登记其中任一个就会把另一个也误判成已登记。
 */
function spansOf(pattern, text) {
  const re = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
  const spans = [];
  for (const match of String(text).matchAll(re)) {
    const whole = { start: match.index, end: match.index + match[0].length };
    if (match[1] === undefined) {
      spans.push({ ...whole, group: null });
      continue;
    }
    const start = match.index + match[0].indexOf(match[1]);
    spans.push({ ...whole, group: { start, end: start + match[1].length } });
  }
  return spans;
}

const sameSpan = (a, b) =>
  a !== null && b !== null && a !== undefined && a.start === b.start && a.end === b.end;

const contains = (outer, inner) => outer.start <= inner.start && inner.end <= outer.end;

/**
 * @param {{files: Record<string, string>, actual: Record<string, number>}} input
 *   `files` 以登记表用的相对路径为键；`actual` 是调用点现读出来的那些量。
 * @returns {string[]} 空数组代表每一处命中都有主人、且与主人相符
 */
export function auditDocNumberClaims({ files, actual }) {
  const issues = [];
  const missing = [];
  const read = (relativePath) => {
    if (!(relativePath in files)) {
      if (!missing.includes(relativePath)) missing.push(relativePath);
      return null;
    }
    return files[relativePath];
  };

  if (DOC_NUMBER_CLAIMS.length < DOC_NUMBER_MIN_CLAIMS) {
    issues.push(
      `登记表只剩 ${DOC_NUMBER_CLAIMS.length} 条，地板 ${DOC_NUMBER_MIN_CLAIMS}：` +
        "条目被删空之后「所有命中都登记了」会退化成对空表成立",
    );
  }

  const claimedByFile = new Map();
  for (const claim of DOC_NUMBER_CLAIMS) {
    const text = read(claim.file);
    if (text === null) continue;
    const ownerValue = actual?.[claim.owner];
    if (!Number.isInteger(ownerValue) || ownerValue < 0) {
      issues.push(
        `${claim.file}: 登记项的主人「${claim.owner}」没有被调用点解析成非负整数（收到 ${String(ownerValue)}）` +
          "——owner 拼错、或调用点没把这一路读数接进来；当作一致放行等于没有主人",
      );
      continue;
    }
    const spans = spansOf(claim.anchor, text);
    if (spans.length === 0) {
      issues.push(
        `${claim.file}: 登记的说法找不到锚点（${claim.anchor}）——那句话被改写或删掉了，` +
          "登记表要跟着改；留着判据却不留锚点等于没有判据",
      );
      continue;
    }
    const list = claimedByFile.get(claim.file) ?? [];
    for (const span of spans) {
      list.push(span);
      const digitRange = span.group ?? span;
      const printed = Number(text.slice(digitRange.start, digitRange.end));
      if (printed !== ownerValue) {
        issues.push(
          `${claim.file}: 那句「${text.slice(span.start, span.end).trim()}」印的是 ${printed}，` +
            `主人「${claim.owner}」当场是 ${ownerValue}`,
        );
      }
    }
    claimedByFile.set(claim.file, list);
  }

  let hits = 0;
  for (const file of DOC_NUMBER_SCAN_TARGETS) {
    const text = read(file);
    if (text === null) continue;
    const claims = claimedByFile.get(file) ?? [];
    const exemptions = DOC_NUMBER_EXEMPTIONS.filter((entry) => entry.file === file).flatMap(
      (entry) => spansOf(entry.span, text),
    );
    for (const hit of scanDocNumberHits(text)) {
      hits += 1;
      const registered = claims.some((span) => sameSpan(span.group, hit));
      const excused = exemptions.some((span) => contains(span, hit));
      if (!registered && !excused) {
        issues.push(
          `${file}: 扫到一个没有主人的数字「${hit.text}」——` +
            `它要么该登记进 DOC_NUMBER_CLAIMS（写明由哪个现读的数说了算），` +
            `要么该写进 DOC_NUMBER_EXEMPTIONS（说明它为什么不归内容管）`,
        );
      }
    }
  }

  for (const file of missing) {
    issues.push(
      `${file}: 扫描清单里的文档没被读进来——调用点少给了一份文件，` +
        "判据不能默认它「没有数字」；改名或删掉要连着改 DOC_NUMBER_SCAN_TARGETS",
    );
  }

  if (hits < DOC_NUMBER_MIN_HITS) {
    issues.push(
      `本次只扫到 ${hits} 处数量说法，地板 ${DOC_NUMBER_MIN_HITS}：` +
        "单位表或文档形状被改到扫不出东西时，「全部已登记」这句不含信息",
    );
  }

  return issues;
}
