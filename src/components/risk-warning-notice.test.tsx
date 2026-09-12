// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { RiskWarningNotice } from "./risk-warning-notice";

describe("RiskWarningNotice", () => {
  it("renders a localized Chinese warning", () => {
    render(<RiskWarningNotice locale="zh" />);

    expect(screen.getByRole("note", { name: "⚠️ 风险提示" })).toBeInTheDocument();
    expect(screen.getByText(/不构成任何投资建议/)).toBeInTheDocument();
  });

  it("renders a localized English warning", () => {
    render(<RiskWarningNotice locale="en" />);

    expect(screen.getByRole("note", { name: "⚠️ Risk Warning" })).toBeInTheDocument();
    expect(screen.getByText(/not investment advice/)).toBeInTheDocument();
  });
});
