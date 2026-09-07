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
