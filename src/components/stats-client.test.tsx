// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { StatsClient } from "./stats-client";
import { QUIZZES } from "@/lib/quizzes";
import { STATS_DICTS, type StatsDict } from "@/lib/i18n-stats";
import { enqueueWrite } from "@/lib/sync-queue-store";

const store = new Map<string, string>();

/** 数据来源那两枚标记分游客/登录两套写法，所以登录态要能在单条用例里开关 */
const authState = vi.hoisted(() => ({ user: null as { id: string } | null }));
vi.mock("@/components/auth-provider", () => ({ useAuth: () => authState.user }));
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

/**
 * 词典夹具从真实 `STATS_DICTS.en` 派生：组件新增一个字段时这里不必逐个补，
 * 但覆盖的键必须真实存在（`StatsDict` 注解会拒绝拼错或已删的键）。
 * 之前是 `as unknown as` 双层强转——新字段没补上也不报错，只是渲染出 undefined。
 */
const dict: StatsDict = {
  ...STATS_DICTS.en,
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
  overall: "Overall",
  goalLabel: "Daily goal",
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
  // 真实词典里这两格不同名（`quizzes` 是趋势/概览卡的「测验完成」，`overviewQuizzes` 是
  // 学习概览那块的「测验记录」）。夹具曾经把它们写成同一个 "Quizzes"，任何按标签找卡片
  // 的断言都会一网打尽、分不清谁是谁。
  overviewQuizzes: "Quiz record",
  overviewReplay: "Replay",
  overviewTime: "Time",
  trendTitle: "Course completion trend",
  trendDesc: "Course trend description",
  trendRange: "Last 7 days",
  trendCompletions: "Completed docs",
  trendNewChapters: "Completed chapters",
  trendNoDates: "No completion dates",
  quizTrendTitle: "Quiz score trend",
  quizTrendDesc: "Quiz trend description",
  quizTrendEmptyTpl: "No quiz attempts in the last {n} days",
  quizTrendAttempts: "Attempts",
  quizBestInRange: "Best in range",
  quizAvgScore: "Average score",
  quizNoDates: "No quiz dates",
  reviewTrendTitle: "Review efficiency",
  reviewTrendDesc: "Review trend description",
  reviewTrendEmptyTpl: "No reviews in the last {n} days",
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
  conflictTitle: "Multi-device sync note",
  conflictBodyTpl: "{n} item(s) differ from another device and were merged automatically.",
  conflictDismiss: "Got it",
  dataExportTitle: "Export learning data",
  dataExportDesc: "Generated locally as JSON; nothing is uploaded",
  dataExportBtn: "Export data",
  ctaQuiz: "Try a chapter quiz",
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
  ctaReview: "Take a chapter quiz to start collecting",
  ctaReplay: "Start your first round",
  replayTrendTitle: "Replay practice time",
  replayTrendDesc: "Replay trend description",
  replayTrendEmptyTpl: "No replay rounds in the last {n} days",
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
};

