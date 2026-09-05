// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { LoginClient } from "./login-client";

// next/navigation: useSearchParams 返回可控 Map
let searchMap = new Map<string, string>();
vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: (k: string) => searchMap.get(k) ?? null,
  }),
}));

// supabase client mock —— 用共享 spy 实例（类型放宽到 any 以接受任意 { error }）
const signInSpy = vi.fn(async (_args?: unknown): Promise<{ error: unknown }> => ({ error: null }));
vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowser: () => ({
    auth: { signInWithOtp: signInSpy },
  }),
}));

const dict = {
  emailPlaceholder: "邮箱",
  sendLink: "发送链接",
  sending: "发送中…",
  sent: "已发送",
  sentHint: "请查收",
  error: "失败",
  errorRateLimited: "请求过于频繁",
  errorRateLimitedHint: "邮箱服务有冷却",
  errorInvalidEmail: "邮箱格式不对",
  errorNetwork: "网络异常",
  errorUnknown: "未知错误",
  cooldownTpl: "请 {sec}s 后再试",
  cooldownButton: "{sec}s 后重发",
  returnToNoticeTpl: "📍 {path}",
  returnToBannerTitle: "登录后回到",
};

beforeEach(() => {
  searchMap = new Map();
  signInSpy.mockReset();
  signInSpy.mockImplementation(async () => ({ error: null }));
  vi.useFakeTimers();
});

afterEach(() => {
  // 1. 卸 React 树（防止 setInterval 持有回调导致 jsdom 拆除后 unhandled error）
  cleanup();
  // 2. flush pending timers（fake timers 仍可能有 pending microtask）
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

describe("LoginClient", () => {
  it("render 表单 + 输入 + 按钮", () => {
    render(<LoginClient dict={dict} locale="zh" />);
    expect(screen.getByPlaceholderText("邮箱")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "发送链接" })).toBeInTheDocument();
  });

  it("无 returnTo 时不显示 banner", () => {
    render(<LoginClient dict={dict} locale="zh" />);
    expect(screen.queryByText("登录后回到")).not.toBeInTheDocument();
  });

  it("带 ?returnTo 时显示 banner", () => {
    searchMap = new Map([["returnTo", "/zh/path"]]);
    render(<LoginClient dict={dict} locale="zh" />);
    expect(screen.getByText("登录后回到")).toBeInTheDocument();
    expect(screen.getByText("📍 /zh/path")).toBeInTheDocument();
  });

  it("非法 returnTo（外部 URL）不显示 banner", () => {
    searchMap = new Map([["returnTo", "https://evil.com"]]);
    render(<LoginClient dict={dict} locale="zh" />);
    expect(screen.queryByText("登录后回到")).not.toBeInTheDocument();
  });

  it("邮箱格式错误不发送请求", () => {
    render(<LoginClient dict={dict} locale="zh" />);
    fireEvent.change(screen.getByPlaceholderText("邮箱"), { target: { value: "not-email" } });
    fireEvent.click(screen.getByRole("button", { name: "发送链接" }));
    expect(signInSpy).not.toHaveBeenCalled();
  });

  it("发送成功显示 sent + 启动冷却", async () => {
    render(<LoginClient dict={dict} locale="zh" />);
    fireEvent.change(screen.getByPlaceholderText("邮箱"), { target: { value: "a@b.com" } });
    fireEvent.click(screen.getByRole("button", { name: "发送链接" }));
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    expect(screen.getByText("已发送")).toBeInTheDocument();
    expect(screen.getByRole("button").textContent).toMatch(/s 后重发/);
  });

  it("限流错误（429）显示 rate-limited 文案 + 启动冷却", async () => {
    signInSpy.mockResolvedValue({ error: { status: 429, message: "rate limit" } });
    render(<LoginClient dict={dict} locale="zh" />);
    fireEvent.change(screen.getByPlaceholderText("邮箱"), { target: { value: "a@b.com" } });
    fireEvent.click(screen.getByRole("button", { name: "发送链接" }));
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    expect(screen.getByText("请求过于频繁")).toBeInTheDocument();
    expect(screen.getByText("邮箱服务有冷却")).toBeInTheDocument();
    expect(screen.getByRole("button").textContent).toMatch(/s 后重发/);
  });

  it("无效邮箱错误（400 + invalid）显示 invalid_email 文案", async () => {
    signInSpy.mockResolvedValue({
      error: { status: 400, code: "email_address_invalid", message: "invalid" },
    });
    render(<LoginClient dict={dict} locale="zh" />);
    fireEvent.change(screen.getByPlaceholderText("邮箱"), { target: { value: "a@b.com" } });
    fireEvent.click(screen.getByRole("button", { name: "发送链接" }));
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    expect(screen.getByText("邮箱格式不对")).toBeInTheDocument();
  });

  it("网络异常（TypeError）显示 network 文案", async () => {
    signInSpy.mockResolvedValue({ error: new TypeError("Failed to fetch") });
    render(<LoginClient dict={dict} locale="zh" />);
    fireEvent.change(screen.getByPlaceholderText("邮箱"), { target: { value: "a@b.com" } });
    fireEvent.click(screen.getByRole("button", { name: "发送链接" }));
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    expect(screen.getByText("网络异常")).toBeInTheDocument();
  });

  it("未知错误显示通用 error 文案", async () => {
    signInSpy.mockResolvedValue({
      error: { status: 500, code: "internal", message: "oops" },
    });
    render(<LoginClient dict={dict} locale="zh" />);
    fireEvent.change(screen.getByPlaceholderText("邮箱"), { target: { value: "a@b.com" } });
    fireEvent.click(screen.getByRole("button", { name: "发送链接" }));
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    expect(screen.getByText("未知错误")).toBeInTheDocument();
  });

  it("冷却期内点按钮不发起新请求", async () => {
    render(<LoginClient dict={dict} locale="zh" />);
    fireEvent.change(screen.getByPlaceholderText("邮箱"), { target: { value: "a@b.com" } });
    fireEvent.click(screen.getByRole("button", { name: "发送链接" }));
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    expect(signInSpy).toHaveBeenCalledTimes(1);
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(signInSpy).toHaveBeenCalledTimes(1);
  });

  it("en locale 也显示英文 banner", () => {
    searchMap = new Map([["returnTo", "/en/path"]]);
    const enDict = {
      ...dict,
      returnToBannerTitle: "After login you'll return to",
      returnToNoticeTpl: "📍 {path}",
    };
    render(<LoginClient dict={enDict} locale="en" />);
    expect(screen.getByText("After login you'll return to")).toBeInTheDocument();
    expect(screen.getByText("📍 /en/path")).toBeInTheDocument();
  });
});
