// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeToggle } from "./theme-toggle";

describe("ThemeToggle", () => {
  it("渲染按钮", () => {
    render(<ThemeToggle />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("有 aria-label", () => {
    render(<ThemeToggle />);
    expect(screen.getAllByLabelText(/theme/i).length).toBeGreaterThan(0);
  });
});
