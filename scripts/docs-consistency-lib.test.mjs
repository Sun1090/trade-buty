import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import {
  RELEASE_CHECKLIST_STEPS,
  auditAgentsContract,
  auditArchitectureContract,
  auditContributingContract,
  auditDocNumberClaims,
  auditNeutrality,
  auditPlanContract,
  auditReadmeCounts,
  auditReadmeQuizCounts,
  extractReadmeQuizCounts,
  auditReadmeImplementationReferences,
  auditReleaseChecklist,
  auditReleaseVersion,
  DOC_NUMBER_CLAIMS,
  DOC_NUMBER_MIN_CLAIMS,
  DOC_NUMBER_MIN_HITS,
  DOC_NUMBER_SCAN_TARGETS,
  extractReadmeCounts,
  scanDocNumberHits,
} from "./docs-consistency-lib.mjs";

const expected = { chapters: 27, lessons: 182 };
const validReadmes = {
  en: "**Learn**: 27 chapters / 182 lessons",
  zh: "**学**：27 篇章 / 182 篇课程",
};
const validReadmeReferences = {
  "README.md": "src/proxy.ts CONTRIBUTING.md docs/architecture.md Vitest Playwright",
  "README.zh-CN.md": "src/proxy.ts CONTRIBUTING.md docs/architecture.md Vitest Playwright",
};
const validContributing = [
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
  "codex/topic",
  "content/kline-buty",
  "只读 git submodule",
  "⚠️ 风险提示",
  "不承诺收益",
  "不荐股荐基",
  "不做券商开户导流",
  "不接受广告或捐赠",
].join("\n");
const validArchitecture = [
  "Next.js 16",
  "App Router",
  "src/proxy.ts",
  "content/kline-buty",
  "npm run kb:update",
  "构建时 JSON 索引",
  "Supabase Auth",
  "RLS",
  "pgvector",
  "任意 OpenAI 格式端点",
  "POST /api/error-reports",
  "/share/[kind]/[path]",
  "Playwright",
  "Lighthouse CI",
  "db-tests",
].join("\n");

