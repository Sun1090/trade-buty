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

  // R16.210：这一句原本写成「除登录会话外，浏览器本机存储的全部条目都会写入文件」。
  // 那句话的两半都不成立：本站的会话根本不在 localStorage——`createBrowserClient` 自己
  // 明写 "always manages the session via cookies, so the auth.storage option you passed is
  // ignored"（@supabase/ssr）；而「全部条目」把 Cookie 与 sessionStorage 都算进了遍历范围，
  // 实际代码只走 localStorage。所以卡片要说的不是「剔掉了哪一类」，而是「遍历哪一处、不读哪一处」。
  it("说清遍历的是哪一处存储、不读的是哪一处，并点名会话与令牌", () => {
    const { unmount } = render(<PrivacyDataExport locale="zh" />);
    const zh = screen.getByTestId("privacy-data-export").textContent ?? "";
    unmount();
    render(<PrivacyDataExport locale="en" />);
    const en = screen.getByTestId("privacy-data-export").textContent ?? "";

    expect(zh, "要点名被遍历的那个存储").toContain("localStorage");
    expect(zh, "要说不读 Cookie").toMatch(/不读\s*Cookie/);
    expect(zh, "会话所在的那一处要点名").toMatch(/Cookie[^。]*令牌|令牌[^。]*Cookie/);
    expect(zh).toContain("登录会话");
    expect(zh, "文件里带着账户标识，转发前得让人知道").toContain("本机标识");
    // 禁令：不许再无条件声称「全部条目」——那句话把 Cookie/sessionStorage 也算了进来
    expect(zh, "仍然无条件声称收集全部条目").not.toContain("全部条目");

    expect(en.toLowerCase(), "要点名被遍历的那个存储").toContain("local storage");
    expect(en, "要说不读 cookies").toMatch(/does not read cookies/i);
    expect(en.toLowerCase()).toMatch(/access and refresh tokens/);
    expect(en, "文件里带着账户标识").toMatch(/local marker/i);
    expect(en, "仍然无条件声称收集 every entry").not.toMatch(/every entry/i);

    // 正向对照：退役的那两句喂给同一组禁令，必须条条报红
    const legacyZh =
      "下载一份 JSON 格式的数据副本。除登录会话（访问与刷新令牌）外，浏览器本机存储的全部条目都会写入文件。";
    const legacyEn =
      "Every entry in your browser's local storage is written to the file except your sign-in session (its access and refresh tokens).";
    expect(legacyZh, "旧中文句逃过了「全部条目」禁令").toContain("全部条目");
    expect(legacyEn, "旧英文句逃过了 every entry 禁令").toMatch(/every entry/i);
    expect(legacyZh, "旧中文句没说不读 Cookie，对照要成立").not.toMatch(/不读\s*Cookie/);
    expect(legacyEn, "旧英文句没说不读 cookies，对照要成立").not.toMatch(/does not read cookies/i);
  });
});
