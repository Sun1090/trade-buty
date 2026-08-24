// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReadingProgress } from "./reading-progress";

describe("ReadingProgress", () => {
  it("渲染进度条 div", () => {
    const { container } = render(<ReadingProgress label="回顶" />);
    expect(container.querySelector(".fixed")).toBeTruthy();
  });

  it("初始不显示回顶按钮（scrollY < 800）", () => {
    const { container } = render(<ReadingProgress label="回顶" />);
    // 按钮 fixed bottom，初始 showTop=false 不渲染
    const btns = container.querySelectorAll("button");
    expect(btns.length).toBe(0);
  });
});
