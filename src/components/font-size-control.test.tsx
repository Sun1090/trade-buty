// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FontSizeControl } from "./font-size-control";

describe("FontSizeControl", () => {
  const labels = {
    smaller: "缩小",
    larger: "放大",
    lineHeightIncrease: "增大行距",
    lineHeightDecrease: "减小行距",
  };

  it("渲染 A- 和 A+ 按钮", () => {
    render(<FontSizeControl labels={labels} />);
    expect(screen.getByText("A-")).toBeInTheDocument();
    expect(screen.getByText("A+")).toBeInTheDocument();
  });

  it("可访问名称包含可见文本，满足 WCAG 2.5.3", () => {
    render(<FontSizeControl labels={labels} />);
    expect(screen.getByRole("button", { name: "缩小: A-" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "放大: A+" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "增大行距: ☰+" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "减小行距: ☰-" })).toBeInTheDocument();
  });

  it("点击 A+ 不崩溃", () => {
    const { container } = render(<FontSizeControl labels={labels} />);
    const btns = container.querySelectorAll("button");
    fireEvent.click(btns[1]); // A+
    fireEvent.click(btns[1]);
    expect(btns[1]).toBeInTheDocument();
  });

  it("点击 A- 不崩溃", () => {
    const { container } = render(<FontSizeControl labels={labels} />);
    const btns = container.querySelectorAll("button");
    fireEvent.click(btns[0]); // A-
    expect(btns[0]).toBeInTheDocument();
  });
});
