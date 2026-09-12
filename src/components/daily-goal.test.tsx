// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

let mockGoal = 15;
let mockMinutes = 0;
let mockBroken = false;
let mockLongest = 0;

vi.mock("@/lib/daily-goal", () => ({
  GOAL_TIERS: [5, 15, 30],
  getDailyGoalMin: () => mockGoal,
  getTodayStudyMinutes: () => mockMinutes,
  setDailyGoalMin: vi.fn(),
}));
vi.mock("@/lib/streak", () => ({
  getStreakBreak: () => ({ broken: mockBroken, longest: mockLongest }),
}));

import { DailyGoal } from "./daily-goal";
import { setDailyGoalMin } from "@/lib/daily-goal";

const dict = {
  label: "今日目标",
  unit: "分钟",
  set: "目标",
  reassureTpl: "已连续 {n} 天，今天可以重新开始。",
};

beforeEach(() => {
  mockGoal = 15;
  mockMinutes = 0;
  mockBroken = false;
  mockLongest = 0;
  vi.mocked(setDailyGoalMin).mockClear();
});

describe("DailyGoal（R4.1–R4.4）", () => {
  it("按 今日分钟/目标 计算百分比", () => {
    mockGoal = 30;
    mockMinutes = 15;
    render(<DailyGoal dict={dict} />);
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "50");
  });

  it("未达成目标不显示庆祝标记", () => {
    mockMinutes = 5;
    mockGoal = 15;
    render(<DailyGoal dict={dict} />);
    expect(screen.getByText("33%")).toBeInTheDocument();
    expect(screen.queryByText("🎉")).toBeNull();
  });

  it("达成目标显示庆祝标记与 100%", () => {
    mockMinutes = 15;
    mockGoal = 15;
    render(<DailyGoal dict={dict} />);
    expect(screen.getByText(/100%/)).toBeInTheDocument();
    expect(screen.getByText("🎉")).toBeInTheDocument();
  });

  it("超过目标百分比封顶 100", () => {
    mockMinutes = 90;
    mockGoal = 15;
    render(<DailyGoal dict={dict} />);
    expect(screen.getByText(/100%/)).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  });

  it("切换档位调用 setDailyGoalMin", () => {
    render(<DailyGoal dict={dict} />);
    fireEvent.click(screen.getByText("5 分钟"));
    expect(setDailyGoalMin).toHaveBeenCalledWith(5);
  });

  it("断签且未达成时显示挽回提示，代入最长连续天数", () => {
    mockBroken = true;
    mockLongest = 7;
    mockMinutes = 0;
    render(<DailyGoal dict={dict} />);
    expect(screen.getByText(/已连续 7 天/)).toBeInTheDocument();
  });

  it("已达成时不显示断签提示", () => {
    mockBroken = true;
    mockLongest = 7;
    mockMinutes = 15;
    render(<DailyGoal dict={dict} />);
    expect(screen.queryByText(/已连续 7 天/)).toBeNull();
  });
});