describe("docs-consistency-lib", () => {
  it("extracts and validates bilingual README counts", () => {
    expect(extractReadmeCounts(validReadmes.en)).toEqual({ en: expected, zh: null });
    expect(extractReadmeCounts(validReadmes.zh)).toEqual({ en: null, zh: expected });
    expect(auditReadmeCounts(validReadmes, expected)).toEqual([]);
  });

  it("reports missing and stale README counts", () => {
    const issues = auditReadmeCounts(
      { en: "**Learn**: 27 chapters / 173 lessons", zh: "没有数量" },
      expected
    );
    expect(issues).toEqual([
      "README.md: 写为 27 章 / 173 篇，实际为 27 章 / 182 篇",
      "README.zh-CN.md: 找不到可校验的章节/课程数量",
    ]);
  });

  it("guards the current locale and English-slug AGENTS contract", () => {
    const current = [
      "docs/knowledge/{zh,en}/",
      "Each chapter is an English-slug directory",
      "Lesson filenames are English slugs",
    ].join("\n");
    expect(auditAgentsContract(current)).toEqual([]);
    expect(
      auditAgentsContract("Chapter directories: docs/knowledge/NN-*/")
    ).toEqual([
      "AGENTS.md: 缺少当前知识库契约「docs/knowledge/{zh,en}/」",
      "AGENTS.md: 缺少当前知识库契约「English-slug directory」",
      "AGENTS.md: 缺少当前知识库契约「Lesson filenames are English slugs」",
      "AGENTS.md: 仍残留旧式 docs/knowledge/NN-* 目录契约",
    ]);
  });

  it("guards current implementation facts in plan.md", () => {
    const current = [
      "182 篇",
      "构建时 JSON 索引",
      "Supabase Auth",
      "任何 OpenAI 格式端点",
    ].join("\n");
    expect(auditPlanContract(current, 182)).toEqual([]);
    const issues = auditPlanContract("Pagefind · shadcn/ui · Claude API + pgvector", 182);
    expect(issues.some((issue) => issue.includes("Pagefind"))).toBe(true);
    expect(issues.some((issue) => issue.includes("Claude API + pgvector"))).toBe(true);
  });

  it("catches README references to removed modules and stale test-stack wording", () => {
    expect(auditReadmeImplementationReferences(validReadmeReferences)).toEqual([]);
    const issues = auditReadmeImplementationReferences({
      "README.md": "middleware.ts is Vitest-ready",
      "README.zh-CN.md": "src/proxy.ts Vitest Playwright",
    });
    expect(issues).toContain("README.md: 缺少当前实现/文档引用「CONTRIBUTING.md」");
    expect(issues).toContain("README.md: 缺少当前实现/文档引用「docs/architecture.md」");
    expect(issues).toContain("README.md: 仍残留历史实现描述「middleware.ts」");
    expect(issues).toContain("README.md: 仍残留历史实现描述「Vitest-ready」");
  });

  it("guards the contribution workflow and content constitution", () => {
    expect(auditContributingContract(validContributing)).toEqual([]);
    const issues = auditContributingContract("npm ci");
    expect(issues).toContain("CONTRIBUTING.md: 缺少贡献契约「Node.js 22」");
    expect(issues).toContain("CONTRIBUTING.md: 缺少贡献契约「⚠️ 风险提示」");
    expect(issues).toContain("CONTRIBUTING.md: 缺少贡献契约「禁止直接向 `main` 推送」");
  });

  it("guards architecture facts and rejects historical stacks", () => {
    expect(auditArchitectureContract(validArchitecture)).toEqual([]);
    const issues = auditArchitectureContract("Vitest-ready · Pagefind · Clerk 注册登录");
    expect(issues).toContain("docs/architecture.md: 缺少当前架构事实「Next.js 16」");
    expect(issues).toContain("docs/architecture.md: 仍残留历史架构描述「Vitest-ready」");
    expect(issues).toContain("docs/architecture.md: 仍残留历史架构描述「Pagefind」");
    expect(issues).toContain("docs/architecture.md: 仍残留历史架构描述「Clerk 注册登录」");
  });

  it("catches sponsor sections that conflict with the no-donation promise", () => {
    const about = "We don't run ads and accept no donations.";
    expect(auditNeutrality(validReadmes, about)).toEqual([]);
    expect(
      auditNeutrality({ "README.md": "## Sponsor\nbuying the author a coffee" }, about)
    ).toContain("README.md: 存在与“不接受捐赠”承诺冲突的赞助入口");
  });

  it("binds package.json to the newest published release", () => {
    const releases = [{ version: "0.7.0" }, { version: "0.6.0" }, { version: "0.4.0" }];
    expect(auditReleaseVersion({ packageVersion: "0.7.0", releases })).toEqual([]);
    expect(auditReleaseVersion({ packageVersion: "0.1.0", releases })).toContain(
      "package.json: version 为 0.1.0，最新发布版本为 0.7.0；发布时必须同步 bump package.json"
    );
  });

  it("ranks release versions numerically rather than lexicographically", () => {
    expect(
      auditReleaseVersion({
        packageVersion: "0.10.0",
        releases: [{ version: "0.9.0" }, { version: "0.10.0" }],
      })
    ).toEqual([]);
    expect(
      auditReleaseVersion({
        packageVersion: "0.9.0",
        releases: [{ version: "0.10.0" }, { version: "0.9.0" }],
      })
    ).toEqual([
      "package.json: version 为 0.9.0，最新发布版本为 0.10.0；发布时必须同步 bump package.json",
    ]);
  });

  it("ignores malformed version entries and reports when nothing is publishable", () => {
    expect(
      auditReleaseVersion({
        packageVersion: "0.7.0",
        releases: [{ version: "0.7.0" }, { version: "v0.8" }, {}],
      })
    ).toEqual([]);
    for (const releases of [[{ version: "unreleased" }], [], undefined]) {
      expect(auditReleaseVersion({ packageVersion: "0.7.0", releases })).toContain(
        "src/data/release-notes.json: 没有 x.y.z 形式的已发布版本"
      );
    }
  });

  it("rejects a release checklist that lost a step", () => {
    expect(auditReleaseChecklist("")).toEqual(
      RELEASE_CHECKLIST_STEPS.map((step) => `docs/release-checklist.md: 缺少发布步骤「${step}」`)
    );
    expect(
      auditReleaseChecklist(
        RELEASE_CHECKLIST_STEPS.filter((step) => step !== "git tag -a vX.Y.Z").join("\n")
      )
    ).toEqual(["docs/release-checklist.md: 缺少发布步骤「git tag -a vX.Y.Z」"]);
    expect(auditReleaseChecklist(undefined)).toEqual(
      RELEASE_CHECKLIST_STEPS.map((step) => `docs/release-checklist.md: 缺少发布步骤「${step}」`)
    );
  });

  it("accepts the release checklist that actually ships", async () => {
    const shipped = await readFile(
      new URL("../docs/release-checklist.md", import.meta.url),
      "utf8"
    );
    expect(auditReleaseChecklist(shipped)).toEqual([]);
  });

  /**
   * R16.312：README 那句「27 章随堂测验（81 题全解析）」里的题数由 `src/lib/quizzes.ts`
   * 说了算。章数与课文数早就对着内容树核，同一屏的题数此前没有任何东西对着——
   * 某一章补一道题，这句话就漂而文档不红（与 R16.310 抄来的 27、R16.311 抄来的 418 同一族病）。
   */
  it("extracts the bilingual quiz counts from README", () => {
    expect(extractReadmeQuizCounts("**Test**: 27 chapter quizzes (81 questions, all explained)").en).toEqual({
      chapters: 27,
      questions: 81,
    });
    expect(extractReadmeQuizCounts("- **测**：27 章随堂测验（81 题全解析）、阅读进度追踪").zh).toEqual({
      chapters: 27,
      questions: 81,
    });
    // 单数写法与措辞变体不该被误当成「找不到」
    expect(extractReadmeQuizCounts("**Test**: 1 chapter quiz (3 questions)").en).toEqual({
      chapters: 1,
      questions: 3,
    });
    expect(extractReadmeQuizCounts("什么都没说")).toEqual({ en: null, zh: null });
  });

  it("reports missing and stale README quiz counts", () => {
    const expected = { chapters: 27, questions: 81 };
    expect(
      auditReadmeQuizCounts(
        {
          en: "**Test**: 27 chapter quizzes (81 questions, all explained)",
          zh: "- **测**：27 章随堂测验（81 题全解析）",
        },
        expected,
      ),
    ).toEqual([]);
    expect(
      auditReadmeQuizCounts(
        {
          en: "**Test**: 27 chapter quizzes (84 questions, all explained)",
          zh: "- **测**：28 章随堂测验（81 题全解析）",
        },
        expected,
      ),
    ).toEqual([
      "README.md: 写为 84 题，实际为 81 题",
      "README.zh-CN.md: 写为 28 章，实际为 27 章",
    ]);
    expect(auditReadmeQuizCounts({}, expected)).toEqual([
      "README.md: 找不到可校验的测验章数/题数",
      "README.zh-CN.md: 找不到可校验的测验章数/题数",
    ]);
  });

  it("accepts the quiz counts the READMEs actually ship", async () => {
    const [en, zh, quizSource] = await Promise.all([
      readFile(new URL("../README.md", import.meta.url), "utf8"),
      readFile(new URL("../README.zh-CN.md", import.meta.url), "utf8"),
      readFile(new URL("../src/lib/quizzes.ts", import.meta.url), "utf8"),
    ]);
    const parsedZh = extractReadmeQuizCounts(zh).zh;
    const parsedEn = extractReadmeQuizCounts(en).en;
    expect(parsedZh, "README.zh-CN.md 那句的形状变了").toBeTruthy();
    expect(parsedEn, "README.md 那句的形状变了").toBeTruthy();
    const { parseQuizMounts } = await import("./quiz-source-lib.mjs");
    const questions = parseQuizMounts(quizSource).reduce(
      (sum, mount) => sum + (mount.questionCount ?? 0),
      0,
    );
    expect(questions).toBeGreaterThan(0);
    // 章数取内容树现读的那一个，**不取 README 自己印的**——否则这条退化成
    // 「文档等于文档」的恒等式（R16.294 / R16.310 各记过一次：恒等的守门是装饰）。
    const { readdirSync } = await import("node:fs");
    const chapters = readdirSync(new URL("../content/kline-buty/docs/knowledge/zh", import.meta.url), {
      withFileTypes: true,
    }).filter((entry) => entry.isDirectory()).length;
    expect(chapters).toBeGreaterThan(0);
    expect(auditReadmeQuizCounts({ en, zh }, { chapters, questions })).toEqual([]);
  });

  it("the CLI actually derives these numbers instead of hardcoding them", async () => {
    // 上一课（R16.303 / R16.311 的 M3–M5）：纯函数测得再全，调用点不接就等于没有门禁。
    const cli = await readFile(new URL("../scripts/check-docs-consistency.mjs", import.meta.url), "utf8");
    expect(cli, "调用点不再 import auditReadmeQuizCounts——这条核对是死的").toContain("auditReadmeQuizCounts");
    const wired = cli.match(/auditReadmeQuizCounts\(\{?[\s\S]*?\),/);
    expect(wired, "import 了却没调用——正是要防的那种哑门禁").toBeTruthy();
    expect(wired[0], "题数没有从 parseQuizMounts 推出来").toContain("questionCount");
    expect(wired[0], "章数没有取内容树那个 actual.chapters").toContain("actual.chapters");
    expect(
      /questions:\s*\d/.test(wired[0]) || /chapters:\s*\d/.test(wired[0]),
      "调用点把章数/题数抄成了常数：它必须吃现读的数",
    ).toBe(false);
    // 结果真的进失败判定与退出码（R16.311：并集与「判定读了这个结果」两处都得钉）
    // 先压平换行与缩进：这条管的是「这个调用的结果有没有进 issues」，
    // 而不是调用点恰好排成几行（换行就红只会逼人把调用挤成一行）。
    const flat = cli.replace(/\s+/g, "");
    expect(flat, "issue 没并进失败判定——漂了会静默通过").toContain(
      "issues.push(...auditReadmeQuizCounts(",
    );
    expect(cli).toMatch(/if \(issues\.length > 0\)[\s\S]*?process\.exit\(1\)/);
  });
});


/**
 * R16.315：把「手抄数字没有主人」这条战役从撞一个修一个换成登记制闭合。
 *
 * 前四轮各修一处（R16.310 的 27、R16.311 的 418、R16.312 的 81、R16.313 的 430），
 * 每一次都是「有人读到那句话才发现它对不上」。这一族判据要防的是**下一处**手抄：
 * 现行文档里扫到的每一个数字，要么登记主人，要么写明为什么不归内容管。
 *
 * 夹具一律取**真实文档的内存副本**再改：登记表与豁免表都是全局表，凭空造一份小文档
 * 会同时撞出十几条「锚点打空」，那种噪音里看不出判据到底咬住了什么。
 */
async function realRegistryInput() {
  const { readdirSync } = await import("node:fs");
  const files = {};
  for (const file of DOC_NUMBER_SCAN_TARGETS) {
    files[file] = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
  }
  const zhRoot = new URL("../content/kline-buty/docs/knowledge/zh", import.meta.url);
  const chapters = readdirSync(zhRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  let lessons = 0;
  for (const entry of chapters) {
    const names = readdirSync(new URL(`../content/kline-buty/docs/knowledge/zh/${entry.name}`, import.meta.url));
    lessons += names.filter((name) => name.endsWith(".md") && name !== "README.md").length;
  }
  const { MIN_QUESTIONS_PER_CHAPTER, parseQuizMounts } = await import("./quiz-source-lib.mjs");
  const quizSource = await readFile(new URL("../src/lib/quizzes.ts", import.meta.url), "utf8");
  const { AUDITED_DOCS } = await import("./db-assertion-counts.mjs");
  return {
    files,
    actual: {
      chapters: chapters.length,
      lessons,
      questions: parseQuizMounts(quizSource).reduce((sum, mount) => sum + (mount.questionCount ?? 0), 0),
      minQuestionsPerChapter: MIN_QUESTIONS_PER_CHAPTER,
      dbAuditedDocs: AUDITED_DOCS.length,
    },
  };
}

describe("doc number registry (R16.315)", () => {
  it("flags a freshly hand-copied number that no owner claims", async () => {
    const { files, actual } = await realRegistryInput();
    expect(auditDocNumberClaims({ files, actual })).toEqual([]);
    const mutated = { ...files, "docs/plan.md": `${files["docs/plan.md"]}\n> 知识库现有 300 篇课程。\n` };
    const issues = auditDocNumberClaims({ files: mutated, actual });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain("docs/plan.md: 扫到一个没有主人的数字「300 篇」");
    expect(issues[0]).toContain("DOC_NUMBER_CLAIMS");
  });

  it("reports a registered claim whose anchor no longer matches the sentence", async () => {
    const { files, actual } = await realRegistryInput();
    const mutated = {
      ...files,
      // 那句被改写成人话，数字没了：登记表里的两条锚点都该打空报错，而不是「没扫到所以一致」
      "README.md": files["README.md"].replace("**Learn**: 27 chapters / 182 lessons", "**Learn**: a graded knowledge base"),
    };
    const issues = auditDocNumberClaims({ files: mutated, actual });
    const blind = issues.filter((issue) => issue.includes("登记的说法找不到锚点"));
    expect(blind).toHaveLength(2);
    for (const issue of blind) expect(issue).toContain("README.md");
  });

  it("names both numbers when a registered claim drifts from its owner", async () => {
    const { files, actual } = await realRegistryInput();
    const drifted = {
      ...files,
      "README.zh-CN.md": files["README.zh-CN.md"].replace("182 篇课程", "183 篇课程"),
    };
    const issues = auditDocNumberClaims({ files: drifted, actual });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain("印的是 183");
    expect(issues[0]).toContain("主人「lessons」当场是 182");
  });

  it("treats an owner the call site failed to resolve as an error, never a silent pass", async () => {
    // R16.294 那一族：解析不到就当作一致，等于给判据装了个开关。
    const { files, actual } = await realRegistryInput();
    const noQuestions = { ...actual };
    delete noQuestions.questions;
    const issues = auditDocNumberClaims({ files, actual: noQuestions });
    const unowned = issues.filter((issue) => issue.includes("没有被调用点解析成非负整数"));
    expect(unowned.length).toBeGreaterThan(0);
    expect(unowned.every((issue) => issue.includes("「questions」"))).toBe(true);
    // 字符串「27」不是数字：它来自文档而不是现读的数，正是这套东西要禁的形状
    const stringly = auditDocNumberClaims({ files, actual: { ...actual, chapters: String(actual.chapters) } });
    expect(stringly.filter((issue) => issue.includes("「chapters」")).length).toBeGreaterThan(0);
    expect(auditDocNumberClaims({ files, actual: undefined }).length).toBeGreaterThan(0);
  });

  it("reports a document the scan list expects but the call site did not read", async () => {
    const { files, actual } = await realRegistryInput();
    const withoutOps = { ...files };
    delete withoutOps["docs/ops.md"];
    const issues = auditDocNumberClaims({ files: withoutOps, actual });
    expect(
      issues.filter((issue) => issue.includes("docs/ops.md: 扫描清单里的文档没被读进来")),
    ).toHaveLength(1);
    // 少读一份文档同时会让命中数跌破地板：两条各管一种后果，都要在
    expect(
      issues.some((issue) => issue.includes("处数量说法，地板")),
      "ops.md 里登记的 5 处说法一并消失，命中地板不该装作「只是少了一份文件」",
    ).toBe(true);
  });

  it("keeps exemptions tied to the shape of the sentence rather than its value", async () => {
    const { files, actual } = await realRegistryInput();
    // 立项期规模那条是历史：数字被换掉也仍然在豁免形状里（豁免不该变成「这两个值我认了」）
    const history = {
      ...files,
      "docs/research.md": files["docs/research.md"].replace("立项时 27 篇章 / 201 篇", "立项时 28 篇章 / 999 篇"),
    };
    expect(auditDocNumberClaims({ files: history, actual })).toEqual([]);
    // 同一串数字换了个说法（不再是「立项时…」），就必须被当成无主人手抄
    const reworded = {
      ...files,
      "docs/research.md": files["docs/research.md"].replace("立项时 27 篇章 / 201 篇", "另一版 27 篇章 / 201 篇"),
    };
    const issues = auditDocNumberClaims({ files: reworded, actual });
    expect(issues.filter((issue) => issue.includes("没有主人的数字"))).toHaveLength(2);
    // 政策触发线（引入虚拟化的那道 >20 题）同理：形状不在豁免里就红
    const policy = {
      ...files,
      "docs/perf-notes.md": files["docs/perf-notes.md"].replace("若未来题库扩到每章 >20 题", "未来每章可到 20 题"),
    };
    expect(
      auditDocNumberClaims({ files: policy, actual }).filter((issue) => issue.includes("「20 题」")),
    ).toHaveLength(1);
    // 豁免还必须**只对它登记的那份文档生效**：把 research.md 那句历史规模原样搬到
    // plan.md 里，它就不再是「立项期事实」而是当代会出现的手抄，必须红。
    // （这一断言是探针逼出来的：去掉 `entry.file === file` 那道过滤，此前没有任何用例会红。）
    const leaked = {
      ...files,
      "docs/plan.md": `${files["docs/plan.md"]}\n- 知识库（立项时 27 篇章 / 201 篇）\n`,
    };
    const leakIssues = auditDocNumberClaims({ files: leaked, actual });
    expect(
      leakIssues.filter((issue) => issue.includes("docs/plan.md: 扫到一个没有主人的数字")),
      `豁免跨文件泄漏了：${JSON.stringify(leakIssues)}`,
    ).toHaveLength(2);
  });

  it("fires its own floors when the registry is emptied or the scanner sees nothing", async () => {
    expect(DOC_NUMBER_CLAIMS.length).toBeGreaterThanOrEqual(DOC_NUMBER_MIN_CLAIMS);
    expect(DOC_NUMBER_CLAIMS.every((claim) => claim.anchor.source.includes("(\\d+)"))).toBe(
      true,
      "每条登记都要有一个捕获组：没有捕获组就定位不到那个数，同句另一个数会被误判成已登记",
    );
    const { actual } = await realRegistryInput();
    const emptied = Object.fromEntries(DOC_NUMBER_SCAN_TARGETS.map((file) => [file, ""]));
    const issues = auditDocNumberClaims({ files: emptied, actual });
    expect(issues.some((issue) => issue.includes(`本次只扫到 0 处数量说法，地板 ${DOC_NUMBER_MIN_HITS}`))).toBe(
      true,
      "扫不到东西时「全部已登记」是空话：判据必须红在自己失效上",
    );
    expect(issues.filter((issue) => issue.includes("登记的说法找不到锚点"))).toHaveLength(
      DOC_NUMBER_CLAIMS.length,
    );
  });

  it("ships with every current number already owned or explicitly excused", async () => {
    const { files, actual } = await realRegistryInput();
    // 主人来自内容树而不是文档自己：否则这条退化成「文档等于文档」
    expect(actual.chapters).toBeGreaterThan(0);
    expect(actual.lessons).toBeGreaterThan(0);
    expect(actual.questions).toBeGreaterThan(0);
    const hits = DOC_NUMBER_SCAN_TARGETS.reduce((sum, file) => sum + scanDocNumberHits(files[file]).length, 0);
    expect(hits).toBeGreaterThanOrEqual(DOC_NUMBER_MIN_HITS);
    expect(auditDocNumberClaims({ files, actual })).toEqual([]);
  });

  it("gives the per-chapter quiz floor one owner instead of three copies", async () => {
    const { MIN_QUESTIONS_PER_CHAPTER } = await import("./quiz-source-lib.mjs");
    const owned = DOC_NUMBER_CLAIMS.filter((claim) => claim.owner === "minQuestionsPerChapter");
    expect(owned.length).toBeGreaterThan(1);
    // 同一份文档里两处不同说法可以共用一个主人；重复的是「文件 + 锚点」这一对
    const keys = DOC_NUMBER_CLAIMS.map((claim) => `${claim.file}::${claim.anchor.source}`);
    expect(keys).toHaveLength(new Set(keys).size);
    expect(new Set(owned.map((claim) => claim.anchor.source)).size).toBe(owned.length);
    const gate = await readFile(new URL("../scripts/check-quiz-coverage.mjs", import.meta.url), "utf8");
    expect(gate, "门禁还在写死字面量，那文档抄的那个数就仍然没有主人").toContain("MIN_QUESTIONS_PER_CHAPTER");
    const { files, actual } = await realRegistryInput();
    expect(actual.minQuestionsPerChapter).toBe(MIN_QUESTIONS_PER_CHAPTER);
    const raised = auditDocNumberClaims({ files, actual: { ...actual, minQuestionsPerChapter: 4 } });
    expect(raised).toHaveLength(owned.length);
    for (const claim of owned) {
      expect(
        raised.some((issue) => issue.startsWith(`${claim.file}: 那句「`) && issue.includes("当场是 4")),
        `${claim.file} 那条抄了纪律的说法要红出来`,
      ).toBe(true);
    }
  });

  it("wires the registry in the CLI to numbers it reads on the spot", async () => {
    const cli = await readFile(new URL("../scripts/check-docs-consistency.mjs", import.meta.url), "utf8");
    expect(cli, "调用点不再 import auditDocNumberClaims——这条核对是死的").toContain("auditDocNumberClaims");
    const wired = cli.match(/auditDocNumberClaims\(\{[\s\S]*?\}\)/);
    expect(wired, "import 了却没调用——正是要防的那种哑门禁").toBeTruthy();
    expect(wired[0]).toContain("chapters: actual.chapters");
    expect(wired[0]).toContain("MIN_QUESTIONS_PER_CHAPTER");
    expect(wired[0]).toContain("AUDITED_DOCS.length");
    expect(/(chapters|lessons|questions):\s*\d/.test(wired[0]), "调用点把主人抄成了常数").toBe(false);
    const flat = cli.replace(/\s+/g, "");
    expect(flat, "issue 没并进失败判定——漂了会静默通过").toContain("issues.push(...auditDocNumberClaims({");
    expect(cli).toMatch(/if \(issues\.length > 0\)[\s\S]*?process\.exit\(1\)/);
  });
});
