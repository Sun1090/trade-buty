// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

let history: Array<{ at: number; total: number; correct: number }> = [];
vi.mock("@/lib/replay-store", () => ({
  readReplayHistory: () => history,
}));

import { ReplayTrend } from "./replay-trend";

beforeEach(() => {
  history = [];
});

describe("ReplayTrend（R12.5）", () => {
  it("少于两轮时显示空状态文案", () => {
    history = [{ at: 1, total: 10, correct: 5 }];
    render(<ReplayTrend label="趋势" emptyLabel="暂无足够数据" />);
    expect(screen.getByText("暂无足够数据")).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("至少两轮时渲染带 aria-label 的折线图", () => {
    history = [
      { at: 1, total: 10, correct: 3 },
      { at: 2, total: 10, correct: 8 },
    ];
    render(<ReplayTrend label="准确率趋势" emptyLabel="空" />);
    expect(screen.getByRole("img", { name: "准确率趋势" })).toBeInTheDocument();
  });

  it("total 为 0 的记录按 0% 处理而不产生 NaN", () => {
    history = [
      { at: 1, total: 0, correct: 0 },
      { at: 2, total: 4, correct: 4 },
    ];
    render(<ReplayTrend label="趋势" emptyLabel="空" />);
    const circles = screen.getByRole("img").querySelectorAll("circle");
    expect(circles.length).toBe(2);
  });

  it("只取最近 20 轮", () => {
    history = Array.from({ length: 25 }, (_, i) => ({
      at: i,
      total: 10,
      correct: i % 10,
    }));
    render(<ReplayTrend label="趋势" emptyLabel="空" />);
    const circles = screen.getByRole("img").querySelectorAll("circle");
    expect(circles.length).toBe(20);
  });
});
