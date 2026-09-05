// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { StreakShareCard } from "./streak-share-card";

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
        labels={{ share: "分享我的连续打卡", previewAlt: "预览", download: "下载" }}
      />,
    );
    expect(screen.getByTestId("streak-share-btn")).toBeInTheDocument();
    expect(screen.getByTestId("streak-share-preview-btn")).toBeInTheDocument();
  });

  it("currentStreak = 0 时按钮禁用", () => {
    render(
      <StreakShareCard
        currentStreak={0}
        longestStreak={3}
        recentDays={SEVEN_DAYS}
        locale="zh"
        labels={{ share: "分享", previewAlt: "预览", download: "下载" }}
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
        labels={{ share: "分享", previewAlt: "预览", download: "下载" }}
      />,
    );
    expect(container.querySelector("canvas")).toBeTruthy();
    fireEvent.click(screen.getByTestId("streak-share-btn"));
    await waitFor(
      () => {
        expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalled();
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
        labels={{ share: "分享", previewAlt: "连续打卡卡预览", download: "下载" }}
      />,
    );
    fireEvent.click(screen.getByTestId("streak-share-preview-btn"));
    await waitFor(
      () => {
        const img = container.querySelector("img");
        expect(img).toBeTruthy();
        expect(img?.getAttribute("alt")).toBe("连续打卡卡预览");
      },
      { timeout: 2000 },
    );
  });
});
