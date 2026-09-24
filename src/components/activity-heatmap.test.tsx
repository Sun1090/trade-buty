// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  readActivityDates: vi.fn<() => string[]>(() => []),
}));

vi.mock("@/lib/activity-calendar", () => ({
  readActivityDates: mocks.readActivityDates,
}));

import { ActivityHeatmap } from "./activity-heatmap";

beforeEach(() => {
  mocks.readActivityDates.mockReset();
  mocks.readActivityDates.mockReturnValue([]);
});

describe("ActivityHeatmap", () => {
  it("shows the empty state with a path CTA when nothing is recorded", () => {
    render(
      <ActivityHeatmap label="学习活动" emptyLabel="还没有学习记录" locale="zh" />,
    );
    expect(screen.getByTestId("activity-heatmap-empty")).toBeInTheDocument();
    expect(screen.getByText("还没有学习记录")).toBeInTheDocument();
    expect(screen.getByTestId("activity-heatmap-cta")).toHaveAttribute(
      "href",
      "/zh/path",
    );
    expect(screen.getByTestId("activity-heatmap-cta")).toHaveTextContent(
      "去学第一课 →",
    );
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("uses the English CTA copy for the en locale", () => {
    render(
      <ActivityHeatmap label="Activity" emptyLabel="Nothing yet" locale="en" />,
    );
    expect(screen.getByTestId("activity-heatmap-cta")).toHaveAttribute(
      "href",
      "/en/path",
    );
    expect(screen.getByTestId("activity-heatmap-cta")).toHaveTextContent(
      "Start a lesson →",
    );
  });

  it("renders a 26-week grid with the active day highlighted", () => {
    const today = new Date();
    const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    mocks.readActivityDates.mockReturnValue([key]);

    render(
      <ActivityHeatmap label="学习活动" emptyLabel="空" locale="zh" />,
    );
    const svg = screen.getByRole("img", { name: "学习活动" });
    const rects = svg.querySelectorAll("rect");
    expect(rects.length).toBe(26 * 7);
    const active = Array.from(rects).filter(
      (r) => r.getAttribute("fill") === "var(--accent)",
    );
    expect(active.length).toBe(1);
    expect(active[0].querySelector("title")?.textContent).toBe(key);
  });

  /** 相对今天往前挪若干天，落在 26 周窗口内 */
  function recentKey(daysAgo: number): string {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  it("标题只数这张图里点得亮的日子，窗口外的记录单独交代", () => {
    // 2026-01-01 / 02 早于最近 26 周（格子中 0 个会亮），但记录本身还在 365 天的保留里
    mocks.readActivityDates.mockReturnValue(["2026-01-01", "2026-01-02"]);
    render(
      <ActivityHeatmap label="学习活动" emptyLabel="空" locale="zh" />,
    );
    expect(screen.getByText(/学习活动 · 0 天/)).toBeInTheDocument();
    expect(screen.getByTestId("activity-heatmap-earlier")).toHaveTextContent(
      "另有 2 天早于这张图",
    );
  });

  it("图里有记录时不给窗口外的日子重复计数", () => {
    mocks.readActivityDates.mockReturnValue([recentKey(0), recentKey(3), "2026-01-01"]);
    render(
      <ActivityHeatmap label="Activity" emptyLabel="空" locale="en" />,
    );
    expect(screen.getByText(/Activity · 2 days/)).toBeInTheDocument();
    expect(screen.getByTestId("activity-heatmap-earlier")).toHaveTextContent(
      "1 earlier than this chart",
    );
  });

  it("中文界面写「天」，不写 days", () => {
    mocks.readActivityDates.mockReturnValue([recentKey(0)]);
    render(
      <ActivityHeatmap label="学习活动" emptyLabel="空" locale="zh" />,
    );
    expect(screen.getByText(/学习活动 · 1 天/)).toBeInTheDocument();
    expect(screen.queryByText(/days/)).toBeNull();
    expect(screen.queryByTestId("activity-heatmap-earlier")).toBeNull();
  });

  it("英文界面按数量走单复数", () => {
    mocks.readActivityDates.mockReturnValue([recentKey(0)]);
    const { unmount } = render(
      <ActivityHeatmap label="Activity" emptyLabel="空" locale="en" />,
    );
    expect(screen.getByText(/Activity · 1 day\b/)).toBeInTheDocument();
    unmount();

    mocks.readActivityDates.mockReturnValue([recentKey(0), recentKey(1)]);
    render(<ActivityHeatmap label="Activity" emptyLabel="空" locale="en" />);
    expect(screen.getByText(/Activity · 2 days/)).toBeInTheDocument();
  });

  it("refreshes when the streak event fires", () => {
    render(
      <ActivityHeatmap label="学习活动" emptyLabel="还没有记录" locale="zh" />,
    );
    expect(screen.getByTestId("activity-heatmap-empty")).toBeInTheDocument();

    mocks.readActivityDates.mockReturnValue(["2026-01-01"]);
    act(() => {
      window.dispatchEvent(new Event("tb-streak"));
    });
    expect(screen.getByRole("img", { name: "学习活动" })).toBeInTheDocument();
    expect(screen.queryByTestId("activity-heatmap-empty")).toBeNull();
  });

  it("ignores activity outside the 26-week window when counting cells", () => {
    mocks.readActivityDates.mockReturnValue(["2000-01-01"]);
    render(
      <ActivityHeatmap label="学习活动" emptyLabel="空" locale="zh" />,
    );
    const svg = screen.getByRole("img", { name: "学习活动" });
    const active = Array.from(svg.querySelectorAll("rect")).filter(
      (r) => r.getAttribute("fill") === "var(--accent)",
    );
    expect(active.length).toBe(0);
  });
});
