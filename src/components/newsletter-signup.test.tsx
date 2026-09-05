// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { NewsletterSignup } from "./newsletter-signup";

/**
 * R8.8 NewsletterSignup 单测：邮箱本地保存 + 清除 + 复制（mock clipboard）。
 * jsdom 30 opaque origin → 内存 stub localStorage。
 */

const labels = {
  title: "Newsletter (placeholder)",
  desc: "Email stays in this browser only.",
  placeholder: "your@example.com",
  submit: "Save email (local)",
  saved: "Saved locally ✓ · ",
  change: "Change",
  clear: "Clear",
  copy: "Copy JSON",
  copied: "Copied",
  exportLabel: "Export my subscription record",
};

const memStore: Record<string, string> = {};
const writeText = vi.fn().mockResolvedValue(undefined);

beforeAll(() => {
  const stub: Storage = {
    getItem: (k: string) => (k in memStore ? memStore[k] : null),
    setItem: (k: string, v: string) => { memStore[k] = v; },
    removeItem: (k: string) => { delete memStore[k]; },
    clear: () => { for (const k of Object.keys(memStore)) delete memStore[k]; },
    key: (i: number) => Object.keys(memStore)[i] ?? null,
    get length() { return Object.keys(memStore).length; },
  };
  Object.defineProperty(window, "localStorage", { value: stub, configurable: true, writable: true });
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
    writable: true,
  });
});

beforeEach(() => {
  cleanup();
  localStorage.clear();
  writeText.mockClear();
});

afterEach(() => {
  cleanup();
});

describe("NewsletterSignup", () => {
  it("未保存时显示表单", async () => {
    render(<NewsletterSignup labels={labels} locale="en" />);
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.getByTestId("newsletter-input")).toBeInTheDocument();
    expect(screen.getByTestId("newsletter-submit")).toBeInTheDocument();
    expect(screen.queryByTestId("newsletter-saved")).toBeNull();
  });

  it("保存有效邮箱后切换到已保存视图", async () => {
    render(<NewsletterSignup labels={labels} locale="en" />);
    await new Promise((r) => setTimeout(r, 30));
    fireEvent.change(screen.getByTestId("newsletter-input"), {
      target: { value: "alice@example.com" },
    });
    fireEvent.submit(screen.getByTestId("newsletter-submit").closest("form")!);
    await waitFor(() => {
      expect(screen.getByTestId("newsletter-saved")).toBeInTheDocument();
    });
    expect(screen.getByTestId("newsletter-saved").textContent).toContain("alice@example.com");
  });

  it("无效邮箱不写入并显示错误", async () => {
    render(<NewsletterSignup labels={labels} locale="en" />);
    await new Promise((r) => setTimeout(r, 30));
    fireEvent.change(screen.getByTestId("newsletter-input"), {
      target: { value: "not-an-email" },
    });
    fireEvent.submit(screen.getByTestId("newsletter-submit").closest("form")!);
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.getByRole("alert").textContent).toMatch(/valid email/i);
    expect(localStorage.getItem("tb-newsletter-email")).toBeNull();
  });

  it("点击 Copy 调用 clipboard.writeText", async () => {
    memStore["tb-newsletter-email"] = JSON.stringify({ email: "x@y.z", recordedAt: 1 });
    render(<NewsletterSignup labels={labels} locale="en" />);
    await screen.findByTestId("newsletter-saved");
    fireEvent.click(screen.getByTestId("newsletter-copy"));
    expect(writeText).toHaveBeenCalled();
    const arg = writeText.mock.calls[0][0];
    expect(JSON.parse(arg).email).toBe("x@y.z");
  });

  it("点击 Clear 清除 storage 并切回表单", async () => {
    memStore["tb-newsletter-email"] = JSON.stringify({ email: "x@y.z", recordedAt: 1 });
    render(<NewsletterSignup labels={labels} locale="en" />);
    await screen.findByTestId("newsletter-saved");
    fireEvent.click(screen.getByTestId("newsletter-clear"));
    await waitFor(() => {
      expect(screen.queryByTestId("newsletter-saved")).toBeNull();
    });
    expect(screen.getByTestId("newsletter-input")).toBeInTheDocument();
    expect(localStorage.getItem("tb-newsletter-email")).toBeNull();
  });

  it("已有 storage 时直接显示已保存视图", async () => {
    memStore["tb-newsletter-email"] = JSON.stringify({ email: "bob@x.io", recordedAt: 1 });
    render(<NewsletterSignup labels={labels} locale="en" />);
    await screen.findByTestId("newsletter-saved");
    expect(screen.getByTestId("newsletter-saved").textContent).toContain("bob@x.io");
  });

  it("zh locale 时显示中文 desc 且 data-locale=zh", async () => {
    const zh = { ...labels, desc: "邮箱仅本机保存" };
    render(<NewsletterSignup labels={zh} locale="zh" />);
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.getByTestId("newsletter-signup").getAttribute("data-locale")).toBe("zh");
    expect(screen.getByText("邮箱仅本机保存")).toBeInTheDocument();
  });
});
