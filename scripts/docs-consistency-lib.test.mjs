import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import {
  RELEASE_CHECKLIST_STEPS,
  auditAgentsContract,
  auditArchitectureContract,
  auditContributingContract,
  auditNeutrality,
  auditPlanContract,
  auditReadmeCounts,
  auditReadmeQuizCounts,
  extractReadmeQuizCounts,
  auditReadmeImplementationReferences,
  auditReleaseChecklist,
  auditReleaseVersion,
  extractReadmeCounts,
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
