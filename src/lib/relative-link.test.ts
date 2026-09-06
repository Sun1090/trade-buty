import { describe, expect, it } from "vitest";
import {
  linkNodes,
  isExternalOrAnchor,
  resolveLinkTarget,
} from "../../scripts/relative-link-lib.mjs";

describe("relative-link lib (R10.11)", () => {
  describe("linkNodes (remark 提取，与站点渲染同款解析器)", () => {
    it("提取文本链接与图片", () => {
      const md =
        "见 [课程](../futures/margin.md) 与 ![图](./_assets/chart.svg)";
      const nodes = linkNodes(md);
      expect(nodes).toEqual([
        { type: "link", url: "../futures/margin.md", text: "课程" },
        { type: "image", url: "./_assets/chart.svg", text: "图" },
      ]);
    });

    it("跳过 code span / 纯文本里的假链接", () => {
      const md = "内联代码 `](fake.md)` 与 [真链接](real.md) 混排";
      const nodes = linkNodes(md);
      expect(nodes).toHaveLength(1);
      expect(nodes[0].url).toBe("real.md");
    });

    it("外部链接与锚点不被当作站内目标", () => {
      expect(isExternalOrAnchor("https://example.com/x")).toBe(true);
      expect(isExternalOrAnchor("mailto:a@b.c")).toBe(true);
      expect(isExternalOrAnchor("#锚点")).toBe(true);
      expect(isExternalOrAnchor("../futures/")).toBe(false);
    });
  });

  describe("resolveLinkTarget（与 rewriteLinks 语义对齐）", () => {
    it("章节目录链接", () => {
      expect(resolveLinkTarget("../futures/", "spot")).toEqual({
        kind: "chapter",
        chapter: "futures",
      });
      expect(resolveLinkTarget("../futures", "spot")).toEqual({
        kind: "chapter",
        chapter: "futures",
      });
    });

    it("同章 .md 链接", () => {
      expect(resolveLinkTarget("spot-basics.md", "spot")).toEqual({
        kind: "doc",
        chapter: "spot",
        doc: "spot-basics",
      });
    });

    it("跨章 .md 链接与 README 链接", () => {
      expect(resolveLinkTarget("../futures/margin.md", "spot")).toEqual({
        kind: "doc",
        chapter: "futures",
        doc: "margin",
      });
      expect(resolveLinkTarget("../futures/README.md", "spot")).toEqual({
        kind: "chapter",
        chapter: "futures",
      });
    });

    it("带锚点的链接剥离锚点后解析", () => {
      expect(resolveLinkTarget("forex-ea.md#六平台选择的红线清单", "forex-trading")).toEqual({
        kind: "doc",
        chapter: "forex-trading",
        doc: "forex-ea",
      });
    });

    it("同章资产与跨章资产", () => {
      expect(resolveLinkTarget("_assets/chart.svg", "spot")).toEqual({
        kind: "asset",
        owner: "spot",
        file: "chart.svg",
      });
      expect(resolveLinkTarget("../futures/_assets/chain.svg", "spot")).toEqual({
        kind: "asset",
        owner: "futures",
        file: "chain.svg",
      });
    });

    it("空目标解析为当前章节页", () => {
      expect(resolveLinkTarget("", "spot")).toEqual({
        kind: "chapter",
        chapter: "spot",
      });
    });
  });
});
