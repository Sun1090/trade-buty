// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { StreakShareCard } from "./streak-share-card";
vi.mock("@/lib/growth-events", () => ({ trackGrowthEvent: vi.fn() }));
import { trackGrowthEvent } from "@/lib/growth-events";

const growthTrack = vi.mocked(trackGrowthEvent);

/**
 * R8.3 连续学习分享卡组件测试。
 */

function fakeCtx(): CanvasRenderingContext2D {
  return {
    measureText: (t: string) => ({ width: t.length * 12 } as TextMetrics),
    fillRect: () => {},
    fillText: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    strokeRect: () => {},
    save: () => {},
    restore: () => {},
    createLinearGradient: () => ({ addColorStop: () => {} }),
    fillStyle: "",
    strokeStyle: "",
    font: "",
    textAlign: "left",
    textBaseline: "alphabetic",
  } as unknown as CanvasRenderingContext2D;
}

function installCanvasStub() {
  HTMLCanvasElement.prototype.getContext = vi.fn(function () {
    return fakeCtx();
  }) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.toBlob = vi.fn(function (cb: (b: Blob | null) => void) {
    cb(new Blob([new Uint8Array(8)], { type: "image/png" }));
  }) as unknown as typeof HTMLCanvasElement.prototype.toBlob;
  HTMLCanvasElement.prototype.toDataURL = vi.fn(
    () => "data:image/png;base64,AAAA",
  ) as unknown as typeof HTMLCanvasElement.prototype.toDataURL;
}

function installAnchorClickStub() {
  const origCreate = document.createElement.bind(document);
  document.createElement = function (tag: string) {
    const el = origCreate(tag);
    if (tag.toLowerCase() === "a") {
      (el as HTMLAnchorElement).click = () => {};
    }
    return el;
  } as typeof document.createElement;
}

const SEVEN_DAYS = Array.from({ length: 7 }, (_, i) => {
  const date = new Date(Date.now() - (6 - i) * 86400_000);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return { date: `${yyyy}-${mm}-${dd}`, active: i < 5 };
});

