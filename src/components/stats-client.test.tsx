// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { StatsClient } from "./stats-client";

const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => store.set(k, v),
  removeItem: (k: string) => store.delete(k),
  clear: () => store.clear(),
});

const { localDateStr, shiftDate } = await import("@/lib/date-utils");
const { buildLearningOverview } = await import("@/lib/learning-overview");

const chapters = [{ slug: "getting-started", docCount: 2 }];
const progress = { "getting-started": ["market-overview", "candlestick-basics"] };
const completions = {
  "getting-started:market-overview": { chapter: "getting-started", doc: "market-overview", at: new Date(2026, 8, 3, 12).getTime() },
  "getting-started:candlestick-basics": { chapter: "getting-started", doc: "candlestick-basics", at: new Date(2026, 8, 4, 12).getTime() },
};

const dict = {
  title: "Stats",
  subtitle: "Stats subtitle",
  readDocs: "Read docs",
  chapters: "Chapters",
  wrong: "Wrong",
  quizzes: "Quizzes",
  replay: "Replay",
  streak: "Streak",
  accuracy: "Accuracy",
  badges: "Badges",
  noBadges: "No badges",
  overall: "Overall",
  goalLabel: "Daily goal",
  goalUnit: "docs",
  goalMinUnit: "minutes",
  goalSet: "Set",
  streakReassureTpl: "No streak: {n}",
  shareStreak: "Share",
  previewStreak: "Preview",
  download: "Download",
  previewAlt: "Streak preview",
  copyLink: "Copy link",
  copiedLink: "Copied",
  totalStudyTime: "Study time",
  overviewTitle: "Learning overview",
  overviewDesc: "Overview description",
  overviewCourses: "Courses",
  overviewQuizzes: "Quizzes",
  overviewReplay: "Replay",
  overviewTime: "Time",
  overviewLocal: "Local data",
  trendTitle: "Course completion trend",
  trendDesc: "Course trend description",
  trendRange: "Last 7 days",
  trendEmpty: "No trend",
  trendCompletions: "Completed docs",
  trendNewChapters: "Completed chapters",
  trendNoDates: "No completion dates",
  quizTrendTitle: "Quiz score trend",
  quizTrendDesc: "Quiz trend description",
  quizTrendEmpty: "No quiz attempts",
  quizTrendAttempts: "Attempts",
  quizBestInRange: "Best in range",
  quizAvgScore: "Average score",
  quizNoDates: "No quiz dates",
  reviewTrendTitle: "Review efficiency",
  reviewTrendDesc: "Review trend description",
  reviewTrendEmpty: "No reviews",
  reviewTrendReviews: "Reviews",
  reviewTrendAccuracy: "Accuracy in range",
  reviewTrendMastered: "Mastered in range",
  reviewTrendDue: "Due now",
  reviewNoDates: "No review dates",
  recoveryTitle: "Breaks happen",
  recoveryBodyTpl: "Streak restarted (longest: {n})",
  recoveryReviewTpl: "Review {n} due cards",
  recoveryContinue: "Continue",
  recoveryReplay: "Replay warm-up",
  recoveryLater: "Later",
  nextTitle: "Up next",
  nextDueReviewTpl: "Review {n} due cards first",
  nextReadTpl: "Continue: {doc} · {chapter}",
  nextQuizTpl: "Check yourself: the {chapter} quiz",
  nextReplay: "Run a replay round",
  nextAllClear: "Everything complete",
  rangeLabel: "Time range",
  rangeDaysTpl: "Last {n} days",
  sourceLocal: "This device",
  sourceCloud: "Local + cloud",
  sourceSyncedTpl: "Last cloud sync {t}",
  replayTrendTitle: "Replay practice time",
  replayTrendDesc: "Replay trend description",
  replayTrendEmpty: "No replay rounds",
  replayTrendRounds: "Replay rounds",
  replayTrendTime: "Time in range",
  replayTrendAvg: "Avg per round",
  replayTrendBestStreak: "Best streak",
  replayNoDurations: "No replay durations",
  weeklyTitle: "Weekly",
  weeklySummaryTpl: "Weekly summary",
  emptyTitle: "Empty",
  emptyBody: "Empty body",
  emptyCta: "Start",
} as unknown as Parameters<typeof StatsClient>[0]["dict"];

beforeEach(() => {
  store.clear();
  store.set("tb-progress", JSON.stringify(progress));
  store.set("tb-progress-completions", JSON.stringify(completions));
});

afterEach(cleanup);

