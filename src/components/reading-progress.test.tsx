// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ReadingProgress } from "./reading-progress";

function setViewport({ scrollY, scrollHeight, innerHeight }: { scrollY: number; scrollHeight: number; innerHeight: number }) {
  Object.defineProperty(window, "scrollY", { configurable: true, value: scrollY });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: innerHeight });
  Object.defineProperty(document.documentElement, "scrollHeight", { configurable: true, value: scrollHeight });
}

beforeEach(() => {
  setViewport({ scrollY: 0, scrollHeight: 2000, innerHeight: 1000 });
  vi.stubGlobal("scrollTo", vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("ReadingProgress", () => {
  it("按可滚动距离更新进度条，浅滚动时不显示回顶按钮", () => {
    const { container } = render(<ReadingProgress label="回顶" />);
    const bar = container.querySelector<HTMLElement>("[aria-hidden='true']");
    expect(bar).toHaveStyle({ width: "0%" });

    setViewport({ scrollY: 500, scrollHeight: 2000, innerHeight: 1000 });
    fireEvent.scroll(window);
    expect(bar).toHaveStyle({ width: "50%" });
    expect(screen.queryByRole("button", { name: "回顶" })).not.toBeInTheDocument();
  });

  it("深滚动显示百分比按钮，点击后平滑回顶", () => {
    const { container } = render(<ReadingProgress label="回到顶部" />);
    setViewport({ scrollY: 900, scrollHeight: 2200, innerHeight: 1000 });
    fireEvent.scroll(window);

    const button = screen.getByRole("button", { name: "回到顶部" });
    expect(button).toHaveTextContent("75%");
    expect(button).toHaveAttribute("title", "回到顶部 · 75%");
    expect(container.querySelector<HTMLElement>("[aria-hidden='true']")).toHaveStyle({ width: "75%" });

    fireEvent.click(button);
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  });

  it("异常超出页面的 scrollY 将进度封顶为 100%", () => {
    const { container } = render(<ReadingProgress label="回顶" />);
    setViewport({ scrollY: 5000, scrollHeight: 2000, innerHeight: 1000 });
    fireEvent.scroll(window);
    expect(container.querySelector<HTMLElement>("[aria-hidden='true']")).toHaveStyle({ width: "100%" });
    expect(screen.getByRole("button", { name: "回顶" })).toHaveTextContent("100%");
  });

  it("页面没有可滚动距离时保持 0%", () => {
    setViewport({ scrollY: 900, scrollHeight: 800, innerHeight: 1000 });
    const { container } = render(<ReadingProgress label="回顶" />);
    expect(container.querySelector<HTMLElement>("[aria-hidden='true']")).toHaveStyle({ width: "0%" });
  });

  it("卸载时移除 scroll 监听", () => {
    const remove = vi.spyOn(window, "removeEventListener");
    const { unmount } = render(<ReadingProgress label="回顶" />);
    unmount();
    expect(remove).toHaveBeenCalledWith("scroll", expect.any(Function));
  });
});
