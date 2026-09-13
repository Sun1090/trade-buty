// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const h = vi.hoisted(() => ({
  pathname: "/en/knowledge/getting-started",
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => h.pathname,
  useRouter: () => ({ push: h.push }),
}));

import { LanguageToggle } from "./language-toggle";

function clickToggle() {
  fireEvent.click(screen.getByRole("button"));
}

function cookieValue() {
  return document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("tb-lang="));
}

beforeEach(() => {
  h.pathname = "/en/knowledge/getting-started";
  h.push.mockReset();
  document.cookie = "tb-lang=;path=/;max-age=0";
});

afterEach(() => {
  document.cookie = "tb-lang=;path=/;max-age=0";
});

describe("LanguageToggle", () => {
  it("渲染切换按钮", () => {
    render(<LanguageToggle />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("在 en 路径显示中文切换标识", () => {
    const { container } = render(<LanguageToggle />);
    expect(container.querySelector("button")?.textContent).toBe("中");
  });

  it("在 zh 路径显示 EN 标识", () => {
    h.pathname = "/zh/knowledge/getting-started";
    const { container } = render(<LanguageToggle />);
    expect(container.querySelector("button")?.textContent).toBe("EN");
  });

  it("有 aria-label", () => {
    render(<LanguageToggle />);
    expect(screen.getAllByLabelText(/language/i).length).toBeGreaterThan(0);
  });

  it("en 页面点击切到同路径的 zh 并写 tb-lang cookie", () => {
    render(<LanguageToggle />);
    clickToggle();
    expect(h.push).toHaveBeenCalledWith("/zh/knowledge/getting-started");
    expect(cookieValue()).toBe("tb-lang=zh");
  });

  it("zh 页面点击切到同路径的 en", () => {
    h.pathname = "/zh/knowledge/getting-started";
    render(<LanguageToggle />);
    clickToggle();
    expect(h.push).toHaveBeenCalledWith("/en/knowledge/getting-started");
    expect(cookieValue()).toBe("tb-lang=en");
  });

  it("locale 根路径（/en）切到 /zh", () => {
    h.pathname = "/en";
    render(<LanguageToggle />);
    clickToggle();
    expect(h.push).toHaveBeenCalledWith("/zh");
    expect(cookieValue()).toBe("tb-lang=zh");
  });

  it("无 locale 前缀时补上目标 locale", () => {
    h.pathname = "/knowledge/getting-started";
    render(<LanguageToggle />);
    clickToggle();
    expect(h.push).toHaveBeenCalledWith("/en/knowledge/getting-started");
    expect(cookieValue()).toBe("tb-lang=en");
  });

  it("pathname 为 null 时回退到根路径并补 locale", () => {
    h.pathname = null as unknown as string;
    render(<LanguageToggle />);
    clickToggle();
    expect(h.push).toHaveBeenCalledWith("/en/");
    expect(cookieValue()).toBe("tb-lang=en");
  });
});
