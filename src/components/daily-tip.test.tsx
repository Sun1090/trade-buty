// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  getDailyTip: vi.fn<(locale: string) => string>(() => "第一条提示"),
}));

vi.mock("@/lib/tips", () => ({
  getDailyTip: mocks.getDailyTip,
}));

import { DailyTip } from "./daily-tip";

beforeEach(() => {
  mocks.getDailyTip.mockReset();
});

describe("DailyTip", () => {
  it("renders the tip returned for the locale", () => {
    mocks.getDailyTip.mockReturnValue("只用能承受损失的资金");
    render(<DailyTip locale="zh" />);
    expect(screen.getByText("只用能承受损失的资金")).toBeInTheDocument();
    expect(mocks.getDailyTip).toHaveBeenCalledWith("zh");
  });

  it("loads a new tip when refreshed", () => {
    mocks.getDailyTip
      .mockReturnValueOnce("第一条")
      .mockReturnValueOnce("第二条");
    render(<DailyTip locale="en" />);
    expect(screen.getByText("第一条")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next tip" }));
    expect(screen.getByText("第二条")).toBeInTheDocument();
  });
});
