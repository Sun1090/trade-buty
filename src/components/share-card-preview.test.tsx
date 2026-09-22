// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ShareCardPreview } from "./share-card-preview";
import { encodeQuiz, encodeReplay, encodeStreak } from "@/lib/share-decode";

vi.mock("@/lib/growth-events", () => ({ trackGrowthEvent: vi.fn() }));
import { trackGrowthEvent } from "@/lib/growth-events";

const growthTrack = vi.mocked(trackGrowthEvent);

const LABELS = {
  quizTitleTpl: "{chapter} · {grade} · {score}/{total}",
  quizDescTpl: "{chapter} {score}/{total} {percent}%",
  replayTitleTpl: "{symbol} {interval} {grade} {correct}/{total}",
  replayDescTpl: "{symbol} {correct}/{total} {percent}%",
  streakTitleTpl: "{days} days",
  streakDescTpl: "{days} / {longest}",
  invalidQuizTitle: "Invalid quiz",
  invalidReplayTitle: "Invalid replay",
  invalidStreakTitle: "Invalid streak",
  invalidBody: "Invalid body",
  ctaTitle: "CTA",
  ctaBody: "Body",
  ctaPath: "Path",
  ctaReplay: "Replay",
  downloadPng: "下载卡面 PNG",
  downloadFailed: "下载失败，请重试",
  readyToShare: "可以分享了",
  rendering: "正在生成预览…",
};

function installCanvasStub(toBlobResult: Blob | null = new Blob(["png"], { type: "image/png" })) {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    measureText: (text: string) => ({ width: text.length * 8 }) as TextMetrics,
    fillRect: () => {},
    fillText: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    save: () => {},
    restore: () => {},
    createLinearGradient: () => ({ addColorStop: () => {} }),
    strokeRect: () => {},
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    font: "",
    textAlign: "left",
    textBaseline: "alphabetic",
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.toBlob = vi.fn((cb: (blob: Blob | null) => void) => cb(toBlobResult)) as unknown as typeof HTMLCanvasElement.prototype.toBlob;
  const originalCreate = document.createElement.bind(document);
  document.createElement = ((tag: string) => {
    const el = originalCreate(tag);
    if (tag.toLowerCase() === "a") (el as HTMLAnchorElement).click = () => {};
    return el;
  }) as typeof document.createElement;
  if (!("createObjectURL" in URL)) {
    Object.defineProperty(URL, "createObjectURL", { value: () => "blob:fake", configurable: true });
  }
  if (!("revokeObjectURL" in URL)) {
    Object.defineProperty(URL, "revokeObjectURL", { value: () => {}, configurable: true });
  }
}

