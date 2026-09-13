// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { SearchHotkey } from "./search-hotkey";

// R13.9：全局快捷键的真实行为（跳转 + preventDefault + 解绑），
// 用 vi.hoisted 保证 mock 工厂在模块求值前就能拿到稳定的 spy。
const { push, migrateStorage } = vi.hoisted(() => ({
  push: vi.fn(),
  migrateStorage: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("@/lib/storage-migrate", () => ({
  migrateStorage,
}));

function pressKey(init: KeyboardEventInit) {
  const event = new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    ...init,
  });
  window.dispatchEvent(event);
  return event;
}

describe("SearchHotkey", () => {
  beforeEach(() => {
    cleanup();
    push.mockClear();
    migrateStorage.mockClear();
  });

  it("挂载时执行一次本地存储迁移", () => {
    render(<SearchHotkey locale="zh" />);
    expect(migrateStorage).toHaveBeenCalledTimes(1);
  });

  it("⌘K 跳转当前语言搜索页并阻止浏览器默认行为", () => {
    render(<SearchHotkey locale="zh" />);
    const event = pressKey({ key: "k", metaKey: true });
    expect(push).toHaveBeenCalledWith("/zh/search");
    expect(event.defaultPrevented).toBe(true);
  });

  it("Ctrl+K（Windows/Linux）同样跳转", () => {
    render(<SearchHotkey locale="en" />);
    const event = pressKey({ key: "k", ctrlKey: true });
    expect(push).toHaveBeenCalledWith("/en/search");
    expect(event.defaultPrevented).toBe(true);
  });

  it("大写 K 也能识别（不区分大小写）", () => {
    render(<SearchHotkey locale="zh" />);
    pressKey({ key: "K", metaKey: true });
    expect(push).toHaveBeenCalledWith("/zh/search");
  });

  it("无修饰键的 K 不跳转、不吞掉默认行为", () => {
    render(<SearchHotkey locale="zh" />);
    const event = pressKey({ key: "k" });
    expect(push).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it("其他键即使带修饰键也不跳转", () => {
    render(<SearchHotkey locale="zh" />);
    pressKey({ key: "j", metaKey: true });
    pressKey({ key: "Escape", ctrlKey: true });
    expect(push).not.toHaveBeenCalled();
  });

  it("卸载后移除 keydown 监听，不再跳转", () => {
    const { unmount } = render(<SearchHotkey locale="zh" />);
    unmount();
    pressKey({ key: "k", metaKey: true });
    expect(push).not.toHaveBeenCalled();
  });

  it("locale 变化后按新语言路径跳转", () => {
    const { rerender } = render(<SearchHotkey locale="zh" />);
    rerender(<SearchHotkey locale="en" />);
    pressKey({ key: "k", ctrlKey: true });
    expect(push).toHaveBeenCalledWith("/en/search");
    expect(push).toHaveBeenCalledTimes(1);
  });
});
