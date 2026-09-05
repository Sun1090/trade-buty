// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react";
import { OnboardingTour } from "./onboarding-tour";

/**
 * R8.6 OnboardingTour 单测。
 * jsdom 30 opaque origin → 内存 stub localStorage。
 */

const labels = {
  title: "Three steps",
  steps: {
    path: { title: "Step 1", body: "Path body", cta: "See path" },
    replay: { title: "Step 2", body: "Replay body", cta: "Start replay" },
    review: { title: "Step 3", body: "Review body", cta: "Go review" },
  },
  next: "Next",
  skip: "Skip",
  finish: "Start learning",
  restart: "Show again",
};

const memStore: Record<string, string> = {};

beforeAll(() => {
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

beforeEach(() => {
  cleanup();
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("OnboardingTour", () => {
  it("未写过 storage 时默认显示第一步", async () => {
    render(<OnboardingTour labels={labels} locale="en" />);
    // 给 effect 一个 tick
    await new Promise((r) => setTimeout(r, 50));
    const dlg = screen.getByTestId("onboarding-tour");
    expect(dlg.getAttribute("data-step")).toBe("path");
    expect(dlg.textContent).toContain("Step 1");
    expect(dlg.textContent).toContain("Path body");
  });

  it("点击 Next 从 path 推进到 replay", async () => {
    render(<OnboardingTour labels={labels} locale="en" />);
    await new Promise((r) => setTimeout(r, 50));
    const dlg = screen.getByTestId("onboarding-tour");
    fireEvent.click(within(dlg).getByTestId("onboarding-next"));
    await waitFor(() => {
      expect(dlg.getAttribute("data-step")).toBe("replay");
    });
    expect(dlg.textContent).toContain("Step 2");
  });

  it("点击 Next 三次后引导完成消失", async () => {
    render(<OnboardingTour labels={labels} locale="en" />);
    await new Promise((r) => setTimeout(r, 50));
    const dlg = screen.getByTestId("onboarding-tour");
    fireEvent.click(within(dlg).getByTestId("onboarding-next")); // -> replay
    fireEvent.click(within(dlg).getByTestId("onboarding-next")); // -> review
    fireEvent.click(within(dlg).getByTestId("onboarding-next")); // -> done
    await waitFor(() => {
      expect(screen.queryByTestId("onboarding-tour")).toBeNull();
    });
    expect(localStorage.getItem("tb-onboarded")).toBe("1");
  });

  it("点击 skip 后立即关闭并标记完成", async () => {
    render(<OnboardingTour labels={labels} locale="en" />);
    await new Promise((r) => setTimeout(r, 50));
    const dlg = screen.getByTestId("onboarding-tour");
    fireEvent.click(within(dlg).getByTestId("onboarding-skip"));
    await waitFor(() => {
      expect(screen.queryByTestId("onboarding-tour")).toBeNull();
    });
    expect(localStorage.getItem("tb-onboarded")).toBe("1");
  });

  it("storage 已完成时不显示", async () => {
    localStorage.setItem("tb-onboarded", "1");
    render(<OnboardingTour labels={labels} locale="en" />);
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId("onboarding-tour")).toBeNull();
  });

  it("点击 restart 重置回第一步", async () => {
    render(<OnboardingTour labels={labels} locale="en" />);
    await new Promise((r) => setTimeout(r, 50));
    const dlg = screen.getByTestId("onboarding-tour");
    fireEvent.click(within(dlg).getByTestId("onboarding-restart"));
    expect(dlg.getAttribute("data-step")).toBe("path");
  });

  it("zh locale 时 data-locale=zh 且文案走 zh", async () => {
    const zhLabels = {
      title: "三步",
      steps: {
        path: { title: "第一步", body: "路线", cta: "去看路线" },
        replay: { title: "第二步", body: "回放", cta: "开始回放" },
        review: { title: "第三步", body: "复习", cta: "去复习" },
      },
      next: "下一步",
      skip: "跳过",
      finish: "开始学习",
      restart: "再看一次",
    };
    render(<OnboardingTour labels={zhLabels} locale="zh" />);
    await new Promise((r) => setTimeout(r, 50));
    const dlg = screen.getByTestId("onboarding-tour");
    expect(dlg.getAttribute("data-locale")).toBe("zh");
    expect(dlg.textContent).toContain("第一步");
  });
});
