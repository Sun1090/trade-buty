// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

let pathname = "/zh/path";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

import { LearningSidebar } from "./learning-sidebar";

const labels = {
  learn: "学习路线",
  practice: "回放练习",
  review: "错题本",
  stats: "学习统计",
  bookmarks: "收藏夹",
  search: "搜索",
  ai: "AI 助手",
};

describe("LearningSidebar", () => {
  it("renders the grouped navigation with localized titles", () => {
    pathname = "/zh/path";
    render(<LearningSidebar locale="zh" labels={labels} />);
    expect(screen.getByRole("navigation", { name: "主导航" })).toBeInTheDocument();
    expect(screen.getByText("练习")).toBeInTheDocument();
    expect(screen.getByText("我的学习")).toBeInTheDocument();
  });

  it("marks the current page with aria-current", () => {
    pathname = "/zh/stats";
    render(<LearningSidebar locale="zh" labels={labels} />);
    expect(screen.getByRole("link", { name: /学习统计/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: /搜索/ })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("treats nested lesson routes as belonging to their section", () => {
    pathname = "/zh/replay/session-1";
    render(<LearningSidebar locale="zh" labels={labels} />);
    expect(screen.getByRole("link", { name: /回放练习/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("does not mark the dashboard active on sub-routes", () => {
    pathname = "/zh/path";
    render(<LearningSidebar locale="zh" labels={labels} />);
    expect(screen.getByRole("link", { name: /学习首页/ })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("localizes both the labels and the route prefix for English", () => {
    pathname = "/en/search";
    render(<LearningSidebar locale="en" labels={labels} />);
    expect(screen.getByRole("navigation", { name: "Main navigation" })).toBeInTheDocument();
    const search = screen.getByRole("link", { name: /搜索/ });
    expect(search).toHaveAttribute("href", "/en/search");
    expect(search).toHaveAttribute("aria-current", "page");
  });
});
