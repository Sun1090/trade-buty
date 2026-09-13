// @vitest-environment jsdom
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

let pathname = "/zh/path";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

// 单元测试只关心侧栏自身的分组/高亮逻辑：把 next/link 降级成纯 <a>。
// 真 next/link 在 jsdom 里仍会跑 prefetch/router 的异步链路（实测单文件
// ~3.9s），在满载 CI 上会撞 5s 默认超时造成偶发红灯。
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
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