describe("StatsClient course completion trend", () => {
  it("renders the accessible trend chart and avoids inventing dates when no ledger exists", async () => {
    render(<StatsClient chapters={chapters} dict={dict} locale="zh" />);
    expect(await screen.findByText("Course completion trend")).toBeInTheDocument();
    expect(screen.getByText("Course trend description")).toBeInTheDocument();
    const chart = screen.getByRole("img", { name: /Completed docs|Completed chapters|Last 7 days|Course completion trend/ });
    expect(chart.getAttribute("aria-label")).toContain("Completed docs");
    const trendSection = document.querySelector('#course-completion-trend-title')?.closest('section');
    expect(trendSection).toBeInTheDocument();
    expect(trendSection?.textContent).toContain('2/2');
  });

  it("shows the no-dates notice for legacy progress", () => {
    store.delete("tb-progress-completions");
    render(<StatsClient chapters={chapters} dict={dict} locale="zh" />);
    expect(screen.getByText("No completion dates")).toBeInTheDocument();
  });
});


describe("StatsClient quiz score trend", () => {
  it("renders the quiz trend section and no-date notice when only current quiz progress exists", async () => {
    store.set("tb-quiz-getting-started", JSON.stringify({ best: 8, done: true }));
    render(<StatsClient chapters={chapters} dict={dict} locale="zh" />);

    expect(await screen.findByText("Quiz score trend")).toBeInTheDocument();
    expect(screen.getByText("Quiz trend description")).toBeInTheDocument();
    expect(screen.getByText("No quiz dates")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Quiz score trend|No quiz attempts/ })).toBeInTheDocument();
    expect(screen.getByText("1/1")).toBeInTheDocument();
  });

  it("renders dated quiz attempt summaries from the local ledger", async () => {
    const attemptAt = new Date(2026, 8, 7, 12).getTime();
    store.set("tb-quiz-getting-started", JSON.stringify({ best: 8, done: true }));
    store.set("tb-quiz-attempts", JSON.stringify({
      "getting-started:attempt": { chapter: "getting-started", best: 8, total: 10, at: attemptAt },
    }));
    render(<StatsClient chapters={chapters} dict={dict} locale="zh" />);

    expect(await screen.findByText("Quiz score trend")).toBeInTheDocument();
    expect(screen.queryByText("No quiz dates")).not.toBeInTheDocument();
    expect(screen.getByText("1/1")).toBeInTheDocument();
  });
});

describe("StatsClient wrongbook review efficiency", () => {
  it("renders the review efficiency section with no-date notice when no ledger exists", async () => {
    store.set("tb-wrong", JSON.stringify({
      "getting-started:0": { chapterNum: "getting-started", questionIdx: 0, picked: 1, at: Date.now(), srsStage: 0, srsDue: localDateStr() },
    }));
    render(<StatsClient chapters={chapters} dict={dict} locale="zh" />);

    expect(await screen.findByText("Review efficiency")).toBeInTheDocument();
    expect(screen.getByText("Review trend description")).toBeInTheDocument();
    expect(screen.getByText("No review dates")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Review efficiency|No reviews/ })).toBeInTheDocument();
    // 当前待复习口径仍然可读：due 1 / pending 1
    const section = document.querySelector("#review-efficiency-title")?.closest("section");
    expect(section?.textContent).toContain("1/1");
  });

  it("renders dated review summaries from the local ledger without the notice", async () => {
    const at = new Date(2026, 8, 7, 12).getTime();
    store.set("tb-wrong", JSON.stringify({
      "getting-started:0": { chapterNum: "getting-started", questionIdx: 0, picked: 1, at, srsStage: 1, srsDue: localDateStr() },
    }));
    store.set("tb-review-attempts", JSON.stringify({
      "getting-started:0:123": { chapter: "getting-started", questionIdx: 0, correct: true, mastered: false, stage: 1, at },
      "getting-started:1:456": { chapter: "getting-started", questionIdx: 1, correct: false, mastered: false, stage: 0, at },
    }));
    render(<StatsClient chapters={chapters} dict={dict} locale="zh" />);

    expect(await screen.findByText("Review efficiency")).toBeInTheDocument();
    expect(screen.queryByText("No review dates")).not.toBeInTheDocument();
    const section = document.querySelector("#review-efficiency-title")?.closest("section");
    expect(section?.textContent).toContain("50%");
  });
});

describe("StatsClient replay practice time", () => {
  it("renders rounds from legacy records with the no-duration notice", async () => {
    store.set("tb-replay-history", JSON.stringify([
      { at: Date.now(), symbol: "BTCUSDT", interval: "1h", total: 10, correct: 7, bestStreak: 4 },
    ]));
    render(<StatsClient chapters={chapters} dict={dict} locale="zh" />);

    expect(await screen.findByText("Replay practice time")).toBeInTheDocument();
    expect(screen.getByText("Replay trend description")).toBeInTheDocument();
    expect(screen.getByText("No replay durations")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Replay practice time|No replay rounds/ })).toBeInTheDocument();
  });

  it("renders duration summaries from new records without the notice", async () => {
    store.set("tb-replay-history", JSON.stringify([
      { at: Date.now(), symbol: "BTCUSDT", interval: "1h", total: 10, correct: 7, bestStreak: 4, durationSec: 300 },
    ]));
    store.set("tb-replay-best", "6");
    render(<StatsClient chapters={chapters} dict={dict} locale="zh" />);

    expect(await screen.findByText("Replay practice time")).toBeInTheDocument();
    expect(screen.queryByText("No replay durations")).not.toBeInTheDocument();
    const section = document.querySelector("#replay-time-trend-title")?.closest("section");
    expect(section?.textContent).toContain("5m 0s"); // 期间时长 300s
    expect(section?.textContent).toContain("6");     // 历史最佳连击（tb-replay-best 优先）
  });
});

