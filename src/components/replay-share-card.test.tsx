// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { ReplayShareCard } from "./replay-share-card";
vi.mock("@/lib/growth-events", () => ({ trackGrowthEvent: vi.fn() }));
import { trackGrowthEvent } from "@/lib/growth-events";

const growthTrack = vi.mocked(trackGrowthEvent);

/**
 * R8.2 回放战绩分享卡组件测试：与 R8.1/R8.3 分享卡测试结构对称，
 * 覆盖成功/失败反馈、预览下载路径、复制链接埋点与文件名清洗。
 */

const LABELS = {
  share: "分享战绩",
  previewAlt: "预览",
  download: "下载",
  copyLink: "复制链接",
  copiedLink: "已复制",
  downloadFailed: "下载失败",
};

const LABELS_EN = {
  share: "Share",
  previewAlt: "Preview",
  download: "Download",
  copyLink: "Copy link",
  copiedLink: "Copied",
  downloadFailed: "Download failed",
};

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

// 保存真实实现，避免每次 beforeEach 反复包裹 document.createElement 造成叠加。
const realCreateElement = document.createElement.bind(document);
let createdAnchors: HTMLAnchorElement[] = [];

function installAnchorClickStub() {
  document.createElement = function (tag: string) {
    const el = realCreateElement(tag);
    if (tag.toLowerCase() === "a") {
      (el as HTMLAnchorElement).click = () => {};
      createdAnchors.push(el as HTMLAnchorElement);
    }
    return el;
  } as typeof document.createElement;
}

function installUrlStub() {
  Object.defineProperty(URL, "createObjectURL", {
    value: vi.fn(() => "blob:fake"),
    configurable: true,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    value: vi.fn(),
    configurable: true,
  });
}

function renderCard(overrides: Partial<ComponentProps<typeof ReplayShareCard>> = {}) {
  return render(
    <ReplayShareCard
      symbol="BTCUSDT"
      interval="1h"
      correct={7}
      total={10}
      accuracy={0.7}
      bestStreak={4}
      currentStreak={2}
      locale="zh"
      labels={LABELS}
      {...overrides}
    />,
  );
}

