// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeToggle } from "./theme-toggle";

function clickToggle() {
  fireEvent.click(screen.getByRole("button"));
}

beforeEach(() => {
  delete document.documentElement.dataset.theme;
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ThemeToggle", () => {
  it("渲染按钮", () => {
    render(<ThemeToggle label="切换主题" />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("可访问名称来自传入文案（zh 用户不该听到英文）", () => {
    render(<ThemeToggle label="切换主题" />);
    expect(screen.getByRole("button", { name: "切换主题" })).toBeInTheDocument();
  });

  it("默认（未设主题）点击切到 light，并写入 localStorage", () => {
    render(<ThemeToggle label="切换主题" />);
    clickToggle();
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem("tb-theme")).toBe("light");
  });

  it("light 主题点击切到 dark 并持久化", () => {
    document.documentElement.dataset.theme = "light";
    render(<ThemeToggle label="切换主题" />);
    clickToggle();
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("tb-theme")).toBe("dark");
  });

  it("dark 主题点击切回 light", () => {
    document.documentElement.dataset.theme = "dark";
    render(<ThemeToggle label="切换主题" />);
    clickToggle();
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem("tb-theme")).toBe("light");
  });

  it("连续点击在两个主题间往返", () => {
    document.documentElement.dataset.theme = "light";
    render(<ThemeToggle label="切换主题" />);
    clickToggle();
    clickToggle();
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("localStorage 抛错时静默降级但仍切主题", () => {
    document.documentElement.dataset.theme = "light";
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });
    render(<ThemeToggle label="切换主题" />);
    expect(() => clickToggle()).not.toThrow();
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});
