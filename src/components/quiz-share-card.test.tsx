// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { QuizShareCard } from "./quiz-share-card";
vi.mock("@/lib/growth-events", () => ({ trackGrowthEvent: vi.fn() }));
import { trackGrowthEvent } from "@/lib/growth-events";

const growthTrack = vi.mocked(trackGrowthEvent);

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
    growthTrack.mockClear();
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
        labels={{ share: "分享", preview: "预览卡面", previewAlt: "预览", download: "下载", copyLink: "复制链接", copiedLink: "已复制", copyFailed: "复制失败", downloadFailed: "下载失败", previewFailed: "预览失败" }}
      />,
    );
    expect(screen.getByTestId("quiz-share-btn")).toBeInTheDocument();
    const preview = screen.getByTestId("quiz-share-preview-btn");
    expect(preview).toBeInTheDocument();
    // 按钮文案来自传入的字典，不是组件里写死的英文
    expect(preview).toHaveTextContent("预览卡面");
    expect(preview).not.toHaveTextContent("Preview");
  });

  it("点击 Share 触发 canvas 绘制 + 下载", async () => {
    const { container } = render(
      <QuizShareCard
        chapterTitle="入门基础"
        score={5}
        total={5}
        locale="zh"
        labels={{ share: "分享我的成绩", preview: "预览卡面", previewAlt: "预览", download: "下载", copyLink: "复制链接", copiedLink: "已复制", copyFailed: "复制失败", downloadFailed: "下载失败", previewFailed: "预览失败" }}
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
        expect(growthTrack).toHaveBeenCalledWith({
          name: "share_card_download",
          card: "quiz",
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
      <QuizShareCard
        chapterTitle="入门基础"
        score={3}
        total={5}
        locale="zh"
        labels={{ share: "分享", preview: "预览卡面", previewAlt: "预览卡", download: "下载", copyLink: "复制链接", copiedLink: "已复制", copyFailed: "复制失败", downloadFailed: "下载失败", previewFailed: "预览失败" }}
      />,
    );
    fireEvent.click(screen.getByTestId("quiz-share-preview-btn"));
    // handlePreview 是 async，等 React 重渲；waitFor 跨 React 重渲轮询
    await waitFor(
      () => {
        const img = container.querySelector("img");
        expect(img).toBeTruthy();
        expect(img?.getAttribute("alt")).toMatch(/^预览卡：/);
        expect(img?.getAttribute("alt")).toContain("入门基础");
        expect(growthTrack).toHaveBeenCalledWith({
          name: "share_preview_opened",
          card: "quiz",
          locale: "zh",
        });
      },
      { timeout: 2000 },
    );
  });

  it("复制分享链接时只上报成功/失败枚举", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn(async () => {}) },
      configurable: true,
    });
    render(
      <QuizShareCard
        chapterTitle="入门基础"
        score={3}
        total={5}
        locale="zh"
        shareUrl="https://example.com/share/quiz/secret?ref=alice"
        labels={{ share: "分享", preview: "预览卡面", previewAlt: "预览卡", download: "下载", copyLink: "复制链接", copiedLink: "已复制", copyFailed: "复制失败", downloadFailed: "下载失败", previewFailed: "预览失败" }}
      />,
    );
    fireEvent.click(screen.getByTestId("quiz-share-link-btn"));
    await waitFor(() =>
      expect(growthTrack).toHaveBeenCalledWith({
        name: "share_link_copy",
        card: "quiz",
        locale: "zh",
        outcome: "succeeded",
      }),
    );
    expect(JSON.stringify(growthTrack.mock.calls)).not.toContain("alice");
  });
});

