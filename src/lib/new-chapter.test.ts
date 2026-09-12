import { describe, expect, it } from "vitest";
import {
  chapterNameIssue,
  validateReadme,
  validateLesson,
  findOrderDuplicates,
  planIntegration,
  parseStageSlugs,
  buildReleaseChecklist,
} from "../../scripts/new-chapter-lib.mjs";
import fs from "node:fs";
import path from "node:path";

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

  it("parseStageSlugs 从真实 path.ts 提取 27 章且无重复", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/lib/path.ts"), "utf8");
    const slugs = parseStageSlugs(source);
    expect(slugs).toHaveLength(27);
    expect(new Set(slugs).size).toBe(27);
    expect(slugs).toContain("getting-started");
    expect(slugs).toContain("options-strategies");
  });

  it("buildReleaseChecklist 固定题挂载指向草稿课程时四项就绪/可见", () => {
    const items = buildReleaseChecklist({
      chapter: "new-chapter",
      lessons: [{ slug: "intro", title: "01 · 入门" }],
      hasReadme: true,
      chapterOrder: ["new-chapter"],
      stageSlugs: ["new-chapter"],
      quizMount: { docSlug: "intro" },
    });
    expect(items.map((item) => item.id)).toEqual([
      "search-index",
      "sitemap",
      "quiz-mount",
      "path-group",
    ]);
    expect(items.every((item) => !item.blocking)).toBe(true);
    expect(items[2].status).toBe("ready");
    expect(items[3].status).toBe("ready");
  });

  it("buildReleaseChecklist 识别坏测验挂载与未分组章节", () => {
    const items = buildReleaseChecklist({
      chapter: "new-chapter",
      lessons: ["intro"],
      hasReadme: true,
      chapterOrder: ["new-chapter"],
      stageSlugs: [],
      quizMount: { docSlug: "missing" },
    });
    const quiz = items.find((item) => item.id === "quiz-mount");
    const group = items.find((item) => item.id === "path-group");
    expect(quiz).toMatchObject({ status: "block", blocking: true });
    expect(quiz?.detail).toContain("missing");
    expect(group).toMatchObject({ status: "action", blocking: false });
    expect(group?.detail).toContain("STAGES");
  });

  it("buildReleaseChecklist 未挂固定题时提示 AI 回退而非误报成功", () => {
    const items = buildReleaseChecklist({ chapter: "new-chapter", lessons: ["intro"], hasReadme: true });
    expect(items.find((item) => item.id === "quiz-mount")).toMatchObject({
      status: "action",
      blocking: false,
    });
  });
});
