// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LanguageToggle } from "./language-toggle";

vi.mock("next/navigation", () => ({
  usePathname: () => "/en/knowledge/getting-started",
  useRouter: () => ({ push: vi.fn() }),
}));

describe("LanguageToggle", () => {
  it("渲染切换按钮", () => {
    render(<LanguageToggle />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("在 en 路径显示中文切换标识", () => {
    const { container } = render(<LanguageToggle />);
    // button 文本应为 "中"
    const btn = container.querySelector("button");
    expect(btn?.textContent).toBe("中");
  });

  it("有 aria-label", () => {
    render(<LanguageToggle />);
    expect(screen.getAllByLabelText(/language/i).length).toBeGreaterThan(0);
  });
});
