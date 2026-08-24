// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AuthHeader } from "./auth-header";

vi.mock("@/components/auth-provider", () => ({
  useAuth: () => null,
}));
vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowser: () => ({ auth: { signOut: vi.fn() } }),
}));

describe("AuthHeader (未登录)", () => {
  it("渲染登录链接", () => {
    render(<AuthHeader locale="zh" dict={{ login: "登录", logout: "退出" }} />);
    expect(screen.getByText("登录")).toBeInTheDocument();
  });

  it("链接指向 auth 页", () => {
    render(<AuthHeader locale="en" dict={{ login: "Login", logout: "Logout" }} />);
    const link = screen.getByText("Login").closest("a");
    expect(link?.getAttribute("href")).toBe("/en/auth");
  });
});