describe("ShareCardPreview growth events", () => {
  beforeEach(() => {
    cleanup();
    growthTrack.mockClear();
    installCanvasStub();
  });

  afterEach(cleanup);

  it("落地页下载成功上报 started → succeeded", async () => {
    const path = encodeQuiz({
      chapterTitle: "Risk",
      score: 4,
      total: 5,
      percent: 80,
      locale: "en",
    });
    render(<ShareCardPreview kind="quiz" path={path} locale="en" labels={LABELS} />);
    const button = screen.getByTestId("share-download-btn-quiz");
    await waitFor(() => expect(button).toBeEnabled());
    // 下载按钮与状态文字都取自 labels，不再写死英文
    expect(button).toHaveTextContent("下载卡面 PNG");
    expect(screen.getByText("可以分享了")).toBeInTheDocument();
    fireEvent.click(button);
    await waitFor(() =>
      expect(growthTrack).toHaveBeenLastCalledWith({
        name: "share_card_download",
        card: "quiz",
        locale: "en",
        surface: "landing",
        trigger: "preview",
        outcome: "succeeded",
      }),
    );
    expect(growthTrack).toHaveBeenNthCalledWith(1, {
      name: "share_card_download",
      card: "quiz",
      locale: "en",
      surface: "landing",
      trigger: "preview",
      outcome: "started",
    });
  });

  it("落地页下载失败上报 failed 且不产生未处理拒绝", async () => {
    installCanvasStub(null);
    const path = encodeQuiz({
      chapterTitle: "Risk",
      score: 4,
      total: 5,
      percent: 80,
      locale: "en",
    });
    render(<ShareCardPreview kind="quiz" path={path} locale="en" labels={LABELS} />);
    const button = screen.getByTestId("share-download-btn-quiz");
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    await waitFor(() =>
      expect(growthTrack).toHaveBeenLastCalledWith({
        name: "share_card_download",
        card: "quiz",
        locale: "en",
        surface: "landing",
        trigger: "preview",
        outcome: "failed",
      }),
    );
    // R13.6：失败不能只进埋点——用户必须看得见（与站内三张卡同一标准）
    expect(await screen.findByRole("alert")).toHaveTextContent(LABELS.downloadFailed);
  });

  it("下载成功时不出现失败提示", async () => {
    const path = encodeQuiz({
      chapterTitle: "Risk",
      score: 4,
      total: 5,
      percent: 80,
      locale: "en",
    });
    render(<ShareCardPreview kind="quiz" path={path} locale="en" labels={LABELS} />);
    const button = screen.getByTestId("share-download-btn-quiz");
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    await waitFor(() =>
      expect(growthTrack).toHaveBeenLastCalledWith(
        expect.objectContaining({ outcome: "succeeded" }),
      ),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("ShareCardPreview replay / streak rendering", () => {
  beforeEach(() => {
    cleanup();
    growthTrack.mockClear();
    installCanvasStub();
  });

  afterEach(cleanup);

  it("replay 类型渲染回放文案并画布就绪", async () => {
    const path = encodeReplay({
      symbol: "BTCUSDT",
      interval: "1h",
      correct: 8,
      total: 10,
      accuracyBps: 8000,
      bestStreak: 5,
      currentStreak: 3,
      locale: "en",
    });
    render(<ShareCardPreview kind="replay" path={path} locale="en" labels={LABELS} />);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "BTCUSDT 1h S 8/10",
    );
    expect(screen.getByText("BTCUSDT 8/10 80%")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId("share-download-btn-replay")).toBeEnabled(),
    );
  });

  it("streak 类型渲染连续天数文案并画布就绪", async () => {
    const path = encodeStreak({ currentStreak: 12, longestStreak: 30, locale: "zh" });
    render(<ShareCardPreview kind="streak" path={path} locale="zh" labels={LABELS} />);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("12 days");
    expect(screen.getByText("12 / 30")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId("share-download-btn-streak")).toBeEnabled(),
    );
  });
});

describe("ShareCardPreview invalid payloads stay un-downloadable", () => {
  beforeEach(() => {
    cleanup();
    growthTrack.mockClear();
    installCanvasStub();
  });

  afterEach(cleanup);

  it.each([
    ["quiz", "Invalid quiz"],
    ["replay", "Invalid replay"],
    ["streak", "Invalid streak"],
  ] as const)("%s 非法载荷显示提示且按钮保持禁用", (kind, title) => {
    render(<ShareCardPreview kind={kind} path="garbage" locale="en" labels={LABELS} />);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(title);
    expect(screen.getByText("Invalid body")).toBeInTheDocument();
    expect(screen.getByTestId(`share-download-btn-${kind}`)).toBeDisabled();
    expect(screen.getByText(LABELS.rendering)).toBeInTheDocument();
  });

  it("画布上下文不可用时不置就绪", () => {
    HTMLCanvasElement.prototype.getContext = vi.fn(
      () => null,
    ) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    const path = encodeQuiz({
      chapterTitle: "Risk",
      score: 4,
      total: 5,
      percent: 80,
      locale: "en",
    });
    render(<ShareCardPreview kind="quiz" path={path} locale="en" labels={LABELS} />);

    expect(screen.getByTestId("share-download-btn-quiz")).toBeDisabled();
    expect(screen.getByText(LABELS.rendering)).toBeInTheDocument();
  });
});

describe("ShareCardPreview grade thresholds", () => {
  beforeEach(() => {
    cleanup();
    installCanvasStub();
  });

  afterEach(cleanup);

  it.each([
    [100, "S"],
    [80, "A"],
    [60, "B"],
    [59.9, "C"],
  ] as const)("quiz percent %s 映射为等级 %s", (percent, grade) => {
    const path = encodeQuiz({
      chapterTitle: "Risk",
      score: 1,
      total: 1,
      percent,
      locale: "en",
    });
    render(<ShareCardPreview kind="quiz" path={path} locale="en" labels={LABELS} />);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      `Risk · ${grade} · 1/1`,
    );
  });

  it.each([
    [8000, 10, "S"],
    [6500, 10, "A"],
    [5500, 10, "B"],
    [4000, 10, "C"],
    [9000, 2, "C"],
  ] as const)(
    "replay accuracyBps=%s total=%s 映射为等级 %s",
    (accuracyBps, total, grade) => {
      const path = encodeReplay({
        symbol: "ETHUSDT",
        interval: "4h",
        correct: 1,
        total,
        accuracyBps,
        bestStreak: 1,
        currentStreak: 1,
        locale: "en",
      });
      render(<ShareCardPreview kind="replay" path={path} locale="en" labels={LABELS} />);

      expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
        `ETHUSDT 4h ${grade} 1/${total}`,
      );
    },
  );
});
