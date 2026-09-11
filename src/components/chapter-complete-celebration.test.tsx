// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import { ChapterCompleteCelebration, CELEBRATION_EMOJIS } from "./chapter-complete-celebration";

const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => store.set(k, v),
  removeItem: (k: string) => store.delete(k),
  clear: () => store.clear(),
});

describe("ChapterCompleteCelebration (R12.18)", () => {
  beforeEach(() => {
    store.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("emoji set stays learning-neutral: no profit/bull-market/holding hints", () => {
    const forbidden = ["📈", "💎", "🚀", "💰", "🤑", "🐂", "🌕"];
    for (const glyph of forbidden) {
      expect(CELEBRATION_EMOJIS).not.toContain(glyph);
    }
    expect(CELEBRATION_EMOJIS.length).toBeGreaterThan(0);
  });

  it("shows neutral localized copy when mounted on a just-completed chapter, never when incomplete", async () => {
    // 未完成：挂载不庆祝
    store.set("tb-progress", JSON.stringify({ "getting-started": ["a"] }));
    const first = render(<ChapterCompleteCelebration chapterSlug="getting-started" docCount={2} locale="zh" />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    first.unmount();

    // 刚完成（导航回落到章节页时挂载）：庆祝，但文案只肯定学习完成
    store.set("tb-progress", JSON.stringify({ "getting-started": ["a", "b"] }));
    render(<ChapterCompleteCelebration chapterSlug="getting-started" docCount={2} locale="zh" />);
    expect(screen.getByRole("status")).toHaveTextContent("篇章完成！");
    expect(screen.queryByText(/盈利|收益|赚|胜率|profit|gain|return/i)).not.toBeInTheDocument();

    // 3 秒后自动消失
    await act(async () => {
      vi.advanceTimersByTime(3100);
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("auto-dismisses after the animation window", async () => {
    store.set("tb-progress", JSON.stringify({ c: ["a"] }));
    render(<ChapterCompleteCelebration chapterSlug="c" docCount={1} locale="en" />);
    expect(screen.getByRole("status")).toHaveTextContent("Chapter complete!");
    await act(async () => {
      vi.advanceTimersByTime(3100);
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
