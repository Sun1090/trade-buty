// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { QuizTimer } from "./quiz-timer";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("QuizTimer", () => {
  it("starts at 00:00", () => {
    render(<QuizTimer running />);
    expect(screen.getByText("00:00")).toBeInTheDocument();
  });

  it("counts up while running", () => {
    render(<QuizTimer running />);
    act(() => {
      vi.advanceTimersByTime(65_000);
    });
    expect(screen.getByText("01:05")).toBeInTheDocument();
  });

  it("resets to 00:00 when paused", () => {
    const { rerender } = render(<QuizTimer running />);
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(screen.getByText("00:05")).toBeInTheDocument();
    rerender(<QuizTimer running={false} />);
    expect(screen.getByText("00:00")).toBeInTheDocument();
  });

  it("stops ticking after unmount", () => {
    const { unmount } = render(<QuizTimer running />);
    unmount();
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("switches to the warning tone after 30 seconds", () => {
    render(<QuizTimer running />);
    act(() => {
      vi.advanceTimersByTime(31_000);
    });
    expect(screen.getByText("00:31").className).toContain("text-down");
  });
});
