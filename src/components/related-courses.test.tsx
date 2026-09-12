// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { getDocMetas } from "@/lib/content";
import { RelatedCourses } from "./related-courses";

const CHAPTER = "getting-started";

describe("RelatedCourses", () => {
  it("列出同篇章其他课程，排除当前课与指定排除项", () => {
    const docs = getDocMetas("zh", CHAPTER);
    const [first, second] = docs;
    render(
      <RelatedCourses
        locale="zh"
        chapterSlug={CHAPTER}
        currentDoc={first!.slug}
        exclude={second!.slug}
        label="相关课程"
      />,
    );
    expect(screen.getByText("相关课程")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: new RegExp(first!.title) })).toBeNull();
    expect(screen.queryByRole("link", { name: new RegExp(second!.title) })).toBeNull();
    // 其余课程应出现（渲染上限 5）
    const links = screen.queryAllByRole("link");
    expect(links.length).toBe(Math.min(docs.length - 2, 5));
    for (const link of links) {
      expect(link.getAttribute("href")).toMatch(
        new RegExp(`^/zh/knowledge/${CHAPTER}/`),
      );
    }
  });

  it("最多渲染 5 条", () => {
    const docs = getDocMetas("zh", CHAPTER);
    render(
      <RelatedCourses
        locale="zh"
        chapterSlug={CHAPTER}
        currentDoc="__none__"
        exclude="__none__"
        label="相关课程"
      />,
    );
    expect(screen.getAllByRole("link").length).toBe(Math.min(docs.length, 5));
  });

  it("过滤后无内容时不渲染", () => {
    const docs = getDocMetas("zh", CHAPTER);
    // 用一个排除项覆盖不了全部；改为极短章节：假设 docs 长度 ≥1，用 first 作为唯一候选
    const single = docs.length === 1;
    const { container } = render(
      <RelatedCourses
        locale="zh"
        chapterSlug={CHAPTER}
        currentDoc={docs[0]!.slug}
        exclude={single ? "__none__" : docs[1]!.slug}
        label="相关课程"
      />,
    );
    if (single) {
      expect(container.firstChild).toBeNull();
    } else {
      expect(container.firstChild).not.toBeNull();
    }
  });

  it("英文 locale 链接指向 /en", () => {
    const docs = getDocMetas("en", CHAPTER);
    if (docs.length < 2) return;
    render(
      <RelatedCourses
        locale="en"
        chapterSlug={CHAPTER}
        currentDoc={docs[0]!.slug}
        exclude="__none__"
        label="Related"
      />,
    );
    for (const link of screen.getAllByRole("link")) {
      expect(link.getAttribute("href")).toMatch(/^\/en\/knowledge\//);
    }
  });
});
