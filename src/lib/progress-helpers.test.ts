// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";

const touchStreak = vi.fn();
vi.mock("./streak", () => ({ touchStreak: () => touchStreak() }));

import { tryDispatchProgressEvent } from "./progress-helpers";

beforeEach(() => {
  touchStreak.mockReset();
});

describe("tryDispatchProgressEvent", () => {
  it("记录连续天数并派发 tb-progress 事件", () => {
    const listener = vi.fn();
    window.addEventListener("tb-progress", listener);
    tryDispatchProgressEvent();
    expect(touchStreak).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener("tb-progress", listener);
  });

  it("内部出错时静默吞掉，不外抛", () => {
    touchStreak.mockImplementation(() => {
      throw new Error("boom");
    });
    expect(() => tryDispatchProgressEvent()).not.toThrow();
  });
});
