// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AuthHeader } from "./auth-header";

const { mockUseAuth, mockSignOut, mockDelete, mockClear } = vi.hoisted(() => ({
  mockUseAuth: vi.fn<() => { id: string; email: string } | null>(() => null),
  mockSignOut: vi.fn(async () => ({ error: null })),
  mockDelete: vi.fn(async () => {}),
  mockClear: vi.fn(),
}));
vi.mock("@/components/auth-provider", () => ({
  useAuth: mockUseAuth,
}));
vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowser: () => ({ auth: { signOut: mockSignOut } }),
}));
vi.mock("@/lib/account-delete", () => ({
  clearLocalAccountData: mockClear,
  requestAccountDeletion: mockDelete,
}));

// next/navigation 在 jsdom 里 usePathname 默认返回 "/"——单独 mock 控制
let mockPathname = "/en/replay";
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: mockPush }),
}));

const dict = { login: "登录", logout: "退出" };

beforeEach(() => {
  mockUseAuth.mockReset();
  mockUseAuth.mockReturnValue(null);
  mockSignOut.mockClear();
  mockDelete.mockReset();
  mockDelete.mockResolvedValue(undefined);
  mockClear.mockClear();
  mockPush.mockClear();
});

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
    expect(screen.getByRole("link", { name: "登录" })).toHaveAttribute("aria-label", "登录");
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

describe("AuthHeader (已登录：账户菜单)", () => {
  const account = { id: "user-1", email: "alice@example.com" };

  function openMenu() {
    render(<AuthHeader locale="zh" dict={dict} />);
    fireEvent.click(screen.getByRole("button", { name: /账户/ }));
  }

  it("展示邮箱首字母头像与邮箱文本", () => {
    mockUseAuth.mockReturnValue(account);
    openMenu();
    expect(screen.getByRole("button", { name: /账户/ })).toHaveTextContent("alice@example.com");
    // 头像取首字母大写
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("邮箱缺失时头像回退为 U", () => {
    mockUseAuth.mockReturnValue({ id: "user-1", email: "" });
    render(<AuthHeader locale="zh" dict={dict} />);
    expect(screen.getByRole("button")).toHaveTextContent("U");
  });

  it("Escape 关闭菜单", () => {
    mockUseAuth.mockReturnValue(account);
    openMenu();
    expect(screen.getByRole("menu")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("点击菜单外部关闭菜单", () => {
    mockUseAuth.mockReturnValue(account);
    openMenu();
    expect(screen.getByRole("menu")).toBeInTheDocument();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("退出登录只结束当前会话", () => {
    mockUseAuth.mockReturnValue(account);
    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "退出登录" }));
    expect(mockSignOut).toHaveBeenCalledWith({ scope: "local" });
    expect(screen.queryByRole("menu")).toBeNull();
  });
});

describe("AuthHeader (注销账号：服务端流程)", () => {
  const account = { id: "user-1", email: "u@example.com" };

  function toConfirm() {
    render(<AuthHeader locale="zh" dict={dict} />);
    fireEvent.click(screen.getByRole("button", { name: /账户/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "注销账号" }));
  }

  it("确认注销成功后清除本地数据并跳转登录页", async () => {
    mockUseAuth.mockReturnValue(account);
    toConfirm();
    fireEvent.click(screen.getByRole("button", { name: "确认注销" }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/zh/auth"));
    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(mockClear).toHaveBeenCalledTimes(1);
  });

  it("注销失败：展示错误、不清理本地数据、不跳转，且可重试", async () => {
    mockUseAuth.mockReturnValue(account);
    mockDelete.mockRejectedValueOnce(new Error("boom"));
    toConfirm();
    fireEvent.click(screen.getByRole("button", { name: "确认注销" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("注销失败，请稍后重试。");
    expect(mockClear).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
    // 失败后从「处理中…」恢复，允许用户重试
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "确认注销" })).not.toBeDisabled(),
    );
  });

  it("注销进行中禁用按钮，避免重复提交", async () => {
    mockUseAuth.mockReturnValue(account);
    let release: () => void = () => {};
    mockDelete.mockImplementationOnce(
      () => new Promise<void>((resolve) => {
        release = () => resolve();
      }),
    );
    toConfirm();
    fireEvent.click(screen.getByRole("button", { name: "确认注销" }));

    expect(screen.getByRole("button", { name: "处理中…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "取消" })).toBeDisabled();

    release();
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/zh/auth"));
  });

  it("en locale 使用英文注销文案与确认区块", () => {
    mockUseAuth.mockReturnValue(account);
    render(<AuthHeader locale="en" dict={{ login: "Login", logout: "Logout" }} />);
    fireEvent.click(screen.getByRole("button", { name: /Account/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete account" }));
    expect(
      screen.getByRole("group", { name: "Confirm account deletion" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete account" })).toBeInTheDocument();
  });
});
