import { describe, expect, it } from "vitest";
import { checkNewCourse, renderNewCourseMarkdown } from "../../scripts/new-course-lib.mjs";

const GOOD_ZH = [
  "---",
  "title: 01 · 现货交易基础",
  "description: 现货定义、下单流程、四种订单类型、手续费结构、现货做空的间接方式全解析",
  "---",
  "",
  "# 现货交易基础",
  "",
  "正文。",
  "",
  "::: warning ⚠️ 风险提示",
  "现货也有归零、流动性枯竭等风险。",
  ":::",
  "",
].join("\n");

describe("new-course acceptance (R10.6)", () => {
  it("passes a compliant zh lesson end to end", () => {
    const result = checkNewCourse({ locale: "zh", chapter: "spot", document: "spot-basics", markdown: GOOD_ZH });
    expect(result.status).toBe("ok");
    expect(result.checks.every((c) => c.pass)).toBe(true);
  });

  it("blocks a lesson without a risk-warning block", () => {
    const markdown = GOOD_ZH.replace("::: warning ⚠️ 风险提示", "::: warning 一般注意").replace("现货也有归零、流动性枯竭等风险。", "仅作教学示例。");
    const result = checkNewCourse({ locale: "zh", chapter: "spot", document: "spot-basics", markdown });
    expect(result.status).toBe("fail");
    const risk = result.checks.find((c) => c.id === "risk-block");
    expect(risk?.pass).toBe(false);
    expect(risk?.level).toBe("blocking");
  });

  it("blocks missing frontmatter description", () => {
    const markdown = GOOD_ZH.replace("description: 现货定义、下单流程、四种订单类型、手续费结构、现货做空的间接方式全解析\n", "");
    const result = checkNewCourse({ locale: "zh", chapter: "spot", document: "spot-basics", markdown });
    expect(result.status).toBe("fail");
    expect(result.checks.find((c) => c.id === "description-present")?.pass).toBe(false);
  });

  it("blocks a zh title without the NN · leading number", () => {
    const markdown = GOOD_ZH.replace("title: 01 · 现货交易基础", "title: 现货交易基础");
    const result = checkNewCourse({ locale: "zh", chapter: "spot", document: "spot-basics", markdown });
    expect(result.status).toBe("fail");
    expect(result.checks.find((c) => c.id === "zh-title-numbered")?.pass).toBe(false);
  });

  it("skips the numbering rule for en lessons by design", () => {
    const en = [
      "---",
      'title: "Spot Trading Basics"',
      'description: "Spot definition, order flow, fees and indirect shorting, in one place"',
      "---",
      "",
      "# Spot Trading Basics",
      "",
      "::: warning ⚠️ Risk Warning",
      "Spot assets can still go to zero.",
      ":::",
    ].join("\n");
    const result = checkNewCourse({ locale: "en", chapter: "spot", document: "spot-basics", markdown: en });
    expect(result.status).toBe("ok");
    expect(result.checks.find((c) => c.id === "zh-title-numbered")?.pass).toBe(true);
  });

  it("rejects a non-slug document filename", () => {
    const result = checkNewCourse({ locale: "zh", chapter: "spot", document: "01-现货", markdown: GOOD_ZH });
    expect(result.status).toBe("fail");
    expect(result.checks.find((c) => c.id === "file-slug")?.pass).toBe(false);
  });

  it("downgrades to warn when only advisory checks fail", () => {
    const markdown = GOOD_ZH.replace("description: 现货定义、下单流程、四种订单类型、手续费结构、现货做空的间接方式全解析", "description: 太短");
    const result = checkNewCourse({ locale: "zh", chapter: "spot", document: "spot-basics", markdown });
    expect(result.status).toBe("warn");
    const bad = result.checks.filter((c) => !c.pass);
    expect(bad.length).toBeGreaterThan(0);
    expect(bad.every((c) => c.level === "advisory")).toBe(true);
  });

  it("renders a stable rollup report with ok/warn/fail counts", () => {
    const good = checkNewCourse({ locale: "zh", chapter: "spot", document: "spot-basics", markdown: GOOD_ZH });
    const bad = checkNewCourse({ locale: "zh", chapter: "spot", document: "no-risk", markdown: GOOD_ZH.replace("::: warning ⚠️ 风险提示", "::: warning 一般注意") });
    const markdown = renderNewCourseMarkdown({ generatedAt: "2026-09-06", results: [good, bad] });
    expect(markdown).toContain("zh：2 篇 | ✅ ok 1 | ⚠️ warn 0 | ❌ fail 1");
    expect(markdown).toContain("## 非 ok 清单");
    expect(markdown).toContain("2026-09-06");
  });
});
