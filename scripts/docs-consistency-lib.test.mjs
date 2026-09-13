import { describe, expect, it } from "vitest";
import {
  auditAgentsContract,
  auditArchitectureContract,
  auditContributingContract,
  auditNeutrality,
  auditPlanContract,
  auditReadmeCounts,
  auditReadmeImplementationReferences,
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
});
