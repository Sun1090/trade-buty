// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ShareCardPreview } from "./share-card-preview";
import { encodeQuiz } from "@/lib/share-decode";

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
    fillStyle: "",
    strokeStyle: "",
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
  });
});
