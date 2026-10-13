// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";

const h = vi.hoisted(() => {
  const state = {
    session: null as { user: { id: string } } | null,
    listeners: [] as ((event: string, session: unknown) => void)[],
  };
  return {
    state,
    push: vi.fn(),
    router: { push: vi.fn() },
    unsubscribe: vi.fn(),
    rawReturn: null as string | null,
    normalized: "/zh/path" as string | null,
    // R16.334：这一页现在先问 `hasSupabaseEnv()` 再碰客户端。既有六条测的是「云端已配置」
    // 那条路，所以默认给 true——否则它们会全部走进降级分支，而「四秒超时」那条
    // 会以错误的理由通过（守卫直接置 error，超时逻辑根本没跑）。
    cloudConfigured: true,
  };
});

vi.mock("@/lib/supabase/env", () => ({
  hasSupabaseEnv: () => h.cloudConfigured,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => h.router,
  useSearchParams: () => ({ get: () => h.rawReturn }),
}));
vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowser: () => ({
    auth: {
      getSession: async () => ({ data: { session: h.state.session } }),
      onAuthStateChange: (callback: (event: string, session: unknown) => void) => {
        h.state.listeners.push(callback);
        return { data: { subscription: { unsubscribe: h.unsubscribe } } };
      },
    },
  }),
}));
vi.mock("@/lib/auth-return", () => ({
  normalizeReturnTo: () => h.normalized,
}));

import { AuthCallbackClient } from "./auth-callback-client";

const dict = {
  callbackProcessing: "正在完成登录…",
  callbackSuccess: "登录成功，正在跳转",
  callbackError: "登录链接已失效",
};

beforeEach(() => {
  vi.useFakeTimers();
  h.state.session = null;
  h.state.listeners = [];
  h.push.mockClear();
  h.router = { push: h.push };
  h.unsubscribe.mockClear();
  h.rawReturn = null;
  h.normalized = "/zh/path";
  h.cloudConfigured = true;
});

afterEach(() => {
  vi.useRealTimers();
});

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe("AuthCallbackClient", () => {
  it("shows the processing state while waiting for a session", async () => {
    render(<AuthCallbackClient dict={dict} locale="zh" />);
    expect(screen.getByText("正在完成登录…")).toBeInTheDocument();
    await flush();
    expect(screen.getByText("正在完成登录…")).toBeInTheDocument();
  });

  it("shows success and navigates to the normalized return path", async () => {
    h.state.session = { user: { id: "u1" } };
    render(<AuthCallbackClient dict={dict} locale="zh" />);
    await flush();
    expect(screen.getByText("登录成功，正在跳转")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(h.push).toHaveBeenCalledWith("/zh/path");
  });

  it("treats a SIGNED_IN event as success", async () => {
    render(<AuthCallbackClient dict={dict} locale="en" />);
    await flush();
    act(() => {
      for (const listener of h.state.listeners) {
        listener("SIGNED_IN", { user: { id: "u2" } });
      }
    });
    expect(screen.getByText("登录成功，正在跳转")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(h.push).toHaveBeenCalledWith("/zh/path");
  });

  it("falls back to the locale home when there is no return target", async () => {
    h.normalized = null;
    h.state.session = { user: { id: "u3" } };
    render(<AuthCallbackClient dict={dict} locale="en" />);
    await flush();
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(h.push).toHaveBeenCalledWith("/en");
  });

  it("reports an error after the four-second timeout", async () => {
    render(<AuthCallbackClient dict={dict} locale="zh" />);
    await flush();
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.getByText("登录链接已失效")).toBeInTheDocument();
  });

  it("does not navigate after unmount", async () => {
    h.state.session = { user: { id: "u4" } };
    const { unmount } = render(<AuthCallbackClient dict={dict} locale="zh" />);
    await flush();
    unmount();
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(h.push).not.toHaveBeenCalled();
    expect(h.unsubscribe).toHaveBeenCalledTimes(1);
  });

  /**
   * R16.334：部署没配 Supabase env 时，这一页要显示自己写好的「登录失败」，
   * 而不是让 effect 抛出、把整页变成错误页。CI 的 `e2e` job 正是这种环境
   * （带 env 的是 `auth-e2e`），所以这条以前只在 CI 红。
   */
  it("degrades to the page's own error state when the cloud is not configured", async () => {
    h.cloudConfigured = false;
    render(<AuthCallbackClient dict={dict} locale="zh" />);
    await flush();
    expect(screen.getByText("登录链接已失效")).toBeInTheDocument();
    // 关键判据：没配云端时**一个订阅都不该挂上**，也不该有跳转
    expect(h.state.listeners).toEqual([]);
    expect(h.push).not.toHaveBeenCalled();
    expect(h.unsubscribe).not.toHaveBeenCalled();
  });
});
