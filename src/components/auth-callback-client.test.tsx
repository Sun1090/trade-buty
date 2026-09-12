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
  };
});

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
});
