// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MobileNav } from "./mobile-nav";

const items = [
  { href: "/path", label: "路线", icon: "📚" },
  { href: "/chart", label: "行情", icon: "📈" },
];

describe("MobileNav", () => {
  it("渲染汉堡按钮", () => {
    render(<MobileNav items={items} locale="zh" />);
    expect(screen.getByLabelText("Menu")).toBeInTheDocument();
  });

  it("点击展开抽屉显示导航项", () => {
    const { container } = render(<MobileNav items={items} locale="zh" />);
    fireEvent.click(container.querySelector("button")!);
    expect(screen.getAllByText("路线").length).toBeGreaterThan(0);
    expect(screen.getAllByText("行情").length).toBeGreaterThan(0);
  });

  it("链接含 locale 前缀", () => {
    const { container } = render(<MobileNav items={items} locale="en" />);
    fireEvent.click(container.querySelector("button")!);
    const link = container.querySelector('a[href="/en/path"]');
    expect(link).toBeTruthy();
  });
});
