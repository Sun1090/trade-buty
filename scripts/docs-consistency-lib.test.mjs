import { describe, expect, it } from "vitest";
import {
  auditAgentsContract,
  auditNeutrality,
  auditPlanContract,
  auditReadmeCounts,
  extractReadmeCounts,
} from "./docs-consistency-lib.mjs";

const expected = { chapters: 27, lessons: 182 };
const validReadmes = {
  en: "**Learn**: 27 chapters / 182 lessons",
  zh: "**学**：27 篇章 / 182 篇课程",
};

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

  it("catches sponsor sections that conflict with the no-donation promise", () => {
    const about = "We don't run ads and accept no donations.";
    expect(auditNeutrality(validReadmes, about)).toEqual([]);
    expect(
      auditNeutrality({ "README.md": "## Sponsor\nbuying the author a coffee" }, about)
    ).toContain("README.md: 存在与“不接受捐赠”承诺冲突的赞助入口");
  });
});
