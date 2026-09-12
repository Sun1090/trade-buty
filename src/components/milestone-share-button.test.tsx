// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MilestoneShareButton } from "./milestone-share-button";

vi.mock("@/lib/growth-events", () => ({ trackGrowthEvent: vi.fn() }));
import { trackGrowthEvent } from "@/lib/growth-events";

const growthTrack = vi.mocked(trackGrowthEvent);

const labels = {
  title: "学习里程碑",
  button: "分享里程碑",
  copied: "已复制分享文案",
  copyFailed: "复制失败，请手动复制链接",
  empty: "完成第一课即可分享里程碑",
  textTpl: "我已读完 {read}/{total} 篇课程，完成 {done}/{chapters} 个篇章。",
};

const stats = {
  readDocs: 10,
  totalDocs: 173,
  doneChapters: 1,
  totalChapters: 27,
  currentStreak: 7,
};

function renderButton() {
  return render(<MilestoneShareButton stats={stats} locale="zh" labels={labels} />);
}

function stubShare(impl: () => Promise<void>) {
  Object.defineProperty(navigator, "share", {
    value: vi.fn(impl),
    configurable: true,
    writable: true,
  });
  return vi.mocked(navigator.share);
}

function stubClipboard(impl: () => Promise<void>) {
  const writeText = vi.fn(impl);
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
    writable: true,
  });
  return writeText;
}

describe("MilestoneShareButton", () => {
  beforeEach(() => {
    growthTrack.mockClear();
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true, writable: true });
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true, writable: true });
    document.execCommand = vi.fn(() => false) as unknown as typeof document.execCommand;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("没有达成任何里程碑时不渲染", () => {
    render(
      <MilestoneShareButton
        stats={{ ...stats, readDocs: 0, doneChapters: 0, currentStreak: 0 }}
        locale="zh"
        labels={labels}
      />,
    );
    expect(screen.queryByTestId("milestone-share")).not.toBeInTheDocument();
    expect(growthTrack).not.toHaveBeenCalled();
  });

  it("优先使用系统分享面板，成功时不写剪贴板", async () => {
    const share = stubShare(async () => {});
    const writeText = stubClipboard(async () => {});
    renderButton();

    fireEvent.click(screen.getByTestId("milestone-share-btn"));

    await waitFor(() => {
      expect(share).toHaveBeenCalledWith({
        title: labels.title,
        text: "我已读完 10/173 篇课程，完成 1/27 个篇章。",
        url: `${window.location.origin}/zh/path`,
      });
      expect(growthTrack).toHaveBeenCalledWith({
        name: "milestone_share",
        locale: "zh",
        channel: "web-share",
        outcome: "succeeded",
      });
    });
    expect(writeText).not.toHaveBeenCalled();
  });

  it("用户取消系统分享面板时不复制、不记录失败", async () => {
    const abort = new Error("user cancelled");
    abort.name = "AbortError";
    const share = stubShare(async () => {
      throw abort;
    });
    const writeText = stubClipboard(async () => {});
    renderButton();

    fireEvent.click(screen.getByTestId("milestone-share-btn"));

    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    expect(writeText).not.toHaveBeenCalled();
    expect(growthTrack).not.toHaveBeenCalled();
  });

  it("系统分享失败后降级到剪贴板并分别记录结果", async () => {
    const share = stubShare(async () => {
      throw new Error("share unsupported at runtime");
    });
    const writeText = stubClipboard(async () => {});
    renderButton();

    fireEvent.click(screen.getByTestId("milestone-share-btn"));

    await waitFor(() => {
      expect(share).toHaveBeenCalledTimes(1);
      expect(writeText).toHaveBeenCalledWith(
        "我已读完 10/173 篇课程，完成 1/27 个篇章。 " + `${window.location.origin}/zh/path`,
      );
      expect(screen.getByText(labels.copied)).toBeInTheDocument();
    });
    expect(growthTrack).toHaveBeenNthCalledWith(1, {
      name: "milestone_share",
      locale: "zh",
      channel: "web-share",
      outcome: "failed",
    });
    expect(growthTrack).toHaveBeenNthCalledWith(2, {
      name: "milestone_share",
      locale: "zh",
      channel: "clipboard",
      outcome: "succeeded",
    });
  });

  it("剪贴板两条路径都失败时显示错误并记录失败", async () => {
    const writeText = stubClipboard(async () => {
      throw new Error("clipboard denied");
    });
    document.execCommand = vi.fn(() => false) as unknown as typeof document.execCommand;
    renderButton();

    fireEvent.click(screen.getByTestId("milestone-share-btn"));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("alert")).toHaveTextContent(labels.copyFailed);
      expect(growthTrack).toHaveBeenCalledWith({
        name: "milestone_share",
        locale: "zh",
        channel: "clipboard",
        outcome: "failed",
      });
    });
  });
});
