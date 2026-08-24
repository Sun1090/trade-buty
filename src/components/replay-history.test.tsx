// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReplayHistory } from "./replay-history";

vi.mock("@/lib/replay-store", () => ({
  readReplayHistory: () => [],
  readReplayBest: () => 0,
}));
vi.mock("@/components/use-local-progress", () => ({
  useLocalProgress: () => null,
}));

describe("ReplayHistory", () => {
  it("空历史显示空态", () => {
    render(<ReplayHistory dict={{
      histTitle: "训练记录", histRounds: "轮", histAccuracy: "准确率",
      histEmpty: "还没有训练记录", histRecent: "最近", histBest: "最佳",
    }} />);
    expect(screen.getByText("还没有训练记录")).toBeInTheDocument();
  });
});
