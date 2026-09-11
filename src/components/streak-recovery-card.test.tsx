// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { StreakRecoveryCard } from "./streak-recovery-card";
import { localDateStr, shiftDate } from "@/lib/date-utils";

const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => store.set(k, v),
  removeItem: (k: string) => store.delete(k),
  clear: () => store.clear(),
});

const labels = {
  title: "Breaks happen — restart today",
  bodyTpl: "Your streak has restarted (longest: {n} days).",
  reviewTpl: "Review {n} due cards",
  continueLabel: "Continue the next lesson",
  replayLabel: "Warm up with a replay",
  later: "Later",
};

function seedBrokenStreak(longest = 8) {
  const today = localDateStr();
  store.set("tb-streak", JSON.stringify({
    lastDate: shiftDate(today, -3),
    current: 0,
    longest,
    lastTs: Date.now() - 3 * 86_400_000,
  }));
}

beforeEach(() => store.clear());
afterEach(cleanup);

describe("StreakRecoveryCard", () => {
  it("renders the gentle recovery card with prioritized actions when streak broke and today is idle", async () => {
    seedBrokenStreak(8);
    store.set("tb-wrong", JSON.stringify({
      "a:0": { chapterNum: "a", questionIdx: 0, picked: 1, at: Date.now(), srsStage: 0, srsDue: localDateStr() },
    }));
    render(<StreakRecoveryCard hasUnfinishedChapter locale="en" labels={labels} />);

    expect(await screen.findByText("Breaks happen — restart today")).toBeInTheDocument();
    expect(screen.getByText(/longest: 8 days/)).toBeInTheDocument();
    // 到期复习优先，且带真实到期数量
    const review = screen.getByRole("link", { name: "Review 1 due cards" });
    expect(review).toHaveAttribute("href", "/en/review");
    expect(screen.getByRole("link", { name: "Continue the next lesson" })).toHaveAttribute("href", "/en/path");
  });

  it("does not render when the streak is intact", () => {
    store.set("tb-streak", JSON.stringify({
      lastDate: localDateStr(),
      current: 3,
      longest: 3,
      lastTs: Date.now(),
    }));
    const { container } = render(<StreakRecoveryCard hasUnfinishedChapter locale="en" labels={labels} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("offers replay fallback when nothing is due and all chapters finished", async () => {
    seedBrokenStreak(2);
    render(<StreakRecoveryCard hasUnfinishedChapter={false} locale="zh" labels={labels} />);
    expect(await screen.findByRole("link", { name: "Warm up with a replay" })).toHaveAttribute("href", "/zh/replay");
  });

  it("hides for the rest of the day after pressing Later", async () => {
    seedBrokenStreak(5);
    render(<StreakRecoveryCard hasUnfinishedChapter locale="en" labels={labels} />);
    expect(await screen.findByText("Breaks happen — restart today")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Later" }));
    expect(store.get("tb-recovery-dismissed")).toBe(localDateStr());
    expect(screen.queryByText("Breaks happen — restart today")).not.toBeInTheDocument();
  });
});