describe("QuizShareCard download failure feedback (R13.6)", () => {
  it("shows the failure message when canvas.toBlob yields null", async () => {
    installCanvasStub();
    installAnchorClickStub();
    HTMLCanvasElement.prototype.toBlob = vi.fn(function (cb: (b: Blob | null) => void) {
      cb(null);
    }) as unknown as typeof HTMLCanvasElement.prototype.toBlob;
    render(
      <QuizShareCard
        chapterTitle="入门基础"
        score={8}
        total={10}
        locale="zh"
        labels={{ share: "分享", preview: "预览卡面", previewAlt: "预览卡", download: "下载", copyLink: "复制链接", copiedLink: "已复制", copyFailed: "复制失败", downloadFailed: "下载失败，请重试", previewFailed: "预览失败" }}
      />,
    );
    fireEvent.click(screen.getByTestId("quiz-share-btn"));
    expect(await screen.findByRole("alert")).toHaveTextContent("下载失败，请重试");
    expect(growthTrack).toHaveBeenCalledWith({
      name: "share_card_download",
      card: "quiz",
      locale: "zh",
      surface: "owner",
      trigger: "share",
      outcome: "failed",
    });
  });

  it("shows the failure message when preview drawing fails", async () => {
    installCanvasStub();
    installAnchorClickStub();
    HTMLCanvasElement.prototype.getContext = vi.fn(() => {
      throw new Error("canvas unavailable");
    }) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    render(
      <QuizShareCard
        chapterTitle="入门基础"
        score={8}
        total={10}
        locale="zh"
        labels={{ share: "分享", preview: "预览卡面", previewAlt: "预览卡", download: "下载", copyLink: "复制链接", copiedLink: "已复制", copyFailed: "复制失败", downloadFailed: "下载失败，请重试", previewFailed: "预览失败" }}
      />,
    );
    fireEvent.click(screen.getByTestId("quiz-share-preview-btn"));
    // 点的是「预览卡面」，报错就要说预览——写成下载失败是把用户指回了一条他没走的路
    expect(await screen.findByRole("alert")).toHaveTextContent("预览失败");
  });
});

describe("QuizShareCard share URL and preview behavior", () => {
  function renderCard(opts: { shareUrl?: string; score?: number; total?: number } = {}) {
    installCanvasStub();
    installAnchorClickStub();
    growthTrack.mockClear();
    return render(
      <QuizShareCard
        chapterTitle="Margin Mechanics"
        score={opts.score ?? 6}
        total={opts.total ?? 8}
        locale="en"
        siteName="Trade Buty"
        shareUrl={opts.shareUrl}
        labels={{ share: "Share", preview: "预览卡面", previewAlt: "Preview", download: "Download", copyLink: "Copy link", copiedLink: "Copied", copyFailed: "复制失败", downloadFailed: "Download failed", previewFailed: "Preview failed" }}
      />,
    );
  }

  it("omits the copy link button when no shareUrl is provided", () => {
    renderCard();
    expect(screen.queryByTestId("quiz-share-link-btn")).not.toBeInTheDocument();
  });

  it("uses the existing preview to download after preview is open", async () => {
    renderCard({ shareUrl: "https://example.com/share/quiz/margin-mechanics" });
    fireEvent.click(screen.getByTestId("quiz-share-preview-btn"));
    await waitFor(() => expect(screen.getByText("⬇ Download")).toBeInTheDocument());

    fireEvent.click(screen.getByText("⬇ Download"));
    await waitFor(() =>
      expect(growthTrack).toHaveBeenCalledWith({
        name: "share_card_download",
        card: "quiz",
        locale: "en",
        surface: "owner",
        trigger: "preview",
        outcome: "succeeded",
      }),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders an English preview description whose percentage is the number the card draws", async () => {
    const { container } = renderCard({ score: 2, total: 3 });
    fireEvent.click(screen.getByTestId("quiz-share-preview-btn"));

    await waitFor(() => {
      const img = container.querySelector("img");
      // 卡面画的是 formatPercent(66.66…) = "67%"；alt 此前写 "66.7%"，
      // 读屏用户复述出来的和看见的不是同一张卡
      expect(img?.getAttribute("alt")).toBe('Preview: quiz result card for "Margin Mechanics", 2/3 (67%)');
    });
  });
});
