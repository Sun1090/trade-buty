import { describe, expect, it } from "vitest";
import {
  chapterKey,
  compareKnowledge,
  extractTitle,
  hashText,
  parseEntryPath,
  renderChangelogFragment,
} from "../../scripts/content-changelog-lib.mjs";

describe("content changelog lib (R10.7)", () => {
  describe("hashText", () => {
    it("is a stable 64-hex sha256", () => {
      expect(hashText("正文")).toMatch(/^[0-9a-f]{64}$/);
      expect(hashText("正文")).toBe(hashText("正文"));
    });

    it("changes when content changes", () => {
      expect(hashText("old content")).not.toBe(hashText("new content"));
    });
  });

  describe("parseEntryPath", () => {
    it("splits locale/chapter/document", () => {
      expect(parseEntryPath("en/forex-trading/forex-basics.md")).toEqual({
        locale: "en",
        chapter: "forex-trading",
        document: "forex-basics.md",
      });
    });

    it("handles root README", () => {
      expect(parseEntryPath("README.md")).toEqual({
        locale: null,
        chapter: null,
        document: "README.md",
      });
    });

    it("handles chapter intro README", () => {
      expect(parseEntryPath("zh/spot/README.md")).toEqual({
        locale: "zh",
        chapter: "spot",
        document: "README.md",
      });
    });
  });

  describe("chapterKey", () => {
    it("groups lessons by locale/chapter", () => {
      expect(chapterKey("zh/spot/spot-basics.md")).toBe("zh/spot");
      expect(chapterKey("en/forex-trading/README.md")).toBe("en/forex-trading");
    });

    it("routes root README to root bucket", () => {
      expect(chapterKey("README.md")).toBe("（根）");
    });
  });

  describe("compareKnowledge", () => {
    it("reports zero changes on identical snapshots", () => {
      const prev = { "zh/spot/spot-basics.md": "a", "en/spot/spot-basics.md": "b" };
      const current = { ...prev };
      expect(compareKnowledge({ prev, current })).toEqual({
        added: [],
        removed: [],
        changed: [],
        unchanged: ["en/spot/spot-basics.md", "zh/spot/spot-basics.md"],
      });
    });

    it("splits added / removed / changed / unchanged", () => {
      const prev = {
        "zh/spot/spot-basics.md": "hash-old",
        "zh/spot/spot-intermediate.md": "same",
        "zh/spot/dropped.md": "gone",
      };
      const current = {
        "zh/spot/spot-basics.md": "hash-new",
        "zh/spot/spot-intermediate.md": "same",
        "en/forex-trading/forex-basics.md": "fresh",
      };
      const diff = compareKnowledge({ prev, current });
      expect(diff.added).toEqual(["en/forex-trading/forex-basics.md"]);
      expect(diff.changed).toEqual(["zh/spot/spot-basics.md"]);
      expect(diff.removed).toEqual(["zh/spot/dropped.md"]);
      expect(diff.unchanged).toEqual(["zh/spot/spot-intermediate.md"]);
    });

    it("treats a missing baseline as all-added without crashing", () => {
      const diff = compareKnowledge({ prev: {}, current: { "zh/a.md": "h" } });
      expect(diff.added).toEqual(["zh/a.md"]);
      expect(diff.changed).toEqual([]);
    });
  });

  describe("extractTitle", () => {
    it("prefers frontmatter title", () => {
      const md = "---\ntitle: 01 · 现货交易基础\ndescription: d\n---\n\n# 现货交易基础\n";
      expect(extractTitle(md, "zh/spot/spot-basics.md")).toBe("01 · 现货交易基础");
    });

    it("falls back to first H1 for chapter README", () => {
      expect(extractTitle("# Forex Trading in Practice\n\nbody", "en/forex-trading/README.md")).toBe(
        "Forex Trading in Practice",
      );
    });

    it("falls back to filename stem when no title/H1", () => {
      expect(extractTitle("body only", "zh/spot/spot-basics.md")).toBe("spot-basics");
    });
  });

  describe("renderChangelogFragment", () => {
    it("returns empty string when nothing changed", () => {
      expect(renderChangelogFragment({ date: "2026-09-06", changes: { added: [], changed: [], removed: [] } })).toBe("");
    });

    it("renders dated fragment grouped by chapter with titles", () => {
      const fragment = renderChangelogFragment({
        date: "2026-09-06",
        changes: {
          added: ["en/forex-trading/forex-basics.md", "en/forex-trading/README.md"],
          changed: ["zh/spot/spot-basics.md"],
          removed: ["zh/spot/dropped.md"],
        },
        titleOf: (rel) =>
          ({ "en/forex-trading/forex-basics.md": "Forex Basics", "en/forex-trading/README.md": "Forex in Practice", "zh/spot/spot-basics.md": "01 · 现货交易基础" })[rel] ?? null,
      });
      expect(fragment).toContain("## 2026-09-06 知识库更新（自动）");
      expect(fragment).toContain("共 4 篇变化：新增 2 / 内容更新 1 / 移除 1。");
      expect(fragment).toContain("**新增（2）**");
      expect(fragment).toContain("- en/forex-trading");
      expect(fragment).toContain("  - forex-basics.md：Forex Basics");
      expect(fragment).toContain("  - README.md（章节导语）：Forex in Practice");
      expect(fragment).toContain("**内容更新（1）**");
      expect(fragment).toContain("- zh/spot");
      expect(fragment).toContain("  - spot-basics.md：01 · 现货交易基础");
      expect(fragment).toContain("**移除（1）**");
      // 移除的文档读不到内容，回退到文件名（无标题冒号后缀）
      expect(fragment).toContain("  - dropped.md");
      expect(fragment).not.toContain("dropped.md：");
    });

    it("orders chapters deterministically", () => {
      const fragment = renderChangelogFragment({
        date: "2026-09-06",
        changes: { added: ["zh/spot/b.md", "en/career/a.md", "README.md"], changed: [], removed: [] },
        titleOf: () => null,
      });
      expect(fragment.indexOf("en/career")).toBeLessThan(fragment.indexOf("zh/spot"));
      expect(fragment).toContain("（根）");
    });
  });
});
