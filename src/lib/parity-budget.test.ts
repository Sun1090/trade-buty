import { describe, expect, it } from "vitest";
import {
  checkParityBudget,
  formatRatio,
} from "../../scripts/parity-budget-lib.mjs";

const perChapter = [
  { chapter: "spot", zh: 6, en: 6, overlap: 6 },
  { chapter: "futures", zh: 7, en: 6, overlap: 6 },
  { chapter: "crypto", zh: 3, en: 0, overlap: 0 },
  { chapter: "career", zh: 5, en: 5, overlap: 5 },
];

describe("parity-budget lib (R10.20)", () => {
  it("formatRatio 输出百分比", () => {
    expect(formatRatio(1)).toBe("100%");
    expect(formatRatio(2 / 3)).toBe("66.7%");
    expect(formatRatio(0)).toBe("0%");
  });

  it("全达预算 → passed=checked 无失败", () => {
    const r = checkParityBudget({
      stats: { perChapter },
      budgetEntries: [
        { chapter: "spot", budget: 1 },
        { chapter: "career", budget: 1 },
      ],
    });
    expect(r.failures).toEqual([]);
    expect(r.unknown).toEqual([]);
    expect(r.passed).toBe(2);
  });

  it("低于预算（en 缺译文）→ 失败并给出缺口", () => {
    const r = checkParityBudget({
      stats: { perChapter },
      budgetEntries: [{ chapter: "futures", budget: 1, note: "核心" }],
    });
    expect(r.failures).toHaveLength(1);
    const f = r.failures[0];
    expect(f.chapter).toBe("futures");
    expect(f.ratio).toBeCloseTo(6 / 7);
    expect(f.reason).toContain("6/7");
    expect(f.note).toBe("核心");
  });

  it("zh 空章节视为已达标（ratio=1）", () => {
    const r = checkParityBudget({
      stats: { perChapter: [{ chapter: "empty", zh: 0, en: 0, overlap: 0 }] },
      budgetEntries: [{ chapter: "empty", budget: 1 }],
    });
    expect(r.failures).toEqual([]);
    expect(r.passed).toBe(1);
  });

  it("预算章节在 KB 不存在 → unknown，不进失败也不进通过", () => {
    const r = checkParityBudget({
      stats: { perChapter },
      budgetEntries: [{ chapter: "ghost", budget: 1 }],
    });
    expect(r.unknown).toEqual([{ chapter: "ghost" }]);
    expect(r.failures).toEqual([]);
    expect(r.passed).toBe(0);
    expect(r.checked).toBe(1);
  });
});
