// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

let pathname = "/zh/knowledge/chapter-a/missing";
let parsed: { chapter?: string; doc?: string } | null = { chapter: "chapter-a" };
let suggestions: Array<{ slug: string; title: string; href: string }> = [];

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));
vi.mock("@/lib/url-suggest", () => ({
  parseKnowledgePath: () => parsed,
  suggestFromPath: () => suggestions,
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

  // 小标题写的是「按你访问的地址猜的」。排不出与地址有关的东西时，这一栏只能收起——
  // 旧写法在这里回退到语料前三条（`pickFallback`）并把它叫作「热门课程」，
  // 于是屏幕上出现一个与地址无关、又号称按地址猜来的列表。
  it("地址里排不出推荐 → 整栏收起，不留下与地址无关的列表", () => {
    suggestions = [];
    const { container } = render(
      <NotFoundSuggestions corpus={corpus} heading="猜你想学" subheading="副标题" />,
    );
    expect(container.firstChild).toBeNull();
    expect(screen.queryByText("猜你想学")).not.toBeInTheDocument();
  });

  it("渲染标题与副标题", () => {
    render(<NotFoundSuggestions corpus={corpus} heading="猜你想学" subheading="从这里开始" />);
    expect(screen.getByText("猜你想学")).toBeInTheDocument();
    expect(screen.getByText("从这里开始")).toBeInTheDocument();
  });
});
