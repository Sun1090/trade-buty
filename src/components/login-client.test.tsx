// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { LoginClient } from "./login-client";
import { getDict } from "@/lib/i18n";

// next/navigation: useSearchParams 返回可控 Map
let searchMap = new Map<string, string>();
vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: (k: string) => searchMap.get(k) ?? null,
  }),
}));

// env 判据可控（R16.215）：默认「有云端」，个别用例切成「没配」
const envState = { hasEnv: true };
vi.mock("@/lib/supabase/env", () => ({
  hasSupabaseEnv: () => envState.hasEnv,
}));

// supabase client mock —— 用共享 spy 实例（类型放宽到 any 以接受任意 { error }）
const signInSpy = vi.fn(async (): Promise<{ error: unknown }> => ({ error: null }));
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
  errorRateLimited: "请求过于频繁",
  errorRateLimitedHint: "邮箱服务有冷却",
  errorInvalidEmail: "邮箱格式不对",
  errorNetwork: "网络异常",
  errorUnknown: "未知错误",
  cloudUnavailable: "此部署未启用云端登录",
  cloudUnavailableHint: "这个部署没有配置云端服务",
  cooldownTpl: "请 {sec}s 后再试",
  cooldownButton: "{sec}s 后重发",
  returnToNoticeTpl: "📍 {path}",
  returnToBannerTitle: "登录后回到",
};

