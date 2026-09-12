// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { StatsClient } from "./stats-client";

const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => store.set(k, v),
  removeItem: (k: string) => store.delete(k),
  clear: () => store.clear(),
});

const { localDateStr } = await import("@/lib/date-utils");

const chapters = [{ slug: "getting-started", docCount: 2 }];

function todayDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
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
  conflictTitle: "Multi-device sync note",
  conflictBodyTpl: "{n} item(s) differ from another device and were merged automatically.",
  conflictDismiss: "Got it",
  dataExportTitle: "Export learning data",
  dataExportDesc: "Generated locally as JSON; nothing is uploaded",
  dataExportBtn: "Export data",
  ctaQuiz: "Try a chapter quiz",
  weekSummaryTitle: "Weekly learning summary",
  reminderTitle: "Review reminder",
  reminderBodyTpl: "{n} wrong questions are due",
  reminderCta: "Review now",
  reminderLater: "Later",
  reminderSettingsTitle: "Review reminder settings",
  reminderCadenceLabel: "Frequency",
  reminderCadenceOff: "Off",
  reminderCadenceDaily: "Once a day",
  reminderCadenceWeekly: "Once a week",
  reminderDndLabel: "Do-not-disturb",
  weekSummaryTpl: "{m} min this week across {d} active days · {docs} read · {quiz} quizzes · {review} reviews · {replay} replay rounds",
  weekGoalLabel: "Weekly goal",
  weekGoalAchieved: "Weekly goal achieved 🎉",
  weekGoalLeftTpl: "{m} min to go for your weekly goal",
  ctaReview: "Take a chapter quiz to start collecting",
  ctaReplay: "Start your first round",
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
  milestoneShare: {
    title: "Milestone",
    button: "Share milestone",
    copied: "Copied",
    copyFailed: "Copy failed",
    empty: "Finish your first lesson",
    textTpl: "Read {read}/{total} lessons and {done}/{chapters} chapters.",
  },
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


