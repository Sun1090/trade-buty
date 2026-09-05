// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { ReturnNudgeToast } from "./return-nudge-toast";

// jsdom 30 opaque origin → sessionStorage 不可用；挂 mock
const memStore = new Map<string, string>();
Object.defineProperty(globalThis, "sessionStorage", {
  value: {
    getItem: (k: string) => memStore.get(k) ?? null,
    setItem: (k: string, v: string) => memStore.set(k, v),
    removeItem: (k: string) => memStore.delete(k),
    clear: () => memStore.clear(),
  },
  writable: true,
});

beforeEach(() => {
  memStore.clear();
  Object.defineProperty(window, "location", {
    value: { pathname: "/zh/" },
    writable: true,
  });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

function emitNudge() {
  act(() => {
    window.dispatchEvent(new CustomEvent("tb-return-nudge"));
  });
}

describe("ReturnNudgeToast (R9.8)", () => {
  it("默认不渲染", () => {
    const { container } = render(<ReturnNudgeToast />);
    expect(container.firstChild).toBeNull();
  });

  it("收到事件后渲染", () => {
    render(<ReturnNudgeToast />);
    emitNudge();
    expect(screen.getByTestId("return-nudge-toast")).toBeTruthy();
  });

  it("同 session 收到两次事件只渲染一次（sessionStorage 去重）", () => {
    render(<ReturnNudgeToast />);
    emitNudge();
    expect(screen.getByTestId("return-nudge-toast")).toBeTruthy();
    // 关闭
    act(() => {
      fireEvent.click(screen.getByLabelText("dismiss"));
    });
    expect(screen.queryByTestId("return-nudge-toast")).toBeNull();
    // 再次派发——sessionStorage 标记仍在，不渲染
    emitNudge();
    expect(screen.queryByTestId("return-nudge-toast")).toBeNull();
  });

  it("zh 文案：标题含'已 N 天没来'", () => {
    render(<ReturnNudgeToast />);
    emitNudge();
    const text = screen.getByTestId("return-nudge-toast").textContent ?? "";
    expect(text).toMatch(/已\s*\d+\s*天没来/);
  });

  it("en 文案：标题含 'days since'", () => {
    Object.defineProperty(window, "location", {
      value: { pathname: "/en/" },
      writable: true,
    });
    render(<ReturnNudgeToast />);
    emitNudge();
    const text = screen.getByTestId("return-nudge-toast").textContent ?? "";
    expect(text).toMatch(/days since/);
  });

  it("点 '稍后再说' 按钮关闭", () => {
    render(<ReturnNudgeToast />);
    emitNudge();
    const buttons = screen.getAllByRole("button");
    // dismiss (×) / dismiss text / "继续学习" 是 a (不是 button) / "稍后再说" 是 button
    // 找含"稍后"或"Maybe later"的 button
    const later = buttons.find((b) => /稍后再说/.test(b.textContent ?? ""));
    expect(later).toBeTruthy();
    act(() => {
      fireEvent.click(later!);
    });
    expect(screen.queryByTestId("return-nudge-toast")).toBeNull();
  });

  it("点 × 关闭按钮也关闭", () => {
    render(<ReturnNudgeToast />);
    emitNudge();
    act(() => {
      fireEvent.click(screen.getByLabelText("dismiss"));
    });
    expect(screen.queryByTestId("return-nudge-toast")).toBeNull();
  });

  it("unmount 后清理事件监听（不抛错）", () => {
    const { unmount } = render(<ReturnNudgeToast />);
    emitNudge();
    expect(() => unmount()).not.toThrow();
  });
});