beforeEach(() => {
  envState.hasEnv = true;
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

  it("fetch 抛错时归类为网络异常", async () => {
    signInSpy.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<LoginClient dict={dict} locale="zh" />);
    fireEvent.change(screen.getByPlaceholderText("邮箱"), { target: { value: "a@b.com" } });
    fireEvent.click(screen.getByRole("button", { name: "发送链接" }));
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    expect(screen.getByText("网络异常")).toBeInTheDocument();
  });

  it("冷却期内再次提交显示限流提示且不重复请求", async () => {
    const { container } = render(<LoginClient dict={dict} locale="zh" />);
    fireEvent.change(screen.getByPlaceholderText("邮箱"), { target: { value: "a@b.com" } });
    fireEvent.click(screen.getByRole("button", { name: "发送链接" }));
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    expect(signInSpy).toHaveBeenCalledTimes(1);

    // 按钮此时已禁用，直接提交表单走客户端冷却守卫
    const form = container.querySelector("form") as HTMLFormElement;
    fireEvent.submit(form);
    expect(screen.getByText("请求过于频繁")).toBeInTheDocument();
    expect(signInSpy).toHaveBeenCalledTimes(1);
  });

  it("冷却倒计时归零后恢复按钮并清掉限流态", async () => {
    signInSpy.mockResolvedValue({ error: { status: 429, message: "rate limit" } });
    render(<LoginClient dict={dict} locale="zh" />);
    fireEvent.change(screen.getByPlaceholderText("邮箱"), { target: { value: "a@b.com" } });
    fireEvent.click(screen.getByRole("button", { name: "发送链接" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText("请求过于频繁")).toBeInTheDocument();
    expect(screen.getByRole("button")).toBeDisabled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(61_000);
    });
    expect(screen.queryByText("请求过于频繁")).toBeNull();
    const btn = screen.getByRole("button", { name: "发送链接" });
    expect(btn).toBeEnabled();
  });

  it("冷却倒计时未归零时按钮文案持续刷新", async () => {
    render(<LoginClient dict={dict} locale="zh" />);
    fireEvent.change(screen.getByPlaceholderText("邮箱"), { target: { value: "a@b.com" } });
    fireEvent.click(screen.getByRole("button", { name: "发送链接" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    const first = screen.getByRole("button").textContent ?? "";
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    const second = screen.getByRole("button").textContent ?? "";
    expect(first).not.toBe(second);
    expect(second).toMatch(/s 后重发/);
  });
});

/**
 * R16.191：限流那一句不许替一次没有发生的发送作保，也不许把冷却算到邮件服务商头上。
 *
 * 走到 `rate_limited` 有三条路：客户端冷却（`login-client.tsx` 在 `signInWithOtp` **之前**
 * 就 return，这一趟压根没发请求）、服务端 429（这次被拒了，没寄出东西），
 * 以及「任何错误都标记 lastSent」之后再点一次。三条路共同的真相是：这一次没有邮件发出。
 * 而冷却时长是 `OTP_COOLDOWN_MS`（本站的），跟邮件服务商无关。
 *
 * 上面那些用例用的是文件里手抄的夹具文案，守不住线上那句话——这里读真字典渲染。
 */
describe("限流提示说的是本站的节流（真字典，R16.191）", () => {
  for (const locale of ["zh", "en"] as const) {
    it(`${locale}：说清这一趟没发出邮件，冷却是本站的`, async () => {
      const real = getDict(locale).auth;
      signInSpy.mockResolvedValue({ error: { status: 429, message: "rate limit" } });
      render(<LoginClient dict={real} locale={locale} />);
      fireEvent.change(screen.getByPlaceholderText(real.emailPlaceholder), {
        target: { value: "a@b.com" },
      });
      fireEvent.click(screen.getByRole("button", { name: real.sendLink }));
      await act(async () => {
        await vi.runOnlyPendingTimersAsync();
      });

      const banner = screen.getByText(real.errorRateLimited).closest("div");
      const text = banner?.textContent ?? "";
      expect(text, "这句提示得真的挂在限流那块里").toContain(real.errorRateLimitedHint);
      expect(text, "不许宣布一封没寄出去的邮件").not.toMatch(
        /已经发了|已为你发送|我们已经发|already sent|we.?ve sent/i,
      );
      expect(text, "要说清这一次没有发出邮件").toMatch(/没有发出|no email/i);
      expect(text, "冷却是本站的节流，不是邮件服务商的").toMatch(/本站|this site|\bours?\b/i);
    });
  }
});

// R16.215：没有 Supabase env 的部署上，登录链接发不出去（getSupabaseBrowser 直接抛）。
// 这是**永久状态**，不是网络抖动 —— 让人点一次注定失败的按钮、再把「部署没开云端」
// 说成「网络异常，请稍后重试」，是在把配置问题推给用户的网络。
describe("没有配云端 env 的部署（R16.215）", () => {
  it("说清是部署没开云端，并禁用发送按钮", () => {
    envState.hasEnv = false;
    render(<LoginClient dict={dict} locale="zh" />);
    expect(screen.getByText(dict.cloudUnavailable)).toBeInTheDocument();
    expect(screen.getByText(dict.cloudUnavailableHint)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "发送链接" })).toBeDisabled();
  });

  it("不显示「稍后重试」那类把配置问题说成网络问题的文案", () => {
    envState.hasEnv = false;
    render(<LoginClient dict={dict} locale="zh" />);
    expect(screen.queryByText(dict.errorNetwork)).not.toBeInTheDocument();
    expect(screen.queryByText(dict.errorUnknown)).not.toBeInTheDocument();
  });

  it("点按钮不会碰到 supabase（纵深防御：连抛都不抛）", () => {
    envState.hasEnv = false;
    render(<LoginClient dict={dict} locale="zh" />);
    const input = screen.getByPlaceholderText("邮箱");
    fireEvent.change(input, { target: { value: "a@b.com" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);
    expect(signInSpy, "缺 env 时竟然还是发了请求").not.toHaveBeenCalled();
  });

  it("邮箱输入框一并禁用，让人一眼看出这一屏不可用", () => {
    envState.hasEnv = false;
    render(<LoginClient dict={dict} locale="zh" />);
    expect(screen.getByPlaceholderText("邮箱")).toBeDisabled();
  });

  it("有 env 时不显示该提示，按钮照常可点（别把好部署也一起禁了）", async () => {
    render(<LoginClient dict={dict} locale="zh" />);
    expect(screen.queryByText(dict.cloudUnavailable)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "发送链接" })).toBeEnabled();
    const input = screen.getByPlaceholderText("邮箱");
    fireEvent.change(input, { target: { value: "a@b.com" } });
    await act(async () => {
      fireEvent.submit(input.closest("form") as HTMLFormElement);
    });
    expect(signInSpy).toHaveBeenCalledTimes(1);
  });
});