beforeEach(() => {
  store.clear();
  store.set("tb-progress", JSON.stringify(progress));
  store.set("tb-progress-completions", JSON.stringify(completions));
  authState.user = null;
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

/**
 * R16.125：「测验完成」这个标签在同一屏挂着两张卡，两张都得说同一句话。
 *
 * 概览栅格那张读 `aggregateStats()`，测验趋势那张读 `buildQuizScoreTrend()`，喂的是同一份
 * localStorage。判据曾经不同（趋势卡额外要求 `best > 0`，答题账本又丢掉 0 分那条），于是
 * 「做完全错的一套题」在一张卡上是 1/27、另一张上是 0/27。第三处消费方是「下一步建议」的
 * `pendingQuizChapter`：它自己写了 `|| best > 0`，把「有分数但没做完」的篇章既不算完成、
 * 也不再建议去做。
 */
describe("StatsClient 测验完成 caliber (R16.125)", () => {
  /** 页面上所有顶着这个标签的卡片，取它们各自印出来的那个数 */
  function valuesLabeled(label: string): string[] {
    return [...document.querySelectorAll("p, dt")]
      .filter((node) => node.textContent?.trim() === label)
      .map((node) => node.closest("div")?.querySelector("p, dd")?.textContent?.trim() ?? "");
  }

  const totalQuizzes = Object.keys(QUIZZES).length;

  it("全答错的一套题：两张卡印同一个数，趋势那边也不漏这次作答", async () => {
    expect(totalQuizzes).toBeGreaterThan(1);
    // 打点定在当天正午，不用 `Date.now()`：跨过午夜的那一瞬它落在窗口外，
    // 「1/27 vs 0/27」会变成一条只在半夜红的用例（同 `todayDateStr()` 的其它用例）
    const attemptAt = new Date(`${todayDateStr()}T12:00:00`).getTime();
    store.set("tb-quiz-getting-started", JSON.stringify({ best: 0, done: true }));
    store.set(
      "tb-quiz-attempts",
      JSON.stringify({
        "getting-started:noon": { chapter: "getting-started", best: 0, total: 10, at: attemptAt },
      }),
    );
    render(<StatsClient chapters={chapters} dict={dict} locale="zh" />);
    await screen.findByText("Quiz score trend");

    const values = valuesLabeled("Quizzes");
    // 扫描分母：这个标签在该屏就该出现两次。少一次说明断言没测到东西，多一次说明又长出了第三处口径
    expect(values.length, `「Quizzes」标签出现了 ${values.length} 次，预期 2 次`).toBe(2);
    expect(new Set(values).size, `两张卡印出了互不相同的数：${values.join(" vs ")}`).toBe(1);
    expect(values[0]).toBe(`1/${totalQuizzes}`);
    // 0 分照样是这个窗口的「最高分」，印成 "-" 会被读成「这段时间没做题」
    expect(screen.getByRole("img", { name: /Quiz score trend/ })).toHaveAttribute("aria-label", "Quiz score trend: 0/10");
    expect(screen.getByText("0/10")).toBeInTheDocument();
  });

  it("有分数但没做完：两张卡都不算完成，「下一步」仍然把这套题递到眼前", async () => {
    store.set("tb-quiz-getting-started", JSON.stringify({ best: 5, done: false }));
    render(<StatsClient chapters={chapters} dict={dict} locale="en" />);
    await screen.findByText("Quiz score trend");

    const values = valuesLabeled("Quizzes");
    expect(values.length).toBe(2);
    expect(new Set(values).size, `两张卡印出了互不相同的数：${values.join(" vs ")}`).toBe(1);
    expect(values[0]).toBe(`0/${totalQuizzes}`);
    expect(screen.getByText("Check yourself: the getting-started quiz")).toBeInTheDocument();
  });
});

/**
 * R16.126：详细统计栅格那一格印的是**各章最高分再取平均**，不是「答对了多少」。
 * 它曾经只写着「准确率」——同一个数在上面的学习概览那块叫「平均得分 · 各章最高分的平均」，
 * 在测验趋势卡叫「平均得分」，在这一格却叫「准确率」，而重做刷满的 100% 并不是准确率。
 */
describe("StatsClient 测验平均分的标签说的是它算的那件事", () => {
  it("卡片自带口径，且这个数不再顶着裸的「准确率」", async () => {
    const total = QUIZZES["getting-started"].questions.length;
    store.set("tb-quiz-getting-started", JSON.stringify({ best: total, done: true }));
    render(<StatsClient chapters={chapters} dict={dict} locale="en" />);
    await screen.findByText("Learning overview");

    const label = [...document.querySelectorAll("p")].find(
      (node) => node.textContent === "Average score · average of chapter bests",
    );
    expect(label, "卡片没写出它的口径").toBeTruthy();
    // 标签与它旁边那个数是一对：只断言两个字符串都在页面上，换错格子也测不出来
    expect(label!.previousElementSibling?.textContent).toBe("100%");
    expect(screen.queryByText("Accuracy"), "「准确率」这三个字在这一屏只属于回放").not.toBeInTheDocument();
    expect(screen.getByText("Replay Accuracy")).toBeInTheDocument();
  });
});

describe("StatsClient learning-overview quiz caliber (R16.11)", () => {
  /**
   * 这张卡上的百分比不是任何一次的「最好成绩」，而是各章最高分再取平均。
   * 口径必须写在脸上：不然一个 80% 会被读成「你最好的一次是 80%」。
   */
  it("labels the overview quiz percentage with the caliber it actually uses", async () => {
    const total = QUIZZES["getting-started"].questions.length;
    store.set("tb-quiz-getting-started", JSON.stringify({ best: total, done: true }));
    render(<StatsClient chapters={chapters} dict={dict} locale="en" />);
    await screen.findByText("Learning overview");

    const section = document.querySelector("#learning-overview-title")?.closest("section");
    expect(section?.textContent).toMatch(/100% · average of chapter bests/);
  });

  it("shows no caliber for a quiz record that does not exist yet", async () => {
    render(<StatsClient chapters={chapters} dict={dict} locale="en" />);
    await screen.findByText("Learning overview");

    const section = document.querySelector("#learning-overview-title")?.closest("section");
    expect(section?.textContent).not.toContain("average of chapter bests");
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
    const at = Date.now();
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
    // 空态读屏文案同样要说真话：这三张图此前无论选哪档都念「last 7 days」
    expect(
      screen.getAllByRole("img", { name: /in the last 7 days$/ })
    ).toHaveLength(3);

    const { fireEvent } = await import("@testing-library/react");
    fireEvent.click(btn30);

    expect(store.get("tb-stats-range-days")).toBe("30");
    expect(screen.getByRole("button", { name: "Last 30 days" })).toHaveAttribute("aria-pressed", "true");
    // 课程趋势 aria 摘要随范围更新
    expect(screen.getByRole("img", { name: /^Last 30 days:/ })).toBeInTheDocument();
    expect(
      screen.getAllByRole("img", { name: /in the last 30 days$/ })
    ).toHaveLength(3);
    // 30 天网格列数生效
    const section = document.querySelector("#course-completion-trend-title")?.closest("section");
    expect(section?.querySelector("div[style]")?.getAttribute("style")).toContain("repeat(30, minmax(0, 1fr))");
  });
});

describe("StatsClient data source label (R12.8)", () => {
  it("shows the local-device source pill when not signed in", async () => {
    render(<StatsClient chapters={chapters} dict={dict} locale="zh" />);
    expect(await screen.findByLabelText("This device")).toBeInTheDocument();
    expect(screen.queryByText(/merged from cloud/)).not.toBeInTheDocument();
  });

  it("登录且打过云端合并的时刻时，那句说的是「从云端合并」并带上时间", async () => {
    // 反面是 R16.77 那个形状：字典装配好了、组件从不读，界面上一句都没有。
    // 夹具字典直接派生自真实 STATS_DICTS.en，所以这里断言的就是上线的那句文案。
    authState.user = { id: "u1" };
    store.set("tb-last-cloud-sync", String(new Date(2026, 8, 20, 9, 5).getTime()));
    render(<StatsClient chapters={chapters} dict={dict} locale="en" />);
    const line = await screen.findByText(/Last merged from cloud/);
    expect(line.textContent).toMatch(/\d/);
  });

  it("登录了但离线写队列里还压着改动时，那枚标记不宣称「本机 + 云端」已完成", async () => {
    // 反面是 R16.59 那一类：断网时的写已经算进页面上的数字，却一条都没到云上。
    authState.user = { id: "u1" };
    enqueueWrite("progress", "ch1:doc-a", { chapter: "ch1" }, 1000);
    render(<StatsClient chapters={chapters} dict={dict} locale="en" />);
    expect(await screen.findByLabelText(/changes awaiting upload/)).toBeInTheDocument();
    expect(screen.queryByText("Local + cloud")).not.toBeInTheDocument();
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

  it("念的是检测到的分歧处数，不是存下来的明细条数", async () => {
    // 明细有存储上限，横幅只有这一个数字：数明细会把 23 处说成 2 处。
    localStorage.setItem(
      "tb-sync-conflicts",
      JSON.stringify({
        at: 555,
        total: 23,
        items: [
          { kind: "goal", key: "daily-goal-min", local: "15", cloud: "30", resolution: "kept-local" },
          { kind: "wrongbook", key: "spot:1", local: "1/—", cloud: "3/—", resolution: "took-cloud" },
        ],
      }),
    );
    render(<StatsClient chapters={chapters} dict={dict} locale="zh" />);
    expect(await screen.findByText(/23 item\(s\) differ/)).toBeInTheDocument();
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
    expect(await screen.findByText("Learning summary · last 7 days")).toBeInTheDocument();
    expect(screen.getByText(/min to go for your 7-day goal/)).toBeInTheDocument();
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
    expect(await screen.findByText("7-day goal achieved 🎉")).toBeInTheDocument();
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

  /**
   * 上面那条查的是英文名字，所以「把 start 拼回模板字面量」这种回归它抓不到——英文页
   * 上拼出来的字符串一模一样，红的只有中文页面，而中文页面没有这条用例。
   */
  it("中文页面上两个时间选择框整句是中文，读屏不会念出裸的 start / end", async () => {
    render(<StatsClient chapters={chapters} dict={STATS_DICTS.zh} locale="zh" />);
    await screen.findByRole("button", { name: /近 7 天|Last 7 days/ });

    expect(screen.getByLabelText("免打扰开始时间")).toBeInTheDocument();
    expect(screen.getByLabelText("免打扰结束时间")).toBeInTheDocument();
    const names = screen.getAllByRole("combobox").map((el) => el.getAttribute("aria-label") ?? "");
    expect(names.length).toBeGreaterThan(0);
    expect(names.join(" |")).not.toMatch(/\b(start|end)\b/);
  });
});

describe("成就徽章按语言取值（R16.73）", () => {
  it("英文界面的成就墙不印中文徽章名", async () => {
    render(<StatsClient chapters={chapters} dict={dict} locale="en" />);
    expect(await screen.findByText("First step")).toBeInTheDocument();
    expect(screen.queryByText("第一步")).toBeNull();
    expect(screen.queryByText("回放连击王")).toBeNull();
  });

  it("中文界面仍是中文徽章名，不反过来露出英文", async () => {
    render(<StatsClient chapters={chapters} dict={dict} locale="zh" />);
    expect(await screen.findByText("第一步")).toBeInTheDocument();
    expect(screen.queryByText("First step")).toBeNull();
  });
});
