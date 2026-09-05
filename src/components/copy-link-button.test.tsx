// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { CopyLinkButton } from "./copy-link-button";

/**
 * R8.4 复制链接按钮单测：
 * - 主路径：navigator.clipboard.writeText 被调用
 * - 降级路径：clipboard 缺失时走 textarea 路径
 * - 失败：两种路径都失败时显示失败文案
 */

function stubClipboard(opts: { ok?: boolean; hasClipboard?: boolean } = {}) {
  const ok = opts.ok ?? true;
  const hasClipboard = opts.hasClipboard ?? true;
  const writeText = hasClipboard
    ? vi.fn(async () => {
        if (!ok) throw new Error("denied");
      })
    : undefined;
  Object.defineProperty(navigator, "clipboard", {
    value: hasClipboard ? { writeText } : undefined,
    configurable: true,
    writable: true,
  });
  return writeText;
}

describe("CopyLinkButton", () => {
  beforeEach(() => {
    cleanup();
    // 默认 execCommand 返回 false（防止残留）
    document.execCommand = vi.fn(() => false) as unknown as typeof document.execCommand;
  });

  afterEach(() => {
    cleanup();
  });

  it("点击调用 navigator.clipboard.writeText", async () => {
    const writeText = stubClipboard({ ok: true });
    render(
      <CopyLinkButton
        url="https://example.com/share/quiz/v1-abc"
        label="复制链接"
        copiedLabel="已复制"
        testId="copy-btn"
      />,
    );
    fireEvent.click(screen.getByTestId("copy-btn"));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("https://example.com/share/quiz/v1-abc");
    });
    // 按钮文案切换成复制成功
    expect(screen.getByTestId("copy-btn").textContent).toContain("已复制");
  });

  it("clipboard 失败时走 execCommand 降级路径", async () => {
    stubClipboard({ ok: false, hasClipboard: true });
    document.execCommand = vi.fn(() => true) as unknown as typeof document.execCommand;
    render(
      <CopyLinkButton
        url="https://example.com/x"
        label="copy"
        copiedLabel="ok"
        testId="copy-btn2"
      />,
    );
    fireEvent.click(screen.getByTestId("copy-btn2"));
    await waitFor(() => {
      expect(document.execCommand).toHaveBeenCalledWith("copy");
    });
    expect(screen.getByTestId("copy-btn2").textContent).toContain("ok");
  });

  it("两条路径都失败时显示失败文案", async () => {
    stubClipboard({ ok: false, hasClipboard: false });
    document.execCommand = vi.fn(() => false) as unknown as typeof document.execCommand;
    render(
      <CopyLinkButton
        url="https://example.com/x"
        label="copy"
        copiedLabel="ok"
        testId="copy-btn3"
      />,
    );
    fireEvent.click(screen.getByTestId("copy-btn3"));
    await waitFor(() => {
      expect(screen.getByTestId("copy-btn3").textContent).toContain("Copy failed");
    });
  });

  it("不传 url 时回退到 window.location.href", async () => {
    const writeText = stubClipboard({ ok: true });
    // jsdom 默认 location.href 是 "http://localhost:3000/"
    render(
      <CopyLinkButton label="copy" copiedLabel="ok" testId="copy-btn4" />,
    );
    fireEvent.click(screen.getByTestId("copy-btn4"));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalled();
    });
  });
});
