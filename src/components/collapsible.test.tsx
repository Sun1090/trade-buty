// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Collapsible } from "./collapsible";

function setup() {
  return render(
    <Collapsible preview={<p>预览内容</p>} expandLabel="展开" collapseLabel="收起">
      <p>展开后的内容</p>
    </Collapsible>,
  );
}

describe("Collapsible（可访问的展开/收起）", () => {
  it("默认收起：aria-expanded=false，展开内容不渲染", () => {
    setup();
    const btn = screen.getByRole("button", { name: /展开/ });
    expect(btn).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("预览内容")).toBeInTheDocument();
    expect(screen.queryByText("展开后的内容")).toBeNull();
  });

  it("点击后展开：aria-expanded=true 且渲染内容", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /展开/ }));
    expect(screen.getByRole("button", { name: /收起/ })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByText("展开后的内容")).toBeInTheDocument();
  });

  it("再次点击收起", () => {
    setup();
    const btn = screen.getByRole("button");
    fireEvent.click(btn);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("button", { name: /展开/ })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.queryByText("展开后的内容")).toBeNull();
  });

  it("按钮 type=button，避免意外提交表单", () => {
    setup();
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });
});
