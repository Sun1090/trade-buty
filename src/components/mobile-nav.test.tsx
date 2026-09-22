// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MobileNav } from "./mobile-nav";

const items = [
  { href: "/path", label: "路线", icon: "📚" },
  { href: "/chart", label: "行情", icon: "📈" },
];

describe("MobileNav", () => {
  it("触发按钮的可访问名称来自传入文案", () => {
    render(<MobileNav items={items} locale="zh" menuLabel="菜单" />);
    expect(screen.getByLabelText("菜单")).toBeInTheDocument();
  });

  it("点击展开抽屉显示导航项", () => {
    const { container } = render(
      <MobileNav items={items} locale="zh" menuLabel="菜单" />,
    );
    fireEvent.click(container.querySelector("button")!);
    expect(screen.getAllByText("路线").length).toBeGreaterThan(0);
    expect(screen.getAllByText("行情").length).toBeGreaterThan(0);
  });

  it("链接含 locale 前缀", () => {
    const { container } = render(
      <MobileNav items={items} locale="en" menuLabel="Menu" />,
    );
    fireEvent.click(container.querySelector("button")!);
    const link = container.querySelector('a[href="/en/path"]');
    expect(link).toBeTruthy();
  });

  it("打开后聚焦首项，Escape 关闭并把焦点还给触发按钮", async () => {
    render(<MobileNav items={items} locale="zh" menuLabel="菜单" />);
    const trigger = screen.getByLabelText("菜单");
    trigger.focus();
    fireEvent.click(trigger);

    // 抽屉本身也要有同一个可访问名称：读屏用户得知道自己在哪个区域里
    expect(screen.getByRole("dialog", { name: "菜单" })).toBeInTheDocument();

    const firstLink = screen.getByRole("link", { name: /路线/ });
    await waitFor(() => expect(firstLink).toHaveFocus());
    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });
});
