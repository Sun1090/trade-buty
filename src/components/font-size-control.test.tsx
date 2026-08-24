// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FontSizeControl } from "./font-size-control";

describe("FontSizeControl", () => {
  it("渲染 A- 和 A+ 按钮", () => {
    render(<FontSizeControl labels={{ smaller: "缩小", larger: "放大" }} />);
    expect(screen.getByText("A-")).toBeInTheDocument();
    expect(screen.getByText("A+")).toBeInTheDocument();
  });

  it("点击 A+ 不崩溃", () => {
    const { container } = render(<FontSizeControl labels={{ smaller: "缩小", larger: "放大" }} />);
    const btns = container.querySelectorAll("button");
    fireEvent.click(btns[1]); // A+
    fireEvent.click(btns[1]);
    expect(btns[1]).toBeInTheDocument();
  });

  it("点击 A- 不崩溃", () => {
    const { container } = render(<FontSizeControl labels={{ smaller: "缩小", larger: "放大" }} />);
    const btns = container.querySelectorAll("button");
    fireEvent.click(btns[0]); // A-
    expect(btns[0]).toBeInTheDocument();
  });
});
