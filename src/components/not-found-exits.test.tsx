// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";

const pathnameRef = { current: "/missing-from-search-engine" } as { current: string | null };

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameRef.current,
}));

import { NotFoundExits } from "./not-found-exits";

const LABELS = { search: "Search courses", home: "Back home", path: "Learning path" };

describe("NotFoundExits（R16.41 最小伤害版）", () => {
  it("locale-less URL：SSR 与客户端都停在默认语言 /en", async () => {
    pathnameRef.current = "/missing-from-search-engine";
    render(<NotFoundExits labels={LABELS} />);
    expect(screen.getByRole("link", { name: /Search courses/ })).toHaveAttribute("href", "/en/search");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.getByRole("link", { name: /Search courses/ })).toHaveAttribute("href", "/en/search");
    expect(screen.getByRole("link", { name: "Back home" })).toHaveAttribute("href", "/en");
    expect(screen.getByRole("link", { name: /Learning path/ })).toHaveAttribute("href", "/en/path");
    cleanup();
  });

  it("/zh 前缀：挂载后三个出口的 href 跟随 URL", async () => {
    pathnameRef.current = "/zh/nope";
    render(<NotFoundExits labels={LABELS} />);
    // jsdom 的 act() 会把挂载 effect 同步跑完，两段式的「先 /en 后 /zh」中间态
    // 在这里观察不到（真实浏览器里首渲染必须与 SSR 一致，那是 not-found-exits.tsx
    // 注释里的事）——用户可感的结果是 href 落在 URL 自己的语言上。
    await waitFor(() =>
      expect(screen.getByRole("link", { name: /Search courses/ })).toHaveAttribute("href", "/zh/search"),
    );
    expect(screen.getByRole("link", { name: "Back home" })).toHaveAttribute("href", "/zh");
    expect(screen.getByRole("link", { name: /Learning path/ })).toHaveAttribute("href", "/zh/path");
    cleanup();
  });

  it("三个出口都在 data-testid 容器外层由页面提供——这里只验标签来自传入字典", () => {
    pathnameRef.current = null;
    render(<NotFoundExits labels={{ search: "搜索课程", home: "返回首页", path: "学习路线" }} />);
    expect(screen.getByRole("link", { name: /搜索课程/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "返回首页" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /学习路线/ })).toBeInTheDocument();
    cleanup();
  });
});