describe("ReplayShareCard", () => {
  beforeEach(() => {
    cleanup();
    growthTrack.mockClear();
    createdAnchors = [];
    installCanvasStub();
    installAnchorClickStub();
    installUrlStub();
  });

  afterEach(() => {
    cleanup();
    document.createElement = realCreateElement;
  });

  it("渲染 Share 与 Preview 按钮", () => {
    renderCard();
    expect(screen.getByTestId("replay-share-btn")).toBeInTheDocument();
    expect(screen.getByTestId("replay-share-preview-btn")).toBeInTheDocument();
  });

  it("点击 Share 触发 canvas 绘制 + 下载，并按标的与周期命名文件", async () => {
    const { container } = renderCard({ correct: 8, accuracy: 0.8 });
    expect(container.querySelector("canvas")).toBeTruthy();
    fireEvent.click(screen.getByTestId("replay-share-btn"));
    await waitFor(
      () => {
        expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalled();
        expect(growthTrack).toHaveBeenCalledWith({
          name: "share_card_download",
          card: "replay",
          locale: "zh",
          surface: "owner",
          trigger: "share",
          outcome: "succeeded",
        });
      },
      { timeout: 2000 },
    );
    expect(createdAnchors.at(-1)?.download).toBe("trade-buty-replay-btcusdt-1h.png");
  });

  it("点击 Preview 后渲染预览图并生成可复述的中文 alt", async () => {
    const { container } = renderCard({ symbol: "BTCUSDT", interval: "4h", correct: 5, total: 10, accuracy: 0.5 });
    fireEvent.click(screen.getByTestId("replay-share-preview-btn"));
    await waitFor(
      () => {
        const img = container.querySelector("img");
        expect(img).toBeTruthy();
        expect(img?.getAttribute("alt")).toBe(
          "预览：回放战绩卡，BTCUSDT · 4h，准确率 50%（命中 5/10），最佳连胜 4",
        );
        expect(growthTrack).toHaveBeenCalledWith({
          name: "share_preview_opened",
          card: "replay",
          locale: "zh",
        });
      },
      { timeout: 2000 },
    );
  });

  it("英文 locale 生成英文 alt 描述", async () => {
    const { container } = renderCard({ locale: "en", labels: LABELS_EN });
    fireEvent.click(screen.getByTestId("replay-share-preview-btn"));
    await waitFor(() =>
      expect(container.querySelector("img")?.getAttribute("alt")).toBe(
        "Preview: replay result card for BTCUSDT 1h, accuracy 70% (7/10 correct), best streak 4",
      ),
    );
  });

  it("预览后再点下载按 preview 触发下载", async () => {
    const { container } = renderCard({ currentStreak: 3 });
    fireEvent.click(screen.getByTestId("replay-share-preview-btn"));
    await waitFor(() => expect(container.querySelector("img")).toBeTruthy());

    fireEvent.click(screen.getByText(/⬇ 下载/));
    await waitFor(() =>
      expect(growthTrack).toHaveBeenCalledWith({
        name: "share_card_download",
        card: "replay",
        locale: "zh",
        surface: "owner",
        trigger: "preview",
        outcome: "succeeded",
      }),
    );
  });

  it("下载失败时显示可见错误并上报 failed", async () => {
    HTMLCanvasElement.prototype.toBlob = vi.fn(function (cb: (b: Blob | null) => void) {
      cb(null);
    }) as unknown as typeof HTMLCanvasElement.prototype.toBlob;
    renderCard();
    fireEvent.click(screen.getByTestId("replay-share-btn"));
    await waitFor(
      () => {
        expect(screen.getByRole("alert")).toHaveTextContent("下载失败");
        expect(growthTrack).toHaveBeenCalledWith({
          name: "share_card_download",
          card: "replay",
          locale: "zh",
          surface: "owner",
          trigger: "share",
          outcome: "failed",
        });
      },
      { timeout: 2000 },
    );
  });

  it("预览失败时显示可见错误且不渲染预览图", async () => {
    HTMLCanvasElement.prototype.toDataURL = vi.fn(() => {
      throw new Error("tainted canvas");
    }) as unknown as typeof HTMLCanvasElement.prototype.toDataURL;
    const { container } = renderCard();
    fireEvent.click(screen.getByTestId("replay-share-preview-btn"));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("下载失败"));
    expect(container.querySelector("img")).toBeNull();
  });

  it("传入分享链接时渲染复制按钮并上报复制结果", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    renderCard({ shareUrl: "https://example.com/share/replay" });
    fireEvent.click(screen.getByTestId("replay-share-link-btn"));
    await waitFor(() =>
      expect(growthTrack).toHaveBeenCalledWith({
        name: "share_link_copy",
        card: "replay",
        locale: "zh",
        outcome: "succeeded",
      }),
    );
    expect(writeText).toHaveBeenCalledWith("https://example.com/share/replay");
  });

  it("复制链接失败时上报 failed", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
      configurable: true,
    });
    document.execCommand = vi.fn(() => false);
    renderCard({ shareUrl: "https://example.com/share/replay" });
    fireEvent.click(screen.getByTestId("replay-share-link-btn"));
    await waitFor(() =>
      expect(growthTrack).toHaveBeenCalledWith({
        name: "share_link_copy",
        card: "replay",
        locale: "zh",
        outcome: "failed",
      }),
    );
  });

  it("重复预览会回收上一张预览图", async () => {
    const { container } = renderCard();
    fireEvent.click(screen.getByTestId("replay-share-preview-btn"));
    // 必须等到第一张预览真正落进 state，第二次点击才会走回收分支。
    await waitFor(() => expect(container.querySelector("img")).toBeTruthy());
    fireEvent.click(screen.getByTestId("replay-share-preview-btn"));
    await waitFor(() =>
      expect(URL.revokeObjectURL).toHaveBeenCalledWith("data:image/png;base64,AAAA"),
    );
  });

  it("卸载时回收预览图 URL", async () => {
    const { container, unmount } = renderCard();
    fireEvent.click(screen.getByTestId("replay-share-preview-btn"));
    await waitFor(() => expect(container.querySelector("img")).toBeTruthy());
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("data:image/png;base64,AAAA");
  });

  it("canvas 无 2D 上下文时跳过绘制但下载仍可用", async () => {
    HTMLCanvasElement.prototype.getContext = vi.fn(
      () => null,
    ) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    renderCard();
    fireEvent.click(screen.getByTestId("replay-share-btn"));
    await waitFor(() =>
      expect(growthTrack).toHaveBeenCalledWith({
        name: "share_card_download",
        card: "replay",
        locale: "zh",
        surface: "owner",
        trigger: "share",
        outcome: "succeeded",
      }),
    );
    expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalled();
  });

  it("文件名清洗非法字符并在为空时回退 replay", async () => {
    const first = renderCard({ symbol: "Btc/USDT Perp", interval: "1H" });
    fireEvent.click(screen.getByTestId("replay-share-btn"));
    await waitFor(() => expect(createdAnchors.length).toBeGreaterThan(0));
    expect(createdAnchors.at(-1)?.download).toBe("trade-buty-replay-btcusdt-perp-1h.png");
    first.unmount();

    createdAnchors = [];
    renderCard({ symbol: "  比特币 / ", interval: "   " });
    fireEvent.click(screen.getByTestId("replay-share-btn"));
    await waitFor(() => expect(createdAnchors.length).toBeGreaterThan(0));
    expect(createdAnchors.at(-1)?.download).toBe("trade-buty-replay-replay-replay.png");
  });
});
