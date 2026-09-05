// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { QuizShareCard } from "./quiz-share-card";

/**
 * R8.1 测验分享卡组件测试：
 * - 渲染两个按钮（Share / Preview）
 * - 点击 Share 触发 PNG 下载（mock canvas.toBlob）
 * - 点击 Preview 后显示预览图
 *
 * jsdom 不实现 Canvas2D getContext / anchor click —— 我们 stub 出完整接口以保证路径走通
 * （不验证像素，只验证行为契约）。
 */

interface FakeCtxState {
  fillStyle: string;
  font: string;
  textAlign: string;
  textBaseline: string;
  fillCalls: number;
  fillTextCalls: string[];
}

function fakeCtx(): CanvasRenderingContext2D {
  const state: FakeCtxState = {
    fillStyle: "",
    font: "",
    textAlign: "",
    textBaseline: "",
    fillCalls: 0,
    fillTextCalls: [],
  };
  const stub = {
    get state() {
      return state;
    },
    measureText(text: string) {
      // 简单近似：每字 12px
      return { width: text.length * 12 } as TextMetrics;
    },
    fillRect: () => state.fillCalls++,
    fillText: (text: string) => state.fillTextCalls.push(text),
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    save: () => {},
    restore: () => {},
    createLinearGradient: () => ({
      addColorStop: () => {},
    }),
    fillStyle: "",
    font: "",
    textAlign: "left",
    textBaseline: "alphabetic",
  };
  return stub as unknown as CanvasRenderingContext2D;
}

function installCanvasStub() {
  // 用 `as unknown as` 绕过 overload 推断（vi.fn 返回 Mock，与 getContext 的多态签名不直接兼容）
  HTMLCanvasElement.prototype.getContext = vi.fn(function () {
    return fakeCtx() as unknown as CanvasRenderingContext2D;
  }) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.toBlob = vi.fn(function (cb: (b: Blob | null) => void) {
    cb(new Blob([new Uint8Array(8)], { type: "image/png" }));
  }) as unknown as typeof HTMLCanvasElement.prototype.toBlob;
  HTMLCanvasElement.prototype.toDataURL = vi.fn(
    () => "data:image/png;base64,AAAA",
  ) as unknown as typeof HTMLCanvasElement.prototype.toDataURL;
}

function installAnchorClickStub() {
  // jsdom 对 a.click() 抛 "Not implemented: navigation to another Document"
  // 我们的 handleShare 异步走到这里会中断，屏蔽掉即可。
  const origCreate = document.createElement.bind(document);
  document.createElement = function (tag: string) {
    const el = origCreate(tag);
    if (tag.toLowerCase() === "a") {
      (el as HTMLAnchorElement).click = () => {};
    }
    return el;
  } as typeof document.createElement;
}

describe("QuizShareCard", () => {
  beforeEach(() => {
    cleanup();
    installCanvasStub();
    installAnchorClickStub();
    // URL.createObjectURL / revokeObjectURL stub
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
      <QuizShareCard
        chapterTitle="入门基础"
        score={4}
        total={5}
        locale="zh"
        labels={{ share: "分享", previewAlt: "预览", download: "下载" }}
      />,
    );
    expect(screen.getByTestId("quiz-share-btn")).toBeInTheDocument();
    expect(screen.getByTestId("quiz-share-preview-btn")).toBeInTheDocument();
  });

  it("点击 Share 触发 canvas 绘制 + 下载", async () => {
    const { container } = render(
      <QuizShareCard
        chapterTitle="入门基础"
        score={5}
        total={5}
        locale="zh"
        labels={{ share: "分享我的成绩", previewAlt: "预览", download: "下载" }}
      />,
    );
    // canvas 存在但隐藏
    const canvas = container.querySelector("canvas");
    expect(canvas).toBeTruthy();
    fireEvent.click(screen.getByTestId("quiz-share-btn"));
    // handleShare 是 async，等 toBlob 被异步触发
    await waitFor(
      () => {
        expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalled();
      },
      { timeout: 2000 },
    );
  });

  it("点击 Preview 后渲染预览图", async () => {
    const { container } = render(
      <QuizShareCard
        chapterTitle="入门基础"
        score={3}
        total={5}
        locale="zh"
        labels={{ share: "分享", previewAlt: "预览卡", download: "下载" }}
      />,
    );
    fireEvent.click(screen.getByTestId("quiz-share-preview-btn"));
    // handlePreview 是 async，等 React 重渲；waitFor 跨 React 重渲轮询
    await waitFor(
      () => {
        const img = container.querySelector("img");
        expect(img).toBeTruthy();
        expect(img?.getAttribute("alt")).toBe("预览卡");
      },
      { timeout: 2000 },
    );
  });
});