describe("StreakShareCard", () => {
  beforeEach(() => {
    cleanup();
    growthTrack.mockClear();
    installCanvasStub();
    installAnchorClickStub();
    if (!("createObjectURL" in URL)) {
      Object.defineProperty(URL, "createObjectURL", { value: () => "blob:fake", configurable: true });
    }
    if (!("revokeObjectURL" in URL)) {
      Object.defineProperty(URL, "revokeObjectURL", { value: () => {}, configurable: true });
    }
  });

  afterEach(() => {
    cleanup();
  });

  it("渲染 Share 与 Preview 按钮", () => {
    render(
      <StreakShareCard
        currentStreak={7}
        longestStreak={14}
        recentDays={SEVEN_DAYS}
        locale="zh"
        labels={{ share: "分享我的连续打卡", preview: "预览卡面", previewAlt: "预览", download: "下载", copyLink: "复制链接", copiedLink: "已复制", copyFailed: "复制失败", downloadFailed: "下载失败", previewFailed: "预览失败" }}
      />,
    );
    expect(screen.getByTestId("streak-share-btn")).toBeInTheDocument();
    const preview = screen.getByTestId("streak-share-preview-btn");
    expect(preview).toBeInTheDocument();
    // 按钮文案来自传入的字典，不是组件里写死的英文
    expect(preview).toHaveTextContent("预览卡面");
    expect(preview).not.toHaveTextContent("Preview");
  });

  it("currentStreak = 0 时按钮禁用", () => {
    render(
      <StreakShareCard
        currentStreak={0}
        longestStreak={3}
        recentDays={SEVEN_DAYS}
        locale="zh"
        labels={{ share: "分享", preview: "预览卡面", previewAlt: "预览", download: "下载", copyLink: "复制链接", copiedLink: "已复制", copyFailed: "复制失败", downloadFailed: "下载失败", previewFailed: "预览失败" }}
      />,
    );
    expect(screen.getByTestId("streak-share-btn")).toBeDisabled();
    expect(screen.getByTestId("streak-share-preview-btn")).toBeDisabled();
  });

  it("点击 Share 触发 canvas 绘制 + 下载", async () => {
    const { container } = render(
      <StreakShareCard
        currentStreak={10}
        longestStreak={20}
        recentDays={SEVEN_DAYS}
        locale="zh"
        labels={{ share: "分享", preview: "预览卡面", previewAlt: "预览", download: "下载", copyLink: "复制链接", copiedLink: "已复制", copyFailed: "复制失败", downloadFailed: "下载失败", previewFailed: "预览失败" }}
      />,
    );
    expect(container.querySelector("canvas")).toBeTruthy();
    fireEvent.click(screen.getByTestId("streak-share-btn"));
    await waitFor(
      () => {
        expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalled();
        expect(growthTrack).toHaveBeenCalledWith({
          name: "share_card_download",
          card: "streak",
          locale: "zh",
          surface: "owner",
          trigger: "share",
          outcome: "succeeded",
        });
      },
      { timeout: 2000 },
    );
  });

  it("点击 Preview 后渲染预览图", async () => {
    const { container } = render(
      <StreakShareCard
        currentStreak={5}
        longestStreak={12}
        recentDays={SEVEN_DAYS}
        locale="zh"
        labels={{ share: "分享", preview: "预览卡面", previewAlt: "连续打卡卡预览", download: "下载", copyLink: "复制链接", copiedLink: "已复制", copyFailed: "复制失败", downloadFailed: "下载失败", previewFailed: "预览失败" }}
      />,
    );
    fireEvent.click(screen.getByTestId("streak-share-preview-btn"));
    await waitFor(
      () => {
        const img = container.querySelector("img");
        expect(img).toBeTruthy();
        expect(img?.getAttribute("alt")).toMatch(/^连续打卡卡预览：/);
        expect(img?.getAttribute("alt")).toContain("已连续 5 天");
        expect(growthTrack).toHaveBeenCalledWith({
          name: "share_preview_opened",
          card: "streak",
          locale: "zh",
        });
      },
      { timeout: 2000 },
    );
  });

  it("下载失败时显示可见错误并上报 failed", async () => {
    HTMLCanvasElement.prototype.toBlob = vi.fn(function (cb: (b: Blob | null) => void) {
      cb(null);
    }) as unknown as typeof HTMLCanvasElement.prototype.toBlob;
    render(
      <StreakShareCard
        currentStreak={9}
        longestStreak={11}
        recentDays={SEVEN_DAYS}
        locale="zh"
        labels={{ share: "分享", preview: "预览卡面", previewAlt: "预览", download: "下载", copyLink: "复制链接", copiedLink: "已复制", copyFailed: "复制失败", downloadFailed: "下载失败", previewFailed: "预览失败" }}
      />,
    );
    fireEvent.click(screen.getByTestId("streak-share-btn"));
    await waitFor(
      () => {
        expect(screen.getByRole("alert")).toHaveTextContent("下载失败");
        expect(growthTrack).toHaveBeenCalledWith({
          name: "share_card_download",
          card: "streak",
          locale: "zh",
          surface: "owner",
          trigger: "share",
          outcome: "failed",
        });
      },
      { timeout: 2000 },
    );
  });

  it("预览失败时显示可见错误", async () => {
    HTMLCanvasElement.prototype.toDataURL = vi.fn(() => {
      throw new Error("tainted canvas");
    }) as unknown as typeof HTMLCanvasElement.prototype.toDataURL;
    const { container } = render(
      <StreakShareCard
        currentStreak={9}
        longestStreak={11}
        recentDays={SEVEN_DAYS}
        locale="zh"
        labels={{ share: "分享", preview: "预览卡面", previewAlt: "预览", download: "下载", copyLink: "复制链接", copiedLink: "已复制", copyFailed: "复制失败", downloadFailed: "下载失败", previewFailed: "预览失败" }}
      />,
    );
    fireEvent.click(screen.getByTestId("streak-share-preview-btn"));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("预览失败"));
    expect(container.querySelector("img")).toBeNull();
  });

  it("预览后再点下载按 preview 触发下载", async () => {
    const { container } = render(
      <StreakShareCard
        currentStreak={4}
        longestStreak={6}
        recentDays={SEVEN_DAYS}
        locale="zh"
        labels={{ share: "分享", preview: "预览卡面", previewAlt: "预览", download: "下载", copyLink: "复制链接", copiedLink: "已复制", copyFailed: "复制失败", downloadFailed: "下载失败", previewFailed: "预览失败" }}
      />,
    );
    fireEvent.click(screen.getByTestId("streak-share-preview-btn"));
    await waitFor(() => expect(container.querySelector("img")).toBeTruthy());

    fireEvent.click(screen.getByText(/⬇ 下载/));
    await waitFor(() =>
      expect(growthTrack).toHaveBeenCalledWith({
        name: "share_card_download",
        card: "streak",
        locale: "zh",
        surface: "owner",
        trigger: "preview",
        outcome: "succeeded",
      }),
    );
  });

  it("传入分享链接时渲染复制按钮并上报复制结果", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    render(
      <StreakShareCard
        currentStreak={3}
        longestStreak={5}
        recentDays={SEVEN_DAYS}
        locale="zh"
        shareUrl="https://example.com/share/streak"
        labels={{ share: "分享", preview: "预览卡面", previewAlt: "预览", download: "下载", copyLink: "复制链接", copiedLink: "已复制", copyFailed: "复制失败", downloadFailed: "下载失败", previewFailed: "预览失败" }}
      />,
    );
    fireEvent.click(screen.getByTestId("streak-share-link-btn"));
    await waitFor(() =>
      expect(growthTrack).toHaveBeenCalledWith({
        name: "share_link_copy",
        card: "streak",
        locale: "zh",
        outcome: "succeeded",
      }),
    );
    expect(writeText).toHaveBeenCalledWith("https://example.com/share/streak");
  });

  it("复制链接失败时上报 failed", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
      configurable: true,
    });
    document.execCommand = vi.fn(() => false);
    render(
      <StreakShareCard
        currentStreak={3}
        longestStreak={5}
        recentDays={SEVEN_DAYS}
        locale="zh"
        shareUrl="https://example.com/share/streak"
        labels={{ share: "分享", preview: "预览卡面", previewAlt: "预览", download: "下载", copyLink: "复制链接", copiedLink: "已复制", copyFailed: "复制失败", downloadFailed: "下载失败", previewFailed: "预览失败" }}
      />,
    );
    fireEvent.click(screen.getByTestId("streak-share-link-btn"));
    await waitFor(() =>
      expect(growthTrack).toHaveBeenCalledWith({
        name: "share_link_copy",
        card: "streak",
        locale: "zh",
        outcome: "failed",
      }),
    );
  });

  it("英文 locale 生成英文 alt 描述", async () => {
    const { container } = render(
      <StreakShareCard
        currentStreak={5}
        longestStreak={12}
        recentDays={SEVEN_DAYS}
        locale="en"
        labels={{ share: "Share", preview: "预览卡面", previewAlt: "Preview", download: "Download", copyLink: "Copy link", copiedLink: "Copied", copyFailed: "复制失败", downloadFailed: "Download failed", previewFailed: "Preview failed" }}
      />,
    );
    fireEvent.click(screen.getByTestId("streak-share-preview-btn"));
    await waitFor(() => expect(container.querySelector("img")).toBeTruthy());
    const alt = container.querySelector("img")?.getAttribute("alt") ?? "";
    expect(alt).toContain("study streak card");
    expect(alt).toContain("5 days in a row");
  });

  it("canvas 无 2D 上下文时跳过绘制但下载仍可用", async () => {
    HTMLCanvasElement.prototype.getContext = vi.fn(
      () => null,
    ) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    render(
      <StreakShareCard
        currentStreak={6}
        longestStreak={8}
        recentDays={SEVEN_DAYS}
        locale="zh"
        labels={{ share: "分享", preview: "预览卡面", previewAlt: "预览", download: "下载", copyLink: "复制链接", copiedLink: "已复制", copyFailed: "复制失败", downloadFailed: "下载失败", previewFailed: "预览失败" }}
      />,
    );
    fireEvent.click(screen.getByTestId("streak-share-btn"));
    await waitFor(
      () =>
        expect(growthTrack).toHaveBeenCalledWith(
          expect.objectContaining({ outcome: "succeeded" }),
        ),
      { timeout: 2000 },
    );
  });

  it("无 2D 上下文时预览静默跳过，分享入口可继续下载", async () => {
    HTMLCanvasElement.prototype.getContext = vi.fn(
      () => null,
    ) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    const { container } = render(
      <StreakShareCard
        currentStreak={6}
        longestStreak={8}
        recentDays={SEVEN_DAYS}
        locale="en"
        labels={{ share: "Share", preview: "预览卡面", previewAlt: "Preview", download: "Download", copyLink: "Copy link", copiedLink: "Copied", copyFailed: "复制失败", downloadFailed: "Download failed", previewFailed: "Preview failed" }}
      />,
    );

    fireEvent.click(screen.getByTestId("streak-share-preview-btn"));
    await Promise.resolve();
    expect(container.querySelector("img")).toBeNull();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("streak-share-btn"));
    await waitFor(
      () =>
        expect(growthTrack).toHaveBeenCalledWith({
          name: "share_card_download",
          card: "streak",
          locale: "en",
          surface: "owner",
          trigger: "share",
          outcome: "succeeded",
        }),
      { timeout: 2000 },
    );
  });

  it("预览失败后重新预览成功会清除可见错误", async () => {
    HTMLCanvasElement.prototype.toDataURL = vi.fn(() => {
      throw new Error("tainted canvas");
    }) as unknown as typeof HTMLCanvasElement.prototype.toDataURL;
    render(
      <StreakShareCard
        currentStreak={9}
        longestStreak={11}
        recentDays={SEVEN_DAYS}
        locale="zh"
        labels={{ share: "分享", preview: "预览卡面", previewAlt: "预览", download: "下载", copyLink: "复制链接", copiedLink: "已复制", copyFailed: "复制失败", downloadFailed: "下载失败", previewFailed: "预览失败" }}
      />,
    );

    fireEvent.click(screen.getByTestId("streak-share-preview-btn"));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("预览失败"));

    installCanvasStub();
    fireEvent.click(screen.getByTestId("streak-share-preview-btn"));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });

  it("重复预览会回收上一张 object URL", async () => {
    const revoke = vi.fn();
    Object.defineProperty(URL, "revokeObjectURL", { value: revoke, configurable: true });
    const { container } = render(
      <StreakShareCard
        currentStreak={7}
        longestStreak={9}
        recentDays={SEVEN_DAYS}
        locale="zh"
        labels={{ share: "分享", preview: "预览卡面", previewAlt: "预览", download: "下载", copyLink: "复制链接", copiedLink: "已复制", copyFailed: "复制失败", downloadFailed: "下载失败", previewFailed: "预览失败" }}
      />,
    );
    fireEvent.click(screen.getByTestId("streak-share-preview-btn"));
    // 必须等到第一张预览真正落进 state，第二次点击才会走回收分支；
    // 之前这里断言 revoke 仍为 0（恒真），负载高时会在 state 更新前点第二下而偶发失败。
    await waitFor(() => expect(container.querySelector("img")).toBeTruthy());
    expect(revoke).toHaveBeenCalledTimes(0);
    fireEvent.click(screen.getByTestId("streak-share-preview-btn"));
    await waitFor(() => expect(revoke).toHaveBeenCalledTimes(1));
    expect(revoke).toHaveBeenCalledWith("data:image/png;base64,AAAA");
  });
});
