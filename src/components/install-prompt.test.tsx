// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InstallPrompt } from "./install-prompt";
import { getDict } from "@/lib/i18n";
import {
  INSTALL_PROMPT_DISMISSED_KEY,
} from "@/lib/install-prompt";

const values = new Map<string, string>();
const storage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => {
    values.set(key, value);
  },
  removeItem: (key: string) => {
    values.delete(key);
  },
  clear: () => values.clear(),
  key: (index: number) => Array.from(values.keys())[index] ?? null,
  get length() {
    return values.size;
  },
};

Object.defineProperty(globalThis, "localStorage", {
  value: storage,
  configurable: true,
  writable: true,
});

const labels = getDict("en").install;

function dispatchInstallPrompt(
  outcome: "accepted" | "dismissed" = "accepted"
) {
  const prompt = vi.fn().mockResolvedValue(undefined);
  const event = new Event("beforeinstallprompt", { cancelable: true });
  Object.defineProperties(event, {
    prompt: { value: prompt },
    userChoice: {
      value: Promise.resolve({ outcome, platform: "web" }),
    },
  });
  act(() => {
    window.dispatchEvent(event);
  });
  return { event, prompt };
}

describe("InstallPrompt (R13.14)", () => {
  beforeEach(() => {
    values.clear();
    Object.defineProperty(navigator, "standalone", {
      configurable: true,
      value: false,
    });
  });

  afterEach(() => {
    values.clear();
  });

  it("renders nothing until the browser emits beforeinstallprompt", () => {
    render(<InstallPrompt labels={labels} locale="en" />);
    expect(screen.queryByTestId("install-prompt")).toBeNull();
  });

  it("shows the neutral prompt and calls the browser prompt from a click", async () => {
    render(<InstallPrompt labels={labels} locale="en" />);
    const { event, prompt } = dispatchInstallPrompt("accepted");

    const banner = screen.getByTestId("install-prompt");
    expect(banner).toBeInTheDocument();
    expect(event.defaultPrevented).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: labels.install }));
    await waitFor(() => expect(prompt).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.queryByTestId("install-prompt")).toBeNull()
    );
    expect(localStorage.getItem(INSTALL_PROMPT_DISMISSED_KEY)).toBe("1");
  });

  it("persists an explicit dismissal without calling prompt", () => {
    render(<InstallPrompt labels={labels} locale="en" />);
    const { prompt } = dispatchInstallPrompt();

    fireEvent.click(screen.getByRole("button", { name: labels.dismiss }));
    expect(screen.queryByTestId("install-prompt")).toBeNull();
    expect(prompt).not.toHaveBeenCalled();
    expect(localStorage.getItem(INSTALL_PROMPT_DISMISSED_KEY)).toBe("1");
  });

  it("stays silent when previously dismissed", () => {
    localStorage.setItem(INSTALL_PROMPT_DISMISSED_KEY, "1");
    render(<InstallPrompt labels={labels} locale="en" />);
    dispatchInstallPrompt();
    expect(screen.queryByTestId("install-prompt")).toBeNull();
  });

  it("stays silent in standalone mode", () => {
    Object.defineProperty(navigator, "standalone", {
      configurable: true,
      value: true,
    });
    render(<InstallPrompt labels={labels} locale="en" />);
    dispatchInstallPrompt();
    expect(screen.queryByTestId("install-prompt")).toBeNull();
  });

  it("does not render for an unsupported browser that never emits the event", () => {
    const { container } = render(
      <InstallPrompt labels={labels} locale="zh" />
    );
    expect(container.firstChild).toBeNull();
  });

  it("ignores malformed events without prompt/userChoice", () => {
    render(<InstallPrompt labels={labels} locale="en" />);
    act(() => {
      window.dispatchEvent(new Event("beforeinstallprompt", { cancelable: true }));
    });
    expect(screen.queryByTestId("install-prompt")).toBeNull();
  });

  it("cleans up its listeners on unmount", () => {
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const { unmount } = render(<InstallPrompt labels={labels} locale="en" />);
    unmount();
    expect(removeSpy).toHaveBeenCalledWith(
      "beforeinstallprompt",
      expect.any(Function)
    );
    expect(removeSpy).toHaveBeenCalledWith("appinstalled", expect.any(Function));
    removeSpy.mockRestore();
  });
});

/**
 * R16.226：这颗拒绝按钮原来写「暂不 / Not now」，做的却是永久的事——`handleDismiss`
 * 往 `tb-install-prompt-dismissed` 写 `1`，站内没有任何把它改回来的入口（`install-prompt.ts`
 * 只有 read 与 mark 两个方向）。`docs/growth-copy-policy.md` 第 1 条一直写的是「不再重复询问」，
 * 所以对不上的是按钮，不是政策。
 */
describe("安装提示的拒绝按钮说的是永久", () => {
  const PERMANENCE = /不再|don'?t show again|never (show|ask) again/i;
  const DEFERRAL = /暂不|稍后|之后|not now|later/i;

  it("中英两侧都写明永久，不许再写成「一会儿再说」", () => {
    for (const locale of ["zh", "en"] as const) {
      const dismiss = getDict(locale).install.dismiss;
      expect(dismiss, `${locale} 的按钮又在拖延：它其实永久关闭`).not.toMatch(DEFERRAL);
      expect(dismiss, `${locale} 的按钮没说出「不再」这半句`).toMatch(PERMANENCE);
    }
  });

  it("旧文案被抓得住（对照）", () => {
    for (const sample of ["暂不", "Not now"]) {
      expect(DEFERRAL.test(sample), `禁令抓不住旧按钮：${sample}`).toBe(true);
      expect(PERMANENCE.test(sample), `旧文案其实说的是永久？对照失效`).toBe(false);
    }
  });

  it("政策文档点的就是这个字符串，不是另一个名字", () => {
    const policy = readFileSync(
      path.join(process.cwd(), "docs/growth-copy-policy.md"),
      "utf8",
    );
    expect(policy).toContain(`「${getDict("zh").install.dismiss}」`);
  });
});
