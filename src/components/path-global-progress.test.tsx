// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ProgressMap } from "@/lib/progress";

const mocks = vi.hoisted(() => ({
  useLocalProgress: vi.fn<() => ProgressMap | null>(() => null),
}));

vi.mock("@/components/use-local-progress", () => ({
  useLocalProgress: mocks.useLocalProgress,
}));

import { PathGlobalProgress } from "./path-global-progress";

const chapters = [
  { slug: "getting-started", docCount: 2 },
  { slug: "spot", docCount: 2 },
];

describe("PathGlobalProgress", () => {
  it("renders a zeroed bar before progress loads", () => {
    mocks.useLocalProgress.mockReturnValue(null);
    render(<PathGlobalProgress chapters={chapters} />);
    expect(screen.getByText("0/4 · 0/2")).toBeInTheDocument();
    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("summarizes read docs and completed chapters", () => {
    mocks.useLocalProgress.mockReturnValue({
      "getting-started": ["a", "b"],
      spot: ["a"],
    } as unknown as ProgressMap);
    render(<PathGlobalProgress chapters={chapters} />);
    expect(screen.getByText("3/4 · 1/2")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
  });

  it("keeps rendering when recorded reads exceed the doc count", () => {
    mocks.useLocalProgress.mockReturnValue({
      "getting-started": ["a", "b", "c"],
      spot: ["a", "b", "c"],
    } as unknown as ProgressMap);
    const { container } = render(<PathGlobalProgress chapters={chapters} />);
    const bar = container.querySelector(".h-full.rounded-full") as HTMLElement;
    expect(screen.getByText("150%")).toBeInTheDocument();
    expect(bar.style.width).toBe("150%");
  });

  it("handles an empty chapter list without dividing by zero", () => {
    mocks.useLocalProgress.mockReturnValue({} as unknown as ProgressMap);
    render(<PathGlobalProgress chapters={[]} />);
    expect(screen.getByText("0/0 · 0/0")).toBeInTheDocument();
    expect(screen.getByText("0%")).toBeInTheDocument();
  });
});
