// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

let current = 0;
let longest = 0;
vi.mock("@/lib/streak", () => ({
  getCurrentStreak: () => current,
  readStreak: () => ({ longest }),
}));

import { StreakBadge } from "./streak-badge";

const labels = { current: "当前", longest: "最长", days: "天" };

beforeEach(() => {
  current = 0;
  longest = 0;
});

describe("StreakBadge", () => {
  it("无任何连续记录时不渲染", () => {
    const { container } = render(<StreakBadge labels={labels} />);
    expect(container.firstChild).toBeNull();
  });

  it("显示当前连续天数", () => {
    current = 3;
    longest = 3;
    render(<StreakBadge labels={labels} />);
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("天")).toBeInTheDocument();
  });

  it("历史最长大于当前时额外显示最长记录", () => {
    current = 1;
    longest = 9;
    render(<StreakBadge labels={labels} />);
    expect(screen.getByText(/最长/)).toBeInTheDocument();
    expect(screen.getByText(/9/)).toBeInTheDocument();
  });

  it("当前已是最长记录时不重复展示最长", () => {
    current = 5;
    longest = 5;
    render(<StreakBadge labels={labels} />);
    expect(screen.queryByText(/最长/)).toBeNull();
  });
});
