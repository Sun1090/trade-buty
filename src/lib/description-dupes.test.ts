import { describe, expect, it } from "vitest";
import {
  normText,
  normTitleKey,
  findDescriptionDuplicates,
  findTitleClones,
} from "../../scripts/description-dupes-lib.mjs";

const e = (over: Record<string, string> = {}) => ({
  locale: "zh",
  chapter: "spot",
  doc: "spot-basics",
  title: "01 · 现货基础",
  description: "现货的定义与下单流程。",
  ...over,
});

describe("description-dupes lib (R10.15)", () => {
  it("normText 折叠空白并去末尾句读", () => {
    expect(normText("  做多 与 做空。 ")).toBe("做多 与 做空");
    expect(normText("Hello.")).toBe("hello");
  });

  it("normTitleKey 去掉 legacy 前导序号", () => {
    expect(normTitleKey("03 · K 线与图表入门")).toBe("k 线与图表入门");
    expect(normTitleKey("03. 股票基础")).toBe("股票基础");
    expect(normTitleKey("股票基础")).toBe("股票基础");
  });

  it("同 locale 内完全相同 description 判重复", () => {
    const r = findDescriptionDuplicates([
      e(),
      e({ doc: "spot-orders", description: "现货的定义与下单流程。" }),
      e({ locale: "zh", doc: "other", description: "不同的描述" }),
    ]);
    expect(r).toHaveLength(1);
    expect(r[0].docs).toEqual(["spot/spot-orders", "spot/spot-basics"].sort());
    expect(r[0].locale).toBe("zh");
  });

  it("跨 locale 相同 description 不算重复（互为译文）", () => {
    const r = findDescriptionDuplicates([
      e({ locale: "zh" }),
      e({ locale: "en", description: "现货的定义与下单流程。" }),
    ]);
    expect(r).toEqual([]);
  });

  it("空白/句读差异被归一化后仍判重复", () => {
    const r = findDescriptionDuplicates([
      e({ description: "现货基础。 " }),
      e({ doc: "b", description: "现货基础" }),
    ]);
    expect(r).toHaveLength(1);
  });

  it("description 复述标题（含序号差异）被检出", () => {
    const r = findTitleClones([e({ description: "01 · 现货基础" })]);
    expect(r).toHaveLength(1);
    expect(r[0].doc).toBe("spot-basics");
  });

  it("空标题/空描述不误报", () => {
    expect(findTitleClones([e({ title: "", description: "" })])).toEqual([]);
  });
});
