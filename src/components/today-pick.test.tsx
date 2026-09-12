// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

let progress: Record<string, string[]> | null = {};
vi.mock("@/components/use-local-progress", () => ({
  useLocalProgress: () => progress,
}));

import { TodayPick } from "./today-pick";

const chapters = [
  {
    slug: "chapter-a",
    title: "章节 A",
    docs: [
      { slug: "a1", title: "A1" },
      { slug: "a2", title: "A2" },
    ],
  },
  {
    slug: "chapter-b",
    title: "章节 B",
    docs: [{ slug: "b1", title: "B1" }],
  },
];

const props = { locale: "zh", label: "今日推荐", hint: "继续", done: "全部学完" };

beforeEach(() => {
  progress = {};
});

describe("TodayPick", () => {
  it("从第一章的第一篇未读课程开始推荐", () => {
    progress = { "chapter-a": ["a1"] };
    render(<TodayPick chapters={chapters} {...props} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/zh/knowledge/chapter-a/a2");
    expect(screen.getByText("A2")).toBeInTheDocument();
    expect(screen.getByText(/继续 · 章节 A/)).toBeInTheDocument();
  });

  it("无任何进度时推荐第一章第一篇", () => {
    progress = {};
    render(<TodayPick chapters={chapters} {...props} />);
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/zh/knowledge/chapter-a/a1",
    );
  });

  it("全部读完时回退到第一篇并显示完成文案", () => {
    progress = { "chapter-a": ["a1", "a2"], "chapter-b": ["b1"] };
    render(<TodayPick chapters={chapters} {...props} />);
    expect(screen.getByText("全部学完")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/zh/knowledge/chapter-a/a1",
    );
  });

  it("没有章节时不渲染", () => {
    const { container } = render(<TodayPick chapters={[]} {...props} />);
    expect(container.firstChild).toBeNull();
  });

  it("locale 影响链接前缀", () => {
    progress = {};
    render(<TodayPick chapters={chapters} {...props} locale="en" />);
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/en/knowledge/chapter-a/a1",
    );
  });
});
