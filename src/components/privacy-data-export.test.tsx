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

  it("声称收集范围时点名被剔除的那一类（zh / en 各自都要）", () => {
    // 收集范围的真值在 src/lib/privacy-export.test.ts：`sb-*` 整族不进文件。
    // 这里盯的是卡片有没有把这一件事告诉要点「下载我的数据」的人。
    const { unmount } = render(<PrivacyDataExport locale="zh" />);
    const zh = screen.getByTestId("privacy-data-export").textContent ?? "";
    unmount();
    render(<PrivacyDataExport locale="en" />);
    const en = screen.getByTestId("privacy-data-export").textContent ?? "";

    expect(zh, "仍然声称收集全部条目").toContain("全部条目");
    expect(zh, "被剔掉的那一类必须在同一句里点名").toMatch(/除[^。]*外/);
    expect(zh).toContain("登录会话");
    expect(zh, "文件里带着账户标识，转发前得让人知道").toContain("账户");

    expect(en, "仍然声称收集全部条目").toMatch(/every entry|all .*entries/i);
    expect(en, "被剔掉的那一类必须在同一句里点名").toMatch(/except/i);
    expect(en.toLowerCase()).toMatch(/session|token/);
    expect(en, "文件里带着账户标识，转发前得让人知道").toMatch(/account/i);
  });
});
