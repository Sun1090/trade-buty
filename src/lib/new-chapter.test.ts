import { describe, expect, it } from "vitest";
import {
  chapterNameIssue,
  validateReadme,
  validateLesson,
  findOrderDuplicates,
  planIntegration,
} from "../../scripts/new-chapter-lib.mjs";

describe("new-chapter lib (R10.16)", () => {
  it("chapterNameIssue 只放行合法 slug", () => {
    expect(chapterNameIssue("new-chapter")).toBeNull();
    expect(chapterNameIssue("新章节")).not.toBeNull();
    expect(chapterNameIssue("NewChapter")).not.toBeNull();
    expect(chapterNameIssue("a b")).not.toBeNull();
  });

  it("validateReadme 校验 title 格式与 description", () => {
    expect(validateReadme({ title: "28 · 新章节", description: "简介" })).toEqual([]);
    expect(validateReadme({ title: "新章节", description: "简介" })).toHaveLength(1);
    expect(validateReadme({ title: "28 · 新章节", description: "" })).toHaveLength(1);
    expect(validateReadme({})).not.toHaveLength(0);
  });

  it("validateReadme 校验正文 H1 与 frontmatter 一致", () => {
    expect(
      validateReadme({ title: "28 · 新章节", description: "d", h1: "28 · 不一致" }),
    ).toHaveLength(1);
  });

  it("validateLesson 校验 slug 与双字段", () => {
    expect(validateLesson({ slug: "intro", title: "01 · 入门", description: "d" })).toEqual([]);
    expect(validateLesson({ slug: "坏名字", title: "01 · 入门", description: "d" })).toHaveLength(1);
    expect(validateLesson({ slug: "intro", title: "", description: "d" })).toHaveLength(1);
    expect(validateLesson({ slug: "intro", title: "01 · 入门", description: "" })).toHaveLength(1);
  });

  it("findOrderDuplicates 检出显式序号重复", () => {
    const r = findOrderDuplicates([
      { slug: "a", title: "01 · A" },
      { slug: "b", title: "01 · B" },
      { slug: "c", title: "02 · C" },
      { slug: "d", title: "无序号" },
    ]);
    expect(r).toEqual([{ order: 1, slugs: ["a", "b"] }]);
  });

  it("findOrderDuplicates 忽略 999+（设计上保留给无序号回退）", () => {
    const r = findOrderDuplicates([{ slug: "a", title: "999 · X" }]);
    expect(r).toEqual([]);
  });

  it("planIntegration 提示未收录与章数变化", () => {
    const notes = planIntegration({
      chapter: "new-chapter",
      existingOrder: ["getting-started"],
      zhChapterCount: 27,
    });
    expect(notes.join("\n")).toContain("未收录");
    expect(notes.join("\n")).toContain("27 变为 28");
  });
});
