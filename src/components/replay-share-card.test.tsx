// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { ReplayShareCard } from "./replay-share-card";

/**
 * R8.2 回放分享卡组件测试：与 R8.1 QuizShareCard 测试结构对称。
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

describe("ReplayShareCard", () => {
  beforeEach(() => {
    cleanup();
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
      <ReplayShareCard
        symbol="BTCUSDT"
        interval="1h"
        correct={7}
        total={10}
        accuracy={0.7}
        bestStreak={4}
        currentStreak={2}
        locale="zh"
        labels={{ share: "分享战绩", previewAlt: "预览", download: "下载" }}
      />,
    );
    expect(screen.getByTestId("replay-share-btn")).toBeInTheDocument();
    expect(screen.getByTestId("replay-share-preview-btn")).toBeInTheDocument();
  });

  it("点击 Share 触发 canvas 绘制 + 下载", async () => {
    const { container } = render(
      <ReplayShareCard
        symbol="BTCUSDT"
        interval="1h"
        correct={8}
        total={10}
        accuracy={0.8}
        bestStreak={5}
        currentStreak={3}
        locale="zh"
        labels={{ share: "分享我的回放战绩", previewAlt: "预览", download: "下载" }}
      />,
    );
    expect(container.querySelector("canvas")).toBeTruthy();
    fireEvent.click(screen.getByTestId("replay-share-btn"));
    await waitFor(
      () => {
        expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalled();
      },
      { timeout: 2000 },
    );
  });

  it("点击 Preview 后渲染预览图", async () => {
    const { container } = render(
      <ReplayShareCard
        symbol="BTCUSDT"
        interval="4h"
        correct={5}
        total={10}
        accuracy={0.5}
        bestStreak={2}
        currentStreak={1}
        locale="zh"
        labels={{ share: "分享", previewAlt: "回放卡预览", download: "下载" }}
      />,
    );
    fireEvent.click(screen.getByTestId("replay-share-preview-btn"));
    await waitFor(
      () => {
        const img = container.querySelector("img");
        expect(img).toBeTruthy();
        expect(img?.getAttribute("alt")).toBe("回放卡预览");
      },
      { timeout: 2000 },
    );
  });
});