describe("StatsClient milestone sharing (R13.22)", () => {
  it("renders one opt-in share action after a milestone is reached", async () => {
    render(<StatsClient chapters={chapters} dict={dict} locale="zh" />);

    expect(await screen.findByTestId("milestone-share")).toBeInTheDocument();
    expect(screen.getByTestId("milestone-share-btn")).toHaveTextContent("Share milestone");
  });

  it("does not render a share prompt before the first lesson", async () => {
    store.delete("tb-progress");
    store.delete("tb-progress-completions");
    render(<StatsClient chapters={chapters} dict={dict} locale="zh" />);

    expect(await screen.findByText("Empty")).toBeInTheDocument();
    expect(screen.queryByTestId("milestone-share")).not.toBeInTheDocument();
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

describe("StatsClient sync conflict notice (R12.9)", () => {
  it("shows the notice when conflicts were recorded and hides it after dismiss", async () => {
    localStorage.setItem(
      "tb-sync-conflicts",
      JSON.stringify({ at: 1234, items: [{ kind: "goal", key: "daily-goal-min", local: "15", cloud: "30", resolution: "kept-local" }] }),
    );
    render(<StatsClient chapters={chapters} dict={dict} locale="zh" />);
    expect(await screen.findByLabelText("Multi-device sync note")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Got it" }));
    expect(screen.queryByLabelText("Multi-device sync note")).not.toBeInTheDocument();
    expect(localStorage.getItem("tb-sync-conflicts-dismissed")).toBe("1234");
  });

  it("stays hidden for an already-dismissed record and for no record", async () => {
    localStorage.setItem(
      "tb-sync-conflicts",
      JSON.stringify({ at: 42, items: [{ kind: "wrongbook", key: "spot:1", local: "1/—", cloud: "3/—", resolution: "took-cloud" }] }),
    );
    localStorage.setItem("tb-sync-conflicts-dismissed", "42");
    render(<StatsClient chapters={chapters} dict={dict} locale="zh" />);
    await screen.findByRole("button", { name: "Last 7 days" });
    expect(screen.queryByLabelText("Multi-device sync note")).not.toBeInTheDocument();
  });
});

describe("StatsClient per-section empty-state CTAs (R12.11)", () => {
  it("links to the first chapter quiz when no quiz was ever finished", async () => {
    render(<StatsClient chapters={chapters} dict={dict} locale="zh" />);
    const link = await screen.findByRole("link", { name: /Try a chapter quiz/ });
    expect(link).toHaveAttribute("href", `/zh/knowledge/${chapters[0].slug}`);
  });

  it("links the review-empty CTA and hides it once the wrongbook has entries", async () => {
    const { unmount } = render(<StatsClient chapters={chapters} dict={dict} locale="zh" />);
    expect(await screen.findByRole("link", { name: /Take a chapter quiz to start collecting/ })).toBeInTheDocument();
    unmount();
    localStorage.setItem(
      "tb-wrong",
      JSON.stringify({ "spot:0": { chapterNum: "spot", questionIdx: 0, picked: 1, at: Date.now(), srsStage: 0, srsDue: "2099-01-01" } }),
    );
    render(<StatsClient chapters={chapters} dict={dict} locale="zh" />);
    await screen.findByRole("button", { name: "Last 7 days" });
    expect(screen.queryByRole("link", { name: /Take a chapter quiz to start collecting/ })).not.toBeInTheDocument();
  });

  it("links to the replay page when no replay was ever done", async () => {
    render(<StatsClient chapters={chapters} dict={dict} locale="zh" />);
    const link = await screen.findByRole("link", { name: /Start your first round/ });
    expect(link).toHaveAttribute("href", "/zh/replay");
  });

  it("hides the quiz CTA once a quiz has been finished", async () => {
    localStorage.setItem("tb-quiz-getting-started", JSON.stringify({ best: 8, done: true }));
    render(<StatsClient chapters={chapters} dict={dict} locale="zh" />);
    await screen.findByRole("button", { name: "Last 7 days" });
    expect(screen.queryByRole("link", { name: /Try a chapter quiz/ })).not.toBeInTheDocument();
  });
});

describe("StatsClient weekly summary card (R12.19/R12.20)", () => {
  it("renders the local summary line and shows remaining-to-goal minutes", async () => {
    render(<StatsClient chapters={chapters} dict={dict} locale="zh" />);
    expect(await screen.findByText("Weekly learning summary")).toBeInTheDocument();
    expect(screen.getByText(/to go for your weekly goal/)).toBeInTheDocument();
  });

  it("edits the weekly goal via tier buttons and persists it", async () => {
    render(<StatsClient chapters={chapters} dict={dict} locale="zh" />);
    await screen.findByRole("button", { name: "Last 7 days" });
    fireEvent.click(screen.getByRole("button", { name: "150 minutes" }));
    expect(localStorage.getItem("tb-weekly-goal-min")).toBe("150");
  });

  it("marks the goal achieved only with real minutes from the study ledger", async () => {
    localStorage.setItem("tb-weekly-goal-min", "45");
    localStorage.setItem("tb-study-time", JSON.stringify({ [todayDateStr()]: { read: 60 * 60 } }));
    render(<StatsClient chapters={chapters} dict={dict} locale="zh" />);
    expect(await screen.findByText("Weekly goal achieved 🎉")).toBeInTheDocument();
  });
});

describe("StatsClient review reminder banner + settings (R12.15–R12.17)", () => {
  const overdueWrong = () =>
    localStorage.setItem(
      "tb-wrong",
      JSON.stringify({ "spot:0": { chapterNum: "spot", questionIdx: 0, picked: 1, at: Date.now() - 86_400_000, srsStage: 0, srsDue: "2026-01-01" } }),
    );

  it("shows the banner when wrong questions are due and dedups once dismissed", async () => {
    overdueWrong();
    // 显式关闭免打扰窗（start==end），时钟无视当前系统时间（R12.17 纯逻辑层已做窗口用例）
    localStorage.setItem("tb-review-reminder-settings", JSON.stringify({ cadence: "daily", dndStartHour: 26, dndEndHour: 26 }));
    render(<StatsClient chapters={chapters} dict={dict} locale="zh" />);
    expect(await screen.findByLabelText("Review reminder")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Later" }));
    expect(screen.queryByLabelText("Review reminder")).not.toBeInTheDocument();
    expect(localStorage.getItem("tb-review-reminder-shown")).toBeTruthy();
  });

  it("never shows the banner with cadence off, no due reviews, or inside the DND window", async () => {
    overdueWrong();
    localStorage.setItem("tb-review-reminder-settings", JSON.stringify({ cadence: "off", dndStartHour: 22, dndEndHour: 8 }));
    render(<StatsClient chapters={chapters} dict={dict} locale="zh" />);
    await screen.findByRole("button", { name: "Last 7 days" });
    expect(screen.queryByLabelText("Review reminder")).not.toBeInTheDocument();
    cleanup();

    // 无到期错题（到期日远在未来）
    localStorage.setItem("tb-review-reminder-settings", JSON.stringify({ cadence: "daily", dndStartHour: 26, dndEndHour: 26 }));
    localStorage.setItem(
      "tb-wrong",
      JSON.stringify({ "spot:0": { chapterNum: "spot", questionIdx: 0, picked: 1, at: Date.now(), srsStage: 0, srsDue: "2099-01-01" } }),
    );
    render(<StatsClient chapters={chapters} dict={dict} locale="zh" />);
    await screen.findByRole("button", { name: "Last 7 days" });
    expect(screen.queryByLabelText("Review reminder")).not.toBeInTheDocument();
  });

  it("persists cadence and DND edits from the settings panel", async () => {
    render(<StatsClient chapters={chapters} dict={dict} locale="zh" />);
    await screen.findByRole("button", { name: "Last 7 days" });
    fireEvent.change(screen.getByLabelText("Frequency"), { target: { value: "weekly" } });
    expect(JSON.parse(localStorage.getItem("tb-review-reminder-settings")!).cadence).toBe("weekly");
    fireEvent.change(screen.getByLabelText("Do-not-disturb start"), { target: { value: "13" } });
    expect(JSON.parse(localStorage.getItem("tb-review-reminder-settings")!).dndStartHour).toBe(13);
  });
});
