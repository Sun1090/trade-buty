// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  addReadingTime: vi.fn(),
}));

vi.mock("@/lib/reading-time", () => ({
  addReadingTime: mocks.addReadingTime,
}));

import { ReadingTimeTracker } from "./reading-time-tracker";

let hidden = false;

beforeEach(() => {
  mocks.addReadingTime.mockClear();
  hidden = false;
  Object.defineProperty(document, "hidden", {
    configurable: true,
    get: () => hidden,
  });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ReadingTimeTracker", () => {
  it("accrues five seconds per tick for the current chapter and doc", () => {
    render(<ReadingTimeTracker chapter="risk" doc="sizing" />);
    act(() => {
      vi.advanceTimersByTime(15_000);
    });
    expect(mocks.addReadingTime).toHaveBeenCalledTimes(3);
    expect(mocks.addReadingTime).toHaveBeenCalledWith("risk", "sizing", 5);
  });

  it("pauses accrual while the tab is hidden and resumes when visible", () => {
    render(<ReadingTimeTracker chapter="risk" doc="sizing" />);
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(mocks.addReadingTime).toHaveBeenCalledTimes(1);

    hidden = true;
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
      vi.advanceTimersByTime(10_000);
    });
    expect(mocks.addReadingTime).toHaveBeenCalledTimes(1);

    hidden = false;
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
      vi.advanceTimersByTime(5_000);
    });
    expect(mocks.addReadingTime).toHaveBeenCalledTimes(2);
  });

  // visibilitychange 只在「切换」时触发：在后台标签里挂载（点开链接后没切过去看）时，
  // 事件一次都没来过，缓存式实现会按初始值 false 继续计时，给一篇没人读过的课记学习时长。
  it("在后台标签里挂载时不计时，切到前台才开始", () => {
    hidden = true;
    render(<ReadingTimeTracker chapter="risk" doc="sizing" />);
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(mocks.addReadingTime).not.toHaveBeenCalled();

    hidden = false;
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(mocks.addReadingTime).toHaveBeenCalledTimes(2);
  });

  it("tracks prop changes without resetting the interval", () => {
    const { rerender } = render(<ReadingTimeTracker chapter="risk" doc="a" />);
    rerender(<ReadingTimeTracker chapter="risk" doc="b" />);
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(mocks.addReadingTime).toHaveBeenCalledTimes(1);
    expect(mocks.addReadingTime).toHaveBeenCalledWith("risk", "b", 5);
  });

  it("stops accruing once unmounted", () => {
    const { unmount } = render(<ReadingTimeTracker chapter="risk" doc="a" />);
    unmount();
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(mocks.addReadingTime).not.toHaveBeenCalled();
  });
});
