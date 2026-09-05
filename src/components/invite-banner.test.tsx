// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { InviteBanner } from "./invite-banner";

/**
 * R8.5 InviteBanner 单测：
 * - URL ?ref=xxx 时显示 banner
 * - localStorage 已有 invite 时显示 banner
 * - 用户点击 dismiss 后不再显示
 * - 用户点击 clear 后清除 storage 并隐藏
 *
 * 注：测试用 history.replaceState 改 URL 而不是覆写 window.location.search——
 * jsdom 里 .search 是 non-configurable，覆写会抛 TypeError。
 */

const labels = {
  titleTpl: "Invited by {ref}",
  bodyTpl: "ref is {ref}",
  dismiss: "Got it",
};

const memStore: Record<string, string> = {};

beforeAll(() => {
  // 内存版 localStorage stub（jsdom 30 opaque origin 兜底）
  const stub: Storage = {
    getItem: (k: string) => (k in memStore ? memStore[k] : null),
    setItem: (k: string, v: string) => { memStore[k] = v; },
    removeItem: (k: string) => { delete memStore[k]; },
    clear: () => { for (const k of Object.keys(memStore)) delete memStore[k]; },
    key: (i: number) => Object.keys(memStore)[i] ?? null,
    get length() { return Object.keys(memStore).length; },
  };
  try {
    Object.defineProperty(window, "localStorage", { value: stub, configurable: true, writable: true });
  } catch { /* noop */ }
});

function setSearch(search: string) {
  const qs = search.startsWith("?") ? search : `?${search}`;
  window.history.replaceState(null, "", "/" + qs);
}

beforeEach(() => {
  cleanup();
  localStorage.clear();
  setSearch("");
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  setSearch("");
});

describe("InviteBanner", () => {
  it("URL 上有 ?ref 时显示 banner", async () => {
    setSearch("?ref=alice");
    render(<InviteBanner labels={labels} locale="en" />);
    const banner = await screen.findByTestId("invite-banner");
    expect(banner).toBeInTheDocument();
    expect(banner.textContent).toContain("alice");
  });

  it("URL 没 ref 但 storage 已有 invite 时显示", async () => {
    const future = Date.now() + 60 * 60 * 1000;
    localStorage.setItem(
      "tb-invite-ref",
      JSON.stringify({ ref: "bob", recordedAt: Date.now(), expiresAt: future }),
    );
    render(<InviteBanner labels={labels} locale="en" />);
    const banner = await screen.findByTestId("invite-banner");
    expect(banner.textContent).toContain("bob");
  });

  it("无 URL ref 也无 storage 时不显示", async () => {
    render(<InviteBanner labels={labels} locale="en" />);
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId("invite-banner")).toBeNull();
  });

  it("点击 dismiss 后不再显示且写入 dismissed 标记", async () => {
    setSearch("?ref=carol");
    render(<InviteBanner labels={labels} locale="en" />);
    await screen.findByTestId("invite-banner");
    fireEvent.click(screen.getByTestId("invite-banner-dismiss"));
    await waitFor(() => {
      expect(screen.queryByTestId("invite-banner")).toBeNull();
    });
    expect(localStorage.getItem("tb-invite-dismissed-carol")).toBe("1");
  });

  it("点击 clear 后清掉 storage 并隐藏", async () => {
    setSearch("?ref=dave");
    render(<InviteBanner labels={labels} locale="en" />);
    await screen.findByTestId("invite-banner");
    fireEvent.click(screen.getByTestId("invite-banner-clear"));
    await waitFor(() => {
      expect(screen.queryByTestId("invite-banner")).toBeNull();
    });
    expect(localStorage.getItem("tb-invite-ref")).toBeNull();
  });

  it("zh locale 时 data-locale=zh", async () => {
    setSearch("?ref=eve");
    render(
      <InviteBanner
        labels={{ titleTpl: "邀请 {ref}", bodyTpl: "你被 {ref} 邀请", dismiss: "知道了" }}
        locale="zh"
      />,
    );
    const banner = await screen.findByTestId("invite-banner");
    expect(banner.getAttribute("data-locale")).toBe("zh");
    expect(banner.textContent).toContain("eve");
  });

  it("storage 里的 invite 已过期时不显示", async () => {
    localStorage.setItem(
      "tb-invite-ref",
      JSON.stringify({ ref: "expired", recordedAt: 1, expiresAt: 2 }),
    );
    render(<InviteBanner labels={labels} locale="en" />);
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId("invite-banner")).toBeNull();
    expect(localStorage.getItem("tb-invite-ref")).toBeNull();
  });
});