describe("StatsClient personalized next suggestion (R12.7)", () => {
  it("suggests continuing the next unread doc when nothing is due", async () => {
    // 读 1/2 篇：既避开全新用户空态，又让「下一篇未读」存在
    store.set("tb-progress", JSON.stringify({ "getting-started": ["market-overview"] }));
    render(<StatsClient
      chapters={[{ slug: "getting-started", docCount: 2, title: "01 · Basics", docs: [
        { slug: "market-overview", title: "01 · Market overview" },
        { slug: "candlestick-basics", title: "02 · Candlesticks" },
      ] }]}
      dict={dict}
      locale="en"
    />);

    expect(await screen.findByText("Up next")).toBeInTheDocument();
    const link = screen.getByText("Continue: 02 · Candlesticks · 01 · Basics");
    expect(link).toBeInTheDocument();
    const section = document.querySelector("#next-suggestion-title")?.closest("section");
    expect(section?.querySelector("a")?.getAttribute("href")).toBe("/en/knowledge/getting-started/candlestick-basics");
  });

  it("prioritizes due reviews over unread docs", async () => {
    store.set("tb-wrong", JSON.stringify({
      "getting-started:0": { chapterNum: "getting-started", questionIdx: 0, picked: 1, at: Date.now(), srsStage: 0, srsDue: localDateStr() },
    }));
    render(<StatsClient
      chapters={[{ slug: "getting-started", docCount: 2, title: "01 · Basics", docs: [
        { slug: "market-overview", title: "01 · Market overview" },
        { slug: "candlestick-basics", title: "02 · Candlesticks" },
      ] }]}
      dict={dict}
      locale="en"
    />);

    expect(await screen.findByText("Review 1 due cards first")).toBeInTheDocument();
    const section = document.querySelector("#next-suggestion-title")?.closest("section");
    expect(section?.querySelector("a")?.getAttribute("href")).toBe("/en/review");
  });

  it("suggests the chapter quiz once every doc is read", async () => {
    store.set("tb-progress", JSON.stringify({ "getting-started": ["market-overview", "candlestick-basics"] }));
    render(<StatsClient
      chapters={[{ slug: "getting-started", docCount: 2, title: "01 · Basics", docs: [
        { slug: "market-overview", title: "01 · Market overview" },
        { slug: "candlestick-basics", title: "02 · Candlesticks" },
      ] }]}
      dict={dict}
      locale="zh"
    />);

    expect(await screen.findByText(/the 01 · Basics quiz/)).toBeInTheDocument();
  });
});

describe("StatsClient time-range filter (R12.10)", () => {
  it("defaults to 7 days and switching to 30 days re-renders all trend grids and persists", async () => {
    render(<StatsClient chapters={chapters} dict={dict} locale="en" />);

    // 默认 7 天档已选中
    expect(await screen.findByRole("group", { name: "Time range" })).toBeInTheDocument();
    const btn7 = screen.getByRole("button", { name: "Last 7 days" });
    const btn30 = screen.getByRole("button", { name: "Last 30 days" });
    expect(btn7).toHaveAttribute("aria-pressed", "true");
    expect(btn30).toHaveAttribute("aria-pressed", "false");
    expect(screen.getAllByRole("img", { name: /^Last 7 days:/ })).toHaveLength(1);

    const { fireEvent } = await import("@testing-library/react");
    fireEvent.click(btn30);

    expect(store.get("tb-stats-range-days")).toBe("30");
    expect(screen.getByRole("button", { name: "Last 30 days" })).toHaveAttribute("aria-pressed", "true");
    // 课程趋势 aria 摘要随范围更新
    expect(screen.getByRole("img", { name: /^Last 30 days:/ })).toBeInTheDocument();
    // 30 天网格列数生效
    const section = document.querySelector("#course-completion-trend-title")?.closest("section");
    expect(section?.querySelector("div[style]")?.getAttribute("style")).toContain("repeat(30, minmax(0, 1fr))");
  });
});

describe("StatsClient data source label (R12.8)", () => {
  it("shows the local-device source pill when not signed in", async () => {
    render(<StatsClient chapters={chapters} dict={dict} locale="zh" />);
    expect(await screen.findByLabelText("This device")).toBeInTheDocument();
    expect(screen.queryByText(/Last cloud sync/)).not.toBeInTheDocument();
  });
});
