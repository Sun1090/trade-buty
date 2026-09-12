// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  getReadingTime: vi.fn(() => 0),
  formatDuration: vi.fn((s: number) => `${s}s`),
}));

vi.mock("@/lib/reading-time", () => ({
  getReadingTime: mocks.getReadingTime,
  formatDuration: mocks.formatDuration,
}));

import { ReadingTimeDisplay } from "./reading-time-display";

beforeEach(() => {
  mocks.getReadingTime.mockReset();
  mocks.getReadingTime.mockReturnValue(0);
  mocks.formatDuration.mockClear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ReadingTimeDisplay", () => {
  it("renders nothing before any time is accrued", () => {
    const { container } = render(
      <ReadingTimeDisplay chapter="risk" doc="sizing" label="已读" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the formatted duration once time exists", () => {
    mocks.getReadingTime.mockReturnValue(125);
    render(<ReadingTimeDisplay chapter="risk" doc="sizing" label="已读" />);
    expect(screen.getByText(/已读 125s/)).toBeInTheDocument();
    expect(mocks.formatDuration).toHaveBeenCalledWith(125);
  });

  it("polls the store every five seconds", () => {
    mocks.getReadingTime.mockReturnValue(0);
    render(<ReadingTimeDisplay chapter="risk" doc="sizing" label="已读" />);
    mocks.getReadingTime.mockReturnValue(42);
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(screen.getByText(/已读 42s/)).toBeInTheDocument();
  });
});
