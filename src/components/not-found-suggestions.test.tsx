// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

let pathname = "/zh/knowledge/chapter-a/missing";
let parsed: { chapter?: string; doc?: string } | null = { chapter: "chapter-a" };
let suggestions: Array<{ slug: string; title: string; href: string }> = [];
let fallback: Array<{ slug: string; title: string; href: string }> = [];

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));
vi.mock("@/lib/url-suggest", () => ({
  parseKnowledgePath: () => parsed,
  suggestFromPath: () => suggestions,
  pickFallback: () => fallback,
}));

import { NotFoundSuggestions } from "./not-found-suggestions";

const corpus = [
  { slug: "chapter-a", title: "章节 A", href: "/zh/knowledge/chapter-a" },
];

beforeEach(() => {
  pathname = "/zh/knowledge/chapter-a/missing";
  parsed = { chapter: "chapter-a" };
  suggestions = [
    { slug: "a1", title: "A1", href: "/zh/knowledge/chapter-a/a1" },
  ];
  fallback = [{ slug: "chapter-b", title: "章节 B", href: "/zh/knowledge/chapter-b" }];
});

describe("NotFoundSuggestions（R8.11）", () => {
  it("非知识库路径不渲染", () => {
    parsed = null;
    const { container } = render(
      <NotFoundSuggestions corpus={corpus} heading="猜你想学" subheading="副标题" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("知识库路径且有推荐时渲染推荐链接", () => {
    render(<NotFoundSuggestions corpus={corpus} heading="猜你想学" subheading="副标题" />);
    expect(screen.getByTestId("not-found-suggestions")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /A1/ })).toHaveAttribute(
      "href",
      "/zh/knowledge/chapter-a/a1",
    );
  });

  it("无可用推荐时回退到热门课程", () => {
    suggestions = [];
    render(<NotFoundSuggestions corpus={corpus} heading="猜你想学" subheading="副标题" />);
    expect(screen.getByRole("link", { name: /章节 B/ })).toHaveAttribute(
      "href",
      "/zh/knowledge/chapter-b",
    );
  });

  it("渲染标题与副标题", () => {
    render(<NotFoundSuggestions corpus={corpus} heading="猜你想学" subheading="从这里开始" />);
    expect(screen.getByText("猜你想学")).toBeInTheDocument();
    expect(screen.getByText("从这里开始")).toBeInTheDocument();
  });
});
