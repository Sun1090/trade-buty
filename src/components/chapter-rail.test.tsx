// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

let progress: Record<string, string[]> | null = {};
vi.mock("@/components/use-local-progress", () => ({
  useLocalProgress: () => progress,
}));

import { ChapterRail } from "./chapter-rail";

const dict = {
  nextChapter: "下一章",
  progressLabel: "本章进度",
  lessonsUnit: "课",
  unreadLabel: "未读",
};

const docs = [
  { slug: "d1", title: "第一课" },
  { slug: "d2", title: "第二课" },
  { slug: "d3", title: "第三课" },
];

const base = {
  chapterSlug: "chapter-a",
  chapterTitle: "章节 A",
  chapterTagline: "介绍",
  docCount: 3,
  docs,
  currentDoc: "d1",
  nextChapter: { slug: "chapter-b", title: "章节 B", tagline: "下一章介绍" },
  locale: "zh",
  dict,
};

beforeEach(() => {
  progress = {};
});

describe("ChapterRail", () => {
  it("按已读数量计算百分比", () => {
    progress = { "chapter-a": ["d1"] };
    render(<ChapterRail {...base} />);
    // d1 已读 → 未读 2，进度 33%
    expect(screen.getByText("1/3 课")).toBeInTheDocument();
    expect(screen.getByText("33%")).toBeInTheDocument();
  });

  it("未读列表默认收起，aria-expanded=false", () => {
    progress = {};
    render(<ChapterRail {...base} />);
    const toggle = screen.getByRole("button", { name: /未读 \(3\)/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link", { name: "第二课" })).toBeNull();
  });

  it("点击后展开未读列表，aria-expanded=true", () => {
    progress = { "chapter-a": ["d1"] };
    render(<ChapterRail {...base} />);
    fireEvent.click(screen.getByRole("button", { name: /未读 \(2\)/ }));
    expect(screen.getByRole("button", { name: /未读 \(2\)/ })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("link", { name: "第二课" })).toHaveAttribute(
      "href",
      "/zh/knowledge/chapter-a/d2",
    );
  });

  it("已读课程不出现在未读列表", () => {
    progress = { "chapter-a": ["d1"] };
    render(<ChapterRail {...base} />);
    fireEvent.click(screen.getByRole("button", { name: /未读/ }));
    expect(screen.queryByRole("link", { name: "第一课" })).toBeNull();
    expect(screen.getByRole("link", { name: "第三课" })).toBeInTheDocument();
  });

  it("全部读完显示 100%，且不再显示未读列表", () => {
    progress = { "chapter-a": ["d1", "d2", "d3"] };
    render(<ChapterRail {...base} />);
    expect(screen.getByText("3/3 课")).toBeInTheDocument();
    expect(screen.getByText("✓ 本章进度 100%")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /未读/ })).toBeNull();
  });

  it("存在下一章时渲染下一章链接", () => {
    progress = {};
    render(<ChapterRail {...base} />);
    expect(screen.getByRole("link", { name: /章节 B/ })).toHaveAttribute(
      "href",
      "/zh/knowledge/chapter-b",
    );
  });

  it("nextChapter 为 null 时不渲染下一章 CTA", () => {
    progress = {};
    render(<ChapterRail {...base} nextChapter={null} />);
    expect(screen.queryByText(/下一章 →/)).toBeNull();
  });

  it("docCount 为 0 时百分比为 0，不产生 NaN", () => {
    progress = {};
    render(<ChapterRail {...base} docCount={0} docs={[]} />);
    expect(screen.getByText("0%")).toBeInTheDocument();
  });
});
