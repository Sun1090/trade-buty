import { describe, expect, it } from "vitest";
import {
  chapterKey,
  compareKnowledge,
  extractTitle,
  hashText,
  parseEntryPath,
  renderChangelogFragment,
} from "./content-changelog-lib.mjs";

describe("content-changelog-lib", () => {
  it("groups added, changed, removed and unchanged paths deterministically", () => {
    const changes = compareKnowledge({
      prev: { "zh/spot/a.md": "old-a", "zh/spot/b.md": "same", "en/spot/a.md": "old-en" },
      current: { "zh/spot/a.md": "new-a", "zh/spot/b.md": "same", "zh/spot/c.md": "new-c" },
    });

    expect(changes).toEqual({
      added: ["zh/spot/c.md"],
      removed: ["en/spot/a.md"],
      changed: ["zh/spot/a.md"],
      unchanged: ["zh/spot/b.md"],
    });
  });

  it("hashes content and parses locale/chapter/document paths", () => {
    expect(hashText("same")).toBe(hashText("same"));
    expect(hashText("same")).not.toBe(hashText("different"));
    expect(parseEntryPath("zh/spot/spot-basics.md")).toEqual({
      locale: "zh",
      chapter: "spot",
      document: "spot-basics.md",
    });
    expect(chapterKey("zh/spot/spot-basics.md")).toBe("zh/spot");
    expect(chapterKey("zh/README.md")).toBe("zh/（根）");
  });

  it("extracts frontmatter, H1 and filename fallbacks in contract order", () => {
    expect(extractTitle('---\ntitle: "From frontmatter"\n---\n# From H1')).toBe(
      "From frontmatter"
    );
    expect(extractTitle("# From H1\nbody")).toBe("From H1");
    expect(extractTitle("body", "zh/spot/fallback.md")).toBe("fallback");
  });

  it("renders a grouped changelog with README and lesson labels", () => {
    const output = renderChangelogFragment({
      date: "2026-09-12",
      changes: {
        added: ["zh/spot/README.md", "zh/spot/new-lesson.md"],
        changed: ["en/spot/spot-basics.md"],
        removed: [],
      },
      titleOf: (rel) => rel.replace(/\.md$/, ""),
    });

    expect(output).toContain("## 2026-09-12 知识库更新（自动）");
    expect(output).toContain("新增 2 / 内容更新 1 / 移除 0");
    expect(output).toContain("**新增（2）**");
    expect(output).toContain("- README.md（章节导语）：zh/spot/README");
    expect(output).toContain("- new-lesson.md：zh/spot/new-lesson");
    expect(output).toContain("**内容更新（1）**");
    expect(output).toContain("en/spot");
  });

  it("returns an empty fragment when there are no changes", () => {
    expect(
      renderChangelogFragment({
        date: "2026-09-12",
        changes: { added: [], changed: [], removed: [] },
      })
    ).toBe("");
  });
});
