// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act, fireEvent, cleanup } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { ReturnNudgeToast, RETURN_NUDGE_TOAST_MS } from "./return-nudge-toast";

// jsdom 30 opaque origin → sessionStorage 不可用；挂 mock
const memStore = new Map<string, string>();
const localStore = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: (k: string) => localStore.get(k) ?? null,
    setItem: (k: string, v: string) => localStore.set(k, v),
    removeItem: (k: string) => localStore.delete(k),
    clear: () => localStore.clear(),
    key: (i: number) => Array.from(localStore.keys())[i] ?? null,
    get length() { return localStore.size; },
  },
  writable: true,
});
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
  localStore.clear();
  Object.defineProperty(window, "location", {
    value: { pathname: "/zh/" },
    writable: true,
  });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

/**
 * 派发一次「带着实测天数」的事件。默认值刻意不是 7：`RETURN_NUDGE_INTERVAL_MS` 那个门槛
 * 恰好是 7 天，任何退回常量的实现都能在「断言含数字」的用例里蒙对，所以这里一律用别的数。
 */
function emitNudge(days = 9) {
  act(() => {
    window.dispatchEvent(new CustomEvent("tb-return-nudge", {
      detail: days == null ? undefined : { days },
    }));
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
      fireEvent.click(screen.getByLabelText("关闭"));
    });
    expect(screen.queryByTestId("return-nudge-toast")).toBeNull();
    // 再次派发——sessionStorage 标记仍在，不渲染
    emitNudge();
    expect(screen.queryByTestId("return-nudge-toast")).toBeNull();
  });

  it("使用事件携带的实际未访天数，并记录提示时间", () => {
    render(<ReturnNudgeToast />);
    emitNudge(12);
    const text = screen.getByTestId("return-nudge-toast").textContent ?? "";
    expect(text).toContain("已 12 天没来");
    expect(localStorage.getItem("tb-last-visit-nudge")).toBeTruthy();
  });

  it("zh 文案：标题里的天数就是量出来的那个数", () => {
    render(<ReturnNudgeToast />);
    emitNudge(21);
    const text = screen.getByTestId("return-nudge-toast").textContent ?? "";
    expect(text).toContain("已 21 天没来");
  });

  it("en 文案：标题含 'days since'，天数同样取自事件", () => {
    Object.defineProperty(window, "location", {
      value: { pathname: "/en/" },
      writable: true,
    });
    render(<ReturnNudgeToast />);
    emitNudge(21);
    const text = screen.getByTestId("return-nudge-toast").textContent ?? "";
    expect(text).toMatch(/days since/);
    expect(text).toContain("21");
  });

  /**
   * R16.189：事件错过了（lazy toast 挂载晚于派发）时，屏幕上那个天数只能来自派发方
   * 存进 sessionStorage 的测量值。以前这条路上没有测量值可用——`auth-provider` 在同一拍里
   * 已经把本次访问时间写进台账，重新量一遍只会量出 0，于是代码退回常量 7，
   * 屏幕上「已 7 天没来」说的是一个从没量过的间隔。
   */
  it("事件错过时，天数取自 sessionStorage 里存下的测量值", () => {
    sessionStorage.setItem("tb-return-nudge-pending", "1");
    sessionStorage.setItem("tb-return-nudge-days", "26");
    render(<ReturnNudgeToast />);
    const text = screen.getByTestId("return-nudge-toast").textContent ?? "";
    expect(text).toContain("已 26 天没来");
  });

  it("没有测量值就不弹（不许退回任何一个常数）", () => {
    sessionStorage.setItem("tb-return-nudge-pending", "1");
    const { container } = render(<ReturnNudgeToast />);
    expect(container.firstChild).toBeNull();
    // 走过一次消费就不该再留 pending，否则下一棵树会重复消费
    expect(sessionStorage.getItem("tb-return-nudge-pending")).toBeNull();
  });

  /**
   * R16.188：这一站所有页面都在 `/{locale}` 下，`href="/replay"` 会落进
   * `[locale]="replay"` 直接 404——主按钮点了哪也不去。
   */
  it("「继续学习」跳到带语种前缀的回放页", () => {
    const seen: string[] = [];
    for (const pathname of ["/zh/", "/en/"]) {
      cleanup();
      memStore.clear(); // 同会话去重标记会拦住第二次挂载，逐语种各要一次干净的会话
      Object.defineProperty(window, "location", {
        value: { pathname },
        writable: true,
      });
      render(<ReturnNudgeToast />);
      emitNudge(9);
      seen.push(screen.getByRole("link").getAttribute("href") ?? "");
    }
    expect(seen).toEqual(["/zh/replay", "/en/replay"]);
  });

  /** R16.190：先让那个时长在界面上真实发生，注释与它同源才有意义。 */
  it("停留满 `RETURN_NUDGE_TOAST_MS` 才自己收起", () => {
    render(<ReturnNudgeToast />);
    emitNudge(9);
    expect(screen.getByTestId("return-nudge-toast")).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(RETURN_NUDGE_TOAST_MS - 1);
    });
    expect(screen.getByTestId("return-nudge-toast"), "还没到时长就自己消失了").toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByTestId("return-nudge-toast")).toBeNull();
  });

  /** R16.190：文件头那句「停留多久」必须跟着常量走——改常量的那个人不会想起去改注释。 */
  it("文件头注释里的秒数与停留时长同源", () => {
    const src = readFileSync("src/components/return-nudge-toast.tsx", "utf8");
    const seconds = String(RETURN_NUDGE_TOAST_MS / 1000);
    expect(src, `注释要点出停留 ${seconds} 秒`).toContain(`（${seconds} 秒）`);
    expect(src, "注释里不许再出现自己数出来的秒数").not.toMatch(/\d+\s*秒自动消失/);
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
      fireEvent.click(screen.getByLabelText("关闭"));
    });
    expect(screen.queryByTestId("return-nudge-toast")).toBeNull();
  });

  it("unmount 后清理事件监听（不抛错）", () => {
    const { unmount } = render(<ReturnNudgeToast />);
    emitNudge();
    expect(() => unmount()).not.toThrow();
  });
});
