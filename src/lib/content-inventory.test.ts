import { describe, expect, it } from "vitest";
import { buildContentInventory, renderContentInventoryMarkdown } from "../../scripts/content-inventory-lib.mjs";

const zh = {
  alpha: { documents: ["one", "two"] },
  beta: { documents: ["three"] },
};

const en = {
  alpha: { documents: ["one"] },
};

describe("content inventory (R10.1)", () => {
  it("computes chapter and document gaps independently", () => {
    const report = buildContentInventory(zh, en, "2026-09-06");
    expect(report.locales.zh).toEqual({ chapters: 2, documents: 3 });
    expect(report.locales.en).toEqual({ chapters: 1, documents: 1 });
    expect(report.coverage.chapter).toEqual({ translated: 1, total: 2, percent: 50 });
    expect(report.coverage.document).toEqual({ translated: 1, total: 3, percent: 33.3 });
    expect(report.missing).toEqual({ chapters: ["beta"], documents: [{ chapter: "alpha", documents: ["two"] }, { chapter: "beta", documents: ["three"] }] });
  });

  it("renders a no-gap report without unstable ordering", () => {
    const report = buildContentInventory({ alpha: { documents: ["one"] } }, { alpha: { documents: ["one"] } }, "2026-09-06");
    const markdown = renderContentInventoryMarkdown(report);
    expect(markdown).toContain("✅ 当前 zh 内容均有对应英文版本。");
    expect(markdown).toContain("课程覆盖：1/1（100%）");
  });
});
