// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InstallPrompt } from "./install-prompt";
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

const labels = {
  title: "Install Trade Buty",
  body: "Add it to this device when your browser allows it.",
  install: "Install",
  dismiss: "Not now",
};

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
