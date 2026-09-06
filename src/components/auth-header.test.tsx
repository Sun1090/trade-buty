// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AuthHeader } from "./auth-header";

const { mockUseAuth } = vi.hoisted(() => ({
  mockUseAuth: vi.fn<() => { id: string; email: string } | null>(() => null),
}));
vi.mock("@/components/auth-provider", () => ({
  useAuth: mockUseAuth,
}));
vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowser: () => ({ auth: { signOut: vi.fn() } }),
}));

// next/navigation 在 jsdom 里 usePathname 默认返回 "/"——单独 mock 控制
let mockPathname = "/en/replay";
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: mockPush }),
}));

function getLoginHref(label: string): string {
  const link = screen.getByText(label).closest("a");
  if (!link) throw new Error(`No <a> found wrapping text "${label}"`);
  return link.getAttribute("href") ?? "";
}

describe("AuthHeader (未登录)", () => {
  it("渲染登录链接", () => {
    mockPathname = "/en/replay";
    render(<AuthHeader locale="zh" dict={{ login: "登录", logout: "退出" }} />);
    expect(screen.getByText("登录")).toBeInTheDocument();
  });

  it("链接指向 auth 页并附带当前路径作 returnTo（en）", () => {
    mockPathname = "/en/replay";
    render(<AuthHeader locale="en" dict={{ login: "Login", logout: "Logout" }} />);
    expect(getLoginHref("Login")).toBe("/en/auth?returnTo=%2Fen%2Freplay");
  });

  it("zh locale 也正确编码 returnTo", () => {
    mockPathname = "/zh/path";
    render(<AuthHeader locale="zh" dict={{ login: "登录", logout: "退出" }} />);
    expect(getLoginHref("登录")).toBe("/zh/auth?returnTo=%2Fzh%2Fpath");
  });

  it("当前已在 auth 页时直链不带 returnTo，避免循环", () => {
    mockPathname = "/zh/auth";
    render(<AuthHeader locale="zh" dict={{ login: "登录", logout: "退出" }} />);
    expect(getLoginHref("登录")).toBe("/zh/auth");
  });

  it("当前已在 auth/callback 页时直链不带 returnTo", () => {
    mockPathname = "/en/auth/callback";
    render(<AuthHeader locale="en" dict={{ login: "Login", logout: "Logout" }} />);
    expect(getLoginHref("Login")).toBe("/en/auth");
  });
});

describe("AuthHeader (已登录注销)", () => {
  it("先进入确认态，取消不会请求删除", async () => {
    mockUseAuth.mockReturnValue({ id: "user-1", email: "u@example.com" });
    render(<AuthHeader locale="zh" dict={{ login: "登录", logout: "退出" }} />);
    fireEvent.click(screen.getByRole("button", { name: /账户/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "注销账号" }));
    expect(screen.getByRole("group", { name: "确认注销" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(screen.queryByRole("group", { name: "确认注销" })).toBeNull();
  });
});
