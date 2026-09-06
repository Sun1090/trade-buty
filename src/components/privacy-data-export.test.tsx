// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PrivacyDataExport } from "./privacy-data-export";
import { downloadPrivacyExport } from "@/lib/privacy-export";

vi.mock("@/lib/privacy-export", () => ({
  downloadPrivacyExport: vi.fn(),
}));

beforeEach(() => vi.clearAllMocks());

describe("PrivacyDataExport (R9.9)", () => {
  it("renders the Chinese export action", () => {
    render(<PrivacyDataExport locale="zh" />);
    expect(screen.getByTestId("privacy-export-button").textContent).toContain("下载我的数据");
  });

  it("renders English labels", () => {
    render(<PrivacyDataExport locale="en" />);
    expect(screen.getByTestId("privacy-data-export").textContent).toContain("Export your data");
    expect(screen.getByTestId("privacy-export-button").textContent).toContain("Download my data");
  });

  it("downloads and reports success", () => {
    render(<PrivacyDataExport locale="en" />);
    fireEvent.click(screen.getByTestId("privacy-export-button"));
    expect(downloadPrivacyExport).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status").textContent).toContain("downloaded");
  });

  it("reports a browser download failure", () => {
    vi.mocked(downloadPrivacyExport).mockImplementationOnce(() => {
      throw new Error("no document");
    });
    render(<PrivacyDataExport locale="zh" />);
    fireEvent.click(screen.getByTestId("privacy-export-button"));
    expect(screen.getByRole("alert").textContent).toContain("导出失败");
  });
});
